import { APIGatewayProxyEventV2, APIGatewayProxyResult, Context, SQSEvent, S3Event } from 'aws-lambda';
import aws from 'aws-sdk';
import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import assert from 'assert';
import fs from 'fs/promises';
import * as AmazonCognitoIdentity from 'amazon-cognito-identity-js';
import path from 'path';

export function apiGwContext() {
  const apiGwContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'mocked',
    functionVersion: 'mocked',
    invokedFunctionArn: 'mocked',
    memoryLimitInMB: 'mocked',
    awsRequestId: 'mocked',
    logGroupName: 'mocked',
    logStreamName: 'mocked',
    getRemainingTimeInMillis(): number {
      return 999;
    },
    // done (error?: Error, result?: any): void {
    //
    // },
    // fail (error: Error | string): void {
    //
    // },
    // succeed (messageOrObject: any): void {
    //
    // }
  } as Context;
  return apiGwContext;
}

export type ApiGwEventOptions = {
  method: 'GET' | 'POST' | 'OPTIONS';
  path: string;
  contentType?: string;
  pathParameters?: { [name: string]: string | undefined };
  queryStringParameters?: { [name: string]: string | undefined };
  headers?: { [name: string]: string };
  body?: string;
  origin?: string;
  ip?: string;
  ua?: string;
};
// export function apiGwEvent(opts: ApiGwEventOptions): APIGatewayEvent {
//     return {
//         body: opts.body || null,
//         headers: {},
//         multiValueHeaders: {},
//         httpMethod: opts.method,
//         isBase64Encoded: false,
//         path: opts.path,
//         pathParameters : opts.pathParameters || null,
//         queryStringParameters : opts.queryStringParameters || null,
//         multiValueQueryStringParameters : null,
//         stageVariables : null,
//         requestContext: {
//             accountId: "123456789012",
//             apiId: "1234567890",
//             authorizer: {},
//             protocol: "HTTP/1.1",
//             httpMethod: opts.method,
//             identity: {
//                 accessKey: null,
//                 accountId: null,
//                 apiKey : null,
//                 apiKeyId : null,
//                 caller: null,
//                 clientCert: null,
//                 cognitoAuthenticationProvider: null,
//                 cognitoAuthenticationType: null,
//                 cognitoIdentityId: null,
//                 cognitoIdentityPoolId: null,
//                 principalOrgId : null,
//                 sourceIp: "127.0.0.1",
//                 userArn: null,
//                 userAgent: "Custom User Agent String",
//                 user: null
//             },
//             path: opts.path,
//             stage: "mocked",
//             requestId: "mocked",
//             requestTime: "09/Apr/2015:12:34:56 +0000",
//             requestTimeEpoch: 1428582896000,
//             resourceId: "123456",
//             resourcePath: "/{proxy+}",
//         },
//         resource: "/{proxy+}"
//     };
// }

export function apiGwEventV2(opts: ApiGwEventOptions): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    body: opts.body || undefined,
    rawPath: opts.path,
    rawQueryString: '',
    queryStringParameters: opts.queryStringParameters,
    pathParameters: opts.pathParameters,
    headers: {
      'x-amzn-tls-cipher-suite': 'ECDHE-RSA-AES128-GCM-SHA256',
      'x-amzn-tls-version': 'TLSv1.2',
      'x-amzn-trace-id': 'Root=1-63f1bdf2-7dc6e1bb7f6b429b5380582b',
      'x-forwarded-proto': 'https',
      origin: opts.origin || '',
      'x-forwarded-port': '443',
      'x-amz-cf-id': 'FBw78cV1ocjog1mSm3hAzQAAVpOPqzXnPVdX5q0fIqvTXIjs2WS55Q==',
      via: '2.0 1db4ab20ef3897e534041f147e869cca.cloudfront.net (CloudFront)',
      'x-forwarded-for': opts.ip || '',
      'user-agent': opts.ua || '',
      'content-type': opts.contentType || 'application/json',
      ...opts.headers,
    },
    requestContext: {
      accountId: 'anonymous',
      apiId: 'wgww7os4xwv5bquomdbplkn4gi0hwlmo',
      domainName: 'wgww7os4xwv5bquomdbplkn4gi0hwlmo.lambda-url.us-east-1.on.aws',
      domainPrefix: 'wgww7os4xwv5bquomdbplkn4gi0hwlmo',
      http: {
        method: opts.method,
        path: opts.path,
        protocol: 'HTTP/1.1',
        sourceIp: opts.ip || '',
        userAgent: opts.ua || '',
      },
      requestId: '9cd26b7a-e51f-48ae-b926-0f6580e66cdd',
      routeKey: '$default',
      stage: '$default',
      time: '19/Feb/2023:06:13:07 +0000',
      timeEpoch: 1676787187031,
    },
    isBase64Encoded: false,
  };
}

type S3EventObject = {
  key: string;
  size: number;
  eTag: string;
  versionId?: string | undefined;
  sequencer: string;
};
export function s3CreateNotification(obj: S3EventObject): S3Event {
  return {
    Records: [
      {
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'eu-west-1',
        eventTime: '2023-11-10T04:57:04.425Z',
        eventName: 'ObjectCreated:Put',
        userIdentity: {
          principalId: 'AWS:xxx:AWSFirehoseToS3',
        },
        requestParameters: {
          sourceIPAddress: '0.0.0.0',
        },
        responseElements: {
          'x-amz-request-id': 'xxx',
          'x-amz-id-2': 'xxx',
        },
        s3: {
          s3SchemaVersion: '1.0',
          configurationId: 'xxx',
          bucket: {
            name: 'rehan-analytics-swa-analytics-data',
            ownerIdentity: {
              principalId: 'A9BIL594CU6ME',
            },
            arn: 'arn:aws:s3:::rehan-analytics-swa-analytics-data',
          },
          object: obj,
        },
      },
    ],
  };
}

export function sqsEvent(body: string): SQSEvent {
  return {
    Records: [
      {
        messageId: '7a2250c8-de50-4a72-9360-6d20a0e64309',
        receiptHandle: 'xxxx',
        body,
        attributes: {
          ApproximateFirstReceiveTimestamp: '1636534624456',
          ApproximateReceiveCount: '1',
          SenderId: 'xxx',
          SentTimestamp: '1636534624455',
        },
        messageAttributes: {},
        md5OfBody: '85cbbcdff1ece97175e2f4f1534be363',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:eu-west-1:xxx',
        awsRegion: 'eu-west-1',
      },
    ],
  };
}

export function setEnvVariables(obj: Record<string, string>) {
  for (const [key, val] of Object.entries(obj)) {
    process.env[key] = val;
  }
}

/**
 * Set the ENV variables used by the SDK. Hoisting these to be run before the AWS SDK imports do not work but it should.
 * You can therefore pass in the AWS SDK to set them explicitly or if it is application code then the clients have to be reread
 * from environment variables and reinitialized
 * @param profileName
 * @param region
 * @param setAccessAndSecretKeys
 * @param awsSdk
 */
export function setAWSSDKCreds(
  profileName: string,
  region: string,
  setAccessAndSecretKeys = false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  awsSdk: any = undefined
) {
  /* Setting these for all future imports of the AWS SDK, won't work if the aws-sdk has been acquired all ready */
  process.env.AWS_PROFILE = profileName;
  process.env.AWS_DEFAULT_REGION = region;
  process.env.AWS_ACCESS_KEY_ID = '';
  process.env.AWS_SECRET_ACCESS_KEY = '';
  process.env.AWS_SESSION_TOKEN = ''; /* Always empty this, not using STS but long-lived */

  /* This is to change any AWS SDK that has been imported all ready */
  if (awsSdk) {
    awsSdk.config.credentials = new awsSdk.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
  }

  if (setAccessAndSecretKeys) {
    /* These are needed for when making SIGNED IAM REQUESTS, these ENV variables will be used by default.
     * For the Lambdas, these will be populated and have the permissions of the role. */
    const awsCredentials = new aws.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
    process.env.AWS_ACCESS_KEY_ID = awsCredentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = awsCredentials.secretAccessKey;
    process.env.AWS_SESSION_TOKEN = awsCredentials.sessionToken;
    process.env.AWS_PROFILE = '';
  }
}

export const TEST_TYPE = {
  UNIT: 'UNIT',
  E2E: 'E2E',
};

export async function apiRequest(url: string, opts: ApiGwEventOptions): Promise<APIGatewayProxyResult> {
  let headers = {};
  if (opts.headers) {
    headers = opts.headers;
  }

  if (opts.origin) {
    headers = { ...headers, origin: opts.origin };
  }

  const options: AxiosRequestConfig = {
    method: opts.method,
    params: opts.queryStringParameters || undefined,
    data: opts.body ? JSON.parse(opts.body) : undefined,
    url: url + opts.path,
    // timeout: 30000,
    headers,
    transformResponse: (res) => {
      return res;
    } /* Do not parse json */,
  };

  console.log(JSON.stringify(options, null, 2));

  try {
    const res = await axios(options);
    return {
      statusCode: res.status,
      body: res.data,
      headers: res.headers as { [p: string]: string | number | boolean } | undefined,
    };
  } catch (e) {
    const err = e as AxiosError;
    assert(err.response);
    const resp = {
      statusCode: err.response.status,
      body: err.response.data,
      headers: err.response.headers,
    };
    console.error(resp);
    console.error('body decoded', JSON.stringify(JSON.parse(resp.body as string), null, 2));
    return resp as APIGatewayProxyResult;
  }
}

export function invokeLocalHandlerOrMakeAPICall(
  opts: ApiGwEventOptions,
  handler?: (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyResult>,
  apiUrl?: string,
  context?: Context
): Promise<APIGatewayProxyResult> {
  if (process.env.TEST_TYPE === TEST_TYPE.UNIT) {
    assert(handler);
    assert(context);
    const event = apiGwEventV2(opts);
    return handler(event, context);
  } else if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
    assert(apiUrl);
    return apiRequest(apiUrl, opts);
  } else {
    throw new Error('TEST_TYPE is not set');
  }
}

/**
 *
 * @param cognitoUser {CognitoUser}
 * @param username
 * @param password
 * @returns { Promise<CognitoUserSession>}
 */
async function authenticateCognito(
  cognitoUser: AmazonCognitoIdentity.CognitoUser,
  username: string,
  password: string
): Promise<AmazonCognitoIdentity.CognitoUserSession> {
  const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: username,
    Password: password,
  });
  return await new Promise((resolve, reject) => {
    try {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (result) {
          resolve(result);
        },
        onFailure: function (err) {
          console.error(err);
          reject(err);
        },
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

type CachedCognitoUser = {
  username: string;
  payload: {
    exp: number;
  };
  jwtIdToken: string;
};
export async function getCognitoIdentity(userPoolId: string, clientId: string, username: string, password: string) {
  const userCachePath = path.resolve('./cognito_identity_cache.json');
  const exists = await fs
    .access(userCachePath)
    .then(() => true)
    .catch(() => false);

  let cacheString: string | undefined;
  if (exists) {
    cacheString = await fs.readFile(userCachePath, { encoding: 'utf8' });
  }

  let userCached: CachedCognitoUser | undefined = cacheString ? JSON.parse(cacheString) : undefined;
  const refreshAt = !userCached ? 0 : (userCached?.payload?.exp || 0) - 60 * 5; // Get new token 5 mins before expires
  let jwtIdToken: string;
  if (Date.now() / 1000 > refreshAt) {
    console.log('Cognito: fetching new user credential for ' + username + ' and storing in cache');

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
      Username: username,
      Pool: new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: userPoolId,
        ClientId: clientId,
      }),
    });

    const result = await authenticateCognito(cognitoUser, username, password);
    const idToken = result.getIdToken();

    userCached = {
      username,
      payload: {
        exp: idToken.payload.exp,
      },
      jwtIdToken: idToken.getJwtToken(),
    };

    await fs.writeFile(userCachePath, JSON.stringify(userCached, null, 2));
    jwtIdToken = idToken.getJwtToken();
  } else {
    console.log('Cognito: reading user credential for ' + username + ' from cache');
    assert(userCached);
    jwtIdToken = userCached.jwtIdToken;
  }

  return {
    jwtIdToken,
  };
}
