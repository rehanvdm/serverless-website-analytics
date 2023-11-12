import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CfnRole, Effect } from 'aws-cdk-lib/aws-iam';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { CfnLogGroup } from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as timestream from 'aws-cdk-lib/aws-timestream';
import { Construct } from 'constructs';
import { SwaProps } from './index';

const defaultFirehoseBufferInterval = 900;

export function backendAnalyticsTimeStream(scope: Construct, name: (name: string) => string, props: SwaProps) {
  // TOdo: Use same bucket as have + shorter name, adding `-data` to everything now
  const analyticsBucket = new s3.Bucket(scope, name('analytics-data'), {
    bucketName: name('analytics-data'),
    autoDeleteObjects: true,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const firehoseDeliveryRole = new iam.Role(scope, name('analytic-data-firehose-role'), {
    inlinePolicies: {
      default: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'S3Permissions',
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
            resources: [analyticsBucket.bucketArn, analyticsBucket.arnForObjects('*')],
          }),
          new iam.PolicyStatement({
            sid: 'CWLogsPermissions',
            effect: Effect.ALLOW,
            actions: ['logs:PutLogEvents'],
            resources: ['*'],
          }),
        ],
      }),
    },
    assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
  });
  const logGroup = new logs.LogGroup(scope, name('analytic-data-firehose-log'), {
    logGroupName: name('analytic-firehose-log'),
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  logGroup.addStream(name('analytic-data-firehose-log-stream'), {
    logStreamName: 'logs',
  });
  logGroup.grantWrite(new iam.ServicePrincipal('firehose.amazonaws.com'));

  const tsFirehose = new CfnDeliveryStream(scope, name('ts-firehose'), {
    deliveryStreamName: name('ts-firehose'),
    extendedS3DestinationConfiguration: {
      cloudWatchLoggingOptions: {
        enabled: true,
        logGroupName: logGroup.logGroupName,
        logStreamName: 'logs',
      },
      bucketArn: analyticsBucket.bucketArn,
      roleArn: firehoseDeliveryRole.roleArn,

      prefix: 'ts-raw-data/timestamp=!{timestamp:yyyy-MM-dd}/',
      errorOutputPrefix: 'error/!{firehose:error-output-type}/',
      bufferingHints: {
        intervalInSeconds: props.firehoseBufferInterval ?? defaultFirehoseBufferInterval,
        sizeInMBs: 64,
      },
    },
  });
  tsFirehose.addDependency(firehoseDeliveryRole.node.defaultChild as CfnRole);
  tsFirehose.addDependency(logGroup.node.defaultChild as CfnLogGroup);

  const tsProcessLambdaTimeout = 900;
  const dlq = new sqs.Queue(scope, name('ts-queue-dlq'), {
    retentionPeriod: cdk.Duration.days(14),
  });
  const queue = new sqs.Queue(scope, name('ts-queue'), {
    queueName: name('ts-queue'),
    visibilityTimeout: cdk.Duration.seconds(tsProcessLambdaTimeout * 2),
    deadLetterQueue: {
      queue: dlq,
      maxReceiveCount: 3,
    },
  });
  analyticsBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(queue), {
    prefix: 'ts-raw-data/',
  });

  const dbName = name('ts-db');
  const db = new timestream.CfnDatabase(scope, dbName, {
    databaseName: dbName,
  });

  const tableName = name('ts-table');
  const table = new timestream.CfnTable(scope, tableName, {
    databaseName: dbName,
    tableName: tableName,
    retentionProperties: {
      memoryStoreRetentionPeriodInHours: 1,
      magneticStoreRetentionPeriodInDays: 30 * 12 * 5, //Keep about 5 years worth of data
    },
  });
  table.addDependency(db);

  let defaultEnv = {
    ENVIRONMENT: props.environment,
    VERSION: '0.0.0',
    AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    NODE_OPTIONS: '--enable-source-maps',
  };

  const tsProcessLambda = new lambda.Function(scope, name('ts-process-lambda'), {
    functionName: name('ts-process-lambda'),
    code: lambda.Code.fromAsset(path.join(__dirname, '../lib/build/backend/ts-process')),
    handler: 'index.handler',
    runtime: lambda.Runtime.NODEJS_16_X,
    memorySize: 1024,
    timeout: Duration.seconds(tsProcessLambdaTimeout),
    environment: {
      ...defaultEnv,
      LOG_LEVEL: 'DEBUG',
      TIMEOUT: tsProcessLambdaTimeout.toString(),
      TIMESTREAM_ANALYTICS_BUCKET: analyticsBucket.bucketName,
      TIMESTREAM_DATABASE_NAME: dbName,
      TIMESTREAM_TABLE_NAME: tableName,
    },
    reservedConcurrentExecutions: 1, // Maybe just remove? But for now want to write sequentially..
  });
  new lambda.EventSourceMapping(scope, name('ts-process-lambda-event-source'), {
    eventSourceArn: queue.queueArn,
    target: tsProcessLambda,
    batchSize: 1,
  });
  queue.grantConsumeMessages(tsProcessLambda);
  analyticsBucket.grantRead(tsProcessLambda);
  tsProcessLambda.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'TSBasicReadPermissions',
      effect: Effect.ALLOW,
      actions: ['timestream:DescribeEndpoints'],
      resources: ['*'],
    })
  );
  tsProcessLambda.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'TSWritePermissions',
      effect: Effect.ALLOW,
      actions: ['timestream:WriteRecords'],
      resources: [table.attrArn],
    })
  );

  // new cdk.CfnOutput(scope, name('AnalyticsBucket'), {
  //   description: 'Analytics Bucket',
  //   value: analyticsBucket.bucketName,
  // });
  // new cdk.CfnOutput(scope, name('FirehosePageViewsName'), {
  //   description: 'Firehose Page Views Name',
  //   value: firehosePageViews.deliveryStreamName!,
  // });
  // new cdk.CfnOutput(scope, name('FirehoseEventsName'), {
  //   description: 'Firehose Events Name',
  //   value: firehoseEvents.deliveryStreamName!,
  // });
  // new cdk.CfnOutput(scope, name('AnalyticsGlueDbName'), {
  //   description: 'Analytics Glue DB Name',
  //   value: glueDbName,
  // });

  // const cwBuckets: CwBucket[] = [{ bucket: analyticsBucket }];
  // const cwFirehoses: CwFirehose[] = [{ firehose: firehosePageViews }, { firehose: firehoseEvents }];

  return {
    dbName,
    tableName,
    tsFirehose,
    // observability: {
    //   cwBuckets,
    //   cwFirehoses,
    // },
  };
}
