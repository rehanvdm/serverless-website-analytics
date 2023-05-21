import { CreateAWSLambdaContextOptions } from '@trpc/server/adapters/aws-lambda';
import { appRouter } from '@backend/api-ingest/server';
import { APIGatewayProxyEventV2, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createOpenApiAwsLambdaHandler, generateOpenApiDocument } from 'trpc-openapi';
import { OpenAPIV3 } from 'openapi-types';
import { v4 as uuidv4 } from 'uuid';

import { LambdaEnvironment } from '@backend/api-ingest/environment';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { AuditLog } from '@backend/lib/models/audit_log';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { TRPCError } from '@trpc/server';
import assert from 'assert';
import { removeCloudFrontProxyPath, TRPCHandlerError } from '@backend/lib/utils/api_utils';

/* Lazy loaded variables */
let openApiDocument: OpenAPIV3.Document | undefined;
let initialized = false;

function docsRoute(): APIGatewayProxyResult {
  const applicationName = 'Serverless Website Analytics';

  if (!openApiDocument) {
    openApiDocument = generateOpenApiDocument(appRouter, {
      title: applicationName,
      description: 'Ingestion API',
      version: '-',
      baseUrl: '-',
    });
  }

  const openApiDocumentJsonObject = JSON.stringify(openApiDocument);
  const body = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${applicationName}</title>
                <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@3/swagger-ui.css">
            </head>
            <body>
                <div id="swagger"></div>
                <script src="https://unpkg.com/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
                <script>
                  SwaggerUIBundle({
                    dom_id: '#swagger',
                    spec: ${openApiDocumentJsonObject}
                });
                </script>
            </body>
            </html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body,
  };
}

function validateAndGetCorsOrigin(origin: string) {
  if (LambdaEnvironment.ALLOWED_ORIGINS.includes('*')) {
    return origin;
  }

  if (LambdaEnvironment.ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  } else {
    return false;
  }
}
function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}

export const handler = async (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResult> => {
  // console.log("EVENT", event);
  const logger = new LambdaLog();
  const shouldInitialize = !initialized || process.env.TESTING_LOCAL_RE_INIT === 'true';
  if (shouldInitialize) {
    LambdaEnvironment.init();
    logger.init(LambdaEnvironment.ENVIRONMENT);
    initialized = true;
  }

  LambdaEnvironment.TRACE_ID = context.awsRequestId;
  logger.start(LambdaEnvironment.LOG_LEVEL, LambdaEnvironment.TRACE_ID);
  logger.info('Init', event);
  event = removeCloudFrontProxyPath(event, '/api-ingest');
  const audit: AuditLog = {
    app_version: LambdaEnvironment.VERSION,
    audit_log_id: uuidv4(),
    trace_id: LambdaEnvironment.TRACE_ID,
    created_at: DateUtils.stringifyIso(DateUtils.now()),
    environment: LambdaEnvironment.ENVIRONMENT,
    meta: '',
    origin: 'swa/api-ingest',
    origin_path: event.rawPath,
    origin_method: event.requestContext.http.method,
    run_time: 0,
    success: true,
    type: 'api',
  };

  let response: APIGatewayProxyResult | undefined;
  let trpcLastError: TRPCHandlerError | undefined;
  try {
    const corsValidOrigin = validateAndGetCorsOrigin(event.headers.origin || '');

    if (event.rawPath === '/docs') {
      response = docsRoute();
    } else {
      if (!corsValidOrigin) {
        logger.error('Invalid origin:', event.headers.origin);
        response = { statusCode: 403, body: '' };
      } else {
        const returnCorsHeaders = corsHeaders(corsValidOrigin);
        if (event.requestContext.http.method === 'OPTIONS') {
          if (corsValidOrigin) {
            response = { statusCode: 200, headers: returnCorsHeaders, body: '' };
          }
        } else {
          /* navigator.sendBeacon(..) leaves the content type as text, by adding the request header here the handler
           * will interpret it as application/json correctly  */
          if (event.rawPath === '/v1/page/view' || event.rawPath === '/v1/page/time') {
            event.headers['content-type'] = 'application/json';
          }

          const trpcOpenApiHandler = createOpenApiAwsLambdaHandler({
            router: appRouter,
            createContext: ({ event }: CreateAWSLambdaContextOptions<APIGatewayProxyEventV2>) => {
              return {
                request: {
                  ip: event.headers['x-forwarded-for'] || '',
                  ua: event.requestContext.http.userAgent,
                },
              };
            },
            onError(err) {
              trpcLastError = err;
            },
          });
          response = await trpcOpenApiHandler(event, context);
          response.headers = { ...response.headers, ...returnCorsHeaders };
        }
      }
    }
  } catch (err) {
    /* Should ideally never happen, the tRPC OpenAPI Lambda Handler will catch any `throw new Error(...)` and still
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
