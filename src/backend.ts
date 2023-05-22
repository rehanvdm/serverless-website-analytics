import * as assert from 'assert';
import * as path from 'path';
import { Duration } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Effect } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { auth } from './auth';
import { backendAnalytics } from './backendAnalytics';
import { SwaProps } from './index';

export function backend(
  scope: Construct,
  name: (name: string) => string,
  props: SwaProps,
  authProps: ReturnType<typeof auth>,
  backendAnalyticsProps: ReturnType<typeof backendAnalytics>
) {
  let defaultEnv = {
    ENVIRONMENT: props.environment,
    VERSION: '0.0.0',
    AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    NODE_OPTIONS: '--enable-source-maps',
    LOG_LEVEL: 'DEBUG', // isProd ? "AUDIT" : "DEBUG"
  };
  let defaultNodeJsFuncOpt = {};

  /* ================================== */
  /* ============ API Ingest ========== */
  /* ================================== */

  const geoLite2Layer = new lambda.LayerVersion(scope, name('layer-geolite2'), {
    layerVersionName: name('layer-geolite2'),
    code: lambda.Code.fromAsset(path.join(__dirname, '../lib/build/backend/layer-geolite2')),
  });

  const ingestLambdaTimeout = 10;

  const apiIngestLambda = new lambda.Function(scope, name('lambda-api-ingest'), {
    functionName: name('api-ingest'),
    code: lambda.Code.fromAsset(path.join(__dirname, '../lib/build/backend/api-ingest')),
    handler: 'index.handler',
    runtime: lambda.Runtime.NODEJS_16_X,
    ...defaultNodeJsFuncOpt,
    memorySize: 1024,
    timeout: Duration.seconds(ingestLambdaTimeout),
    environment: {
      ...defaultEnv,
      TIMEOUT: ingestLambdaTimeout.toString(),
      ENRICH_RETURNED_ERRORS: 'true', //props.environment != "prod"
      ANALYTICS_BUCKET: backendAnalyticsProps.analyticsBucket.bucketName,
      GEOLITE2_CITY_PATH: '/opt/GeoLite2-City.mmdb',

      SITES: JSON.stringify(props.sites),
      ALLOWED_ORIGINS: JSON.stringify(props.allowedOrigins),
    },
    reservedConcurrentExecutions: 200,
    layers: [geoLite2Layer],
  });
  apiIngestLambda.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'FirehosePermission',
      effect: Effect.ALLOW,
      actions: ['firehose:PutRecord'],
      resources: [backendAnalyticsProps.firehosePageViews.attrArn, backendAnalyticsProps.firehoseEvents.attrArn],
    })
  );

  const apiIngestLambdaUrl = apiIngestLambda.addFunctionUrl({
    authType: lambda.FunctionUrlAuthType.NONE,
  });

  /* ================================== */
  /* ============ API Front ========== */
  /* ================================== */
  let frontLambdaTimeOut = 60;
  let env: Record<string, string> = {
    ...defaultEnv,
    TIMEOUT: frontLambdaTimeOut.toString(),
    ENRICH_RETURNED_ERRORS: 'true', //props.environment != "prod"

    ANALYTICS_BUCKET: backendAnalyticsProps.analyticsBucket.bucketName,
    ANALYTICS_GLUE_DB_NAME: backendAnalyticsProps.glueDbName,
    SITES: JSON.stringify(props.sites),
  };

  if (props.auth?.cognito) {
    assert.ok(authProps.userPool);
    assert.ok(authProps.userPoolClient);
    assert.ok(authProps.userPoolDomain);
    env = {
      ...env,
      COGNITO_USER_POOL_ID: authProps.userPool.userPoolId,
      COGNITO_CLIENT_ID: authProps.userPoolClient.userPoolClientId,
      COGNITO_HOSTED_UI_URL: authProps.userPoolDomain,
    };
  }

  const apiFrontLambda = new lambda.Function(scope, name('lambda-api-front'), {
    functionName: name('api-front'),
    code: lambda.Code.fromAsset(path.join(__dirname, '../lib/build/backend/api-front')),
    handler: 'index.handler',
    runtime: lambda.Runtime.NODEJS_16_X,
    ...defaultNodeJsFuncOpt,
    memorySize: 1024,
    timeout: Duration.seconds(frontLambdaTimeOut),
    environment: env,
    reservedConcurrentExecutions: 100,
  });
  apiFrontLambda.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'AthenaPermissions',
      effect: Effect.ALLOW,
      actions: ['athena:StartQueryExecution', 'athena:GetQueryExecution', 'athena:GetQueryResults'],
      resources: [
        cdk.Arn.format({
          partition: 'aws',
          account: props.awsEnv.account,
          region: props.awsEnv.region,
          service: 'athena',
          resource: 'workgroup/primary',
        }),
      ],
    })
  );
  apiFrontLambda.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'GluePermissions',
      effect: Effect.ALLOW,
      actions: ['glue:GetTable', 'glue:GetPartitions', 'glue:BatchCreatePartition', 'glue:GetDatabase'],
      resources: [
        cdk.Arn.format({
          partition: 'aws',
          account: props.awsEnv.account,
          region: props.awsEnv.region,
          service: 'glue',
          resource: 'catalog',
        }),
        cdk.Arn.format({
          partition: 'aws',
          account: props.awsEnv.account,
          region: props.awsEnv.region,
          service: 'glue',
          resource: 'database',
          resourceName: backendAnalyticsProps.glueDbName,
        }),
        cdk.Arn.format({
          partition: 'aws',
          account: props.awsEnv.account,
          region: props.awsEnv.region,
          service: 'glue',
          resource: 'table',
          resourceName: backendAnalyticsProps.glueDbName + '/' + backendAnalyticsProps.glueTablePageViewsName,
        }),
        cdk.Arn.format({
          partition: 'aws',
          account: props.awsEnv.account,
          region: props.awsEnv.region,
          service: 'glue',
          resource: 'table',
          resourceName: backendAnalyticsProps.glueDbName + '/' + backendAnalyticsProps.glueTableEventsName,
        }),
      ],
    })
  );
  apiFrontLambda.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'AthenaS3Permissions',
      effect: Effect.ALLOW,
      actions: [
        's3:GetBucketLocation',
        's3:GetObject',
        's3:ListBucket',
        's3:ListBucketMultipartUploads',
        's3:ListMultipartUploadParts',
        's3:AbortMultipartUpload',
        's3:PutObject',
      ],
      resources: [
        backendAnalyticsProps.analyticsBucket.bucketArn,
        backendAnalyticsProps.analyticsBucket.arnForObjects('*'),
      ],
    })
  );

  const apiFrontLambdaUrl = apiFrontLambda.addFunctionUrl({
    authType: lambda.FunctionUrlAuthType.NONE,
  });

  return {
    apiIngestOrigin: cdk.Fn.select(2, cdk.Fn.split('/', apiIngestLambdaUrl.url)),
    apiFrontOrigin: cdk.Fn.select(2, cdk.Fn.split('/', apiFrontLambdaUrl.url)),
  };
}
