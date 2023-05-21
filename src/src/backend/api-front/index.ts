import { CreateAWSLambdaContextOptions, awsLambdaRequestHandler } from '@trpc/server/adapters/aws-lambda';
import { appRouter } from '@backend/api-front/server';
import { APIGatewayProxyEventV2, APIGatewayProxyResult, Context } from 'aws-lambda';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { LambdaEnvironment } from '@backend/api-front/environment';
import { AuditLog } from '@backend/lib/models/audit_log';
import { v4 as uuidv4 } from 'uuid';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { TRPCError } from '@trpc/server';
import assert from 'assert';
import { removeCloudFrontProxyPath, TRPCHandlerError } from '@backend/lib/utils/api_utils';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { CognitoJwtVerifierSingleUserPool } from 'aws-jwt-verify/cognito-verifier';

/* Lazy loaded variables */
let initialized = false;
let isCognitoAuth = false;
let cognitoVerifier:
  | CognitoJwtVerifierSingleUserPool<{ userPoolId: string; tokenUse: 'id'; clientId: string }>
  | undefined;

export const handler = async (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResult> => {
  // console.log("EVENT", event);
  const logger = new LambdaLog();
  const shouldInitialize = !initialized || process.env.TESTING_LOCAL_RE_INIT === 'true';
  if (shouldInitialize) {
    LambdaEnvironment.init();
    logger.init(LambdaEnvironment.ENVIRONMENT);
    if (LambdaEnvironment.COGNITO_USER_POOL_ID && LambdaEnvironment.COGNITO_CLIENT_ID) {
      isCognitoAuth = true;
      cognitoVerifier = CognitoJwtVerifier.create({
        userPoolId: LambdaEnvironment.COGNITO_USER_POOL_ID,
        clientId: LambdaEnvironment.COGNITO_CLIENT_ID,
        tokenUse: 'id',
      });
    }
    initialized = true;
  }

  LambdaEnvironment.TRACE_ID = context.awsRequestId;
  logger.start(LambdaEnvironment.LOG_LEVEL, LambdaEnvironment.TRACE_ID);
  logger.info('Init', event);
  event = removeCloudFrontProxyPath(event, '/api');
  const audit: AuditLog = {
    app_version: LambdaEnvironment.VERSION,
    audit_log_id: uuidv4(),
    trace_id: LambdaEnvironment.TRACE_ID,
    created_at: DateUtils.stringifyIso(DateUtils.now()),
    environment: LambdaEnvironment.ENVIRONMENT,
    meta: '',
    origin: 'swa/api',
    origin_path: event.rawPath,
    origin_method: event.requestContext.http.method,
    run_time: 0,
    success: true,
    type: 'api',
  };

  let response: APIGatewayProxyResult | undefined;
  let trpcLastError: TRPCHandlerError | undefined;
  try {
    const trpcHandler = awsLambdaRequestHandler({
      router: appRouter,
      createContext: async ({ event }: CreateAWSLambdaContextOptions<APIGatewayProxyEventV2>) => {
        /* Verify Cognito ID token if required */
        if (isCognitoAuth) {
          assert(cognitoVerifier);
          const idToken = event.headers.authorization || event.headers.Authorization || '';
          try {
            return {
              requiresAuth: true,
              user: await cognitoVerifier.verify(idToken),
            };
          } catch (err) {
            logger.info('JWT Decode error', err);
            return {
              requiresAuth: true,
              user: undefined,
            };
          }
        }

        return {
          requiresAuth: false,
          user: undefined,
        };
      },
      onError(err) {
        trpcLastError = err;
      },
    });
    const structuredResponse = await trpcHandler(event, context);
    if (!structuredResponse.statusCode) {
      throw new Error('No status code returned from TRPC handler');
    }

    response = {
      statusCode: structuredResponse.statusCode,
      headers: structuredResponse.headers,
      body: structuredResponse.body || '',
      isBase64Encoded: structuredResponse.isBase64Encoded,
    };
  } catch (err) {
    /* Should ideally never happen, the tRPC Lambda Handler will catch any `throw new Error(...)` and still
     * return a response that has status code 500. This is just to cover all the basis. */
    if (err instanceof Error) {
      logger.error(err);
      if (!response) {
        response = {
          statusCode: 500,
          body: JSON.stringify(
            new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Unexpected Error Occurred',
              cause: LambdaEnvironment.ENVIRONMENT === 'dev' ? err : undefined,
            })
          ),
        };
      }
    } else {
      throw new Error('Error is unknown', { cause: err });
    }
  } finally {
    assert(response);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      audit.success = true;
    } else if (response.statusCode >= 300 && response.statusCode < 500) {
      audit.success = true;
      audit.status_description = response.body;
      if (trpcLastError) {
        audit.meta = JSON.stringify(trpcLastError);
      }
    } else {
      audit.success = false;
      audit.status_description = response.body;

      if (trpcLastError) {
        logger.error(trpcLastError.error);
        audit.meta = JSON.stringify(trpcLastError);

        /* Enrich error response with stack trace in dev and testing
           and do not show the error description in production, status code is enough */
        if (LambdaEnvironment.ENRICH_RETURNED_ERRORS) {
          response.body = JSON.stringify({
            ...trpcLastError,
            error: {
              code: trpcLastError.error.code,
              name: trpcLastError.error.name,
              message: trpcLastError.error.message,
              stack: trpcLastError.error.stack,
            },
          });
        }
      } else {
        response.body = JSON.stringify(new TRPCError({ code: 'INTERNAL_SERVER_ERROR' }));
      }
    }

    audit.status_code = response.statusCode;
    audit.run_time = LambdaEnvironment.TIMEOUT * 1000 - context.getRemainingTimeInMillis();
    logger.audit(audit);
  }

  return response;
};
