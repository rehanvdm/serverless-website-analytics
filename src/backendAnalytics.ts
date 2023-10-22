import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CfnRole, Effect } from 'aws-cdk-lib/aws-iam';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import * as logs from 'aws-cdk-lib/aws-logs';
import { CfnLogGroup } from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { SwaProps } from './index';
import { CwBucket, CwFirehose } from './lib/cloudwatch-helper';

const defaultFirehoseBufferInterval = 900;

export function backendAnalytics(scope: Construct, name: (name: string) => string, props: SwaProps) {
  /* ======================================================================= */
  /* ============ Glue DB, Bucket and Firehose required service  =========== */
  /* ======================================================================= */

  const analyticsBucket = new s3.Bucket(scope, name('bucket-analytics'), {
    bucketName: name('bucket-analytics'),
    autoDeleteObjects: true,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const firehoseDeliveryRole = new iam.Role(scope, name('bucket-analytic-firehose-role'), {
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
          new iam.PolicyStatement({
            sid: 'GluePermissions',
            effect: Effect.ALLOW,
            actions: ['glue:GetTable', 'glue:GetTableVersion', 'glue:GetTableVersions'],

            resources: [
              '*',
              //TODO: specifying specific version here failed... not sure why..
              // cdk.Arn.format({
              //   partition: "aws",
              //   account: props.props.awsEnv.account,
              //   region: props.props.awsEnv.region,
              //   service: "glue",
              //   resource: "table",
              //   resourceName: "*" //glueDbName + "/" + glueTableName
              // }),
            ],
          }),
        ],
      }),
    },
    assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
  });
  const logGroup = new logs.LogGroup(scope, name('bucket-analytic-firehose-log'), {
    logGroupName: name('bucket-analytic-firehose-log'),
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  logGroup.addStream(name('bucket-analytic-firehose-log-stream'), {
    logStreamName: 'logs',
  });
  logGroup.grantWrite(new iam.ServicePrincipal('firehose.amazonaws.com'));

  const glueDbName = name('db');
  const glueDb = new glue.CfnDatabase(scope, glueDbName, {
    catalogId: props.awsEnv.account,
    databaseInput: {
      name: glueDbName,
    },
  });

  /* ============================================================ */
  /* ============ Page Views - Glue Table and Firehose ========== */
  /* ============================================================ */

  const glueTablePageViewsName = 'page_views';
  const glueTablePageViews = new glue.CfnTable(scope, name(glueTablePageViewsName), {
    databaseName: glueDbName,
    catalogId: props.awsEnv.account,
    tableInput: {
      name: glueTablePageViewsName,
      tableType: 'EXTERNAL_TABLE',
      partitionKeys: [
        {
          name: 'site',
          type: 'string',
        },
        {
          name: 'page_opened_at_date',
          type: 'string',
        },
      ],
      storageDescriptor: {
        location: `s3://${analyticsBucket.bucketName}/page_views`,
        inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
        outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
        serdeInfo: {
          serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          // parameters: {
          //   'serialization.format': '1',
          // },
        },
        parameters: {
          'storage.location.template':
            's3://' +
            analyticsBucket.bucketName +
            '/page_views/site=${site}/page_opened_at_date=${page_opened_at_date}',
        },
        columns: [
          {
            name: 'user_id',
            type: 'string',
          },
          {
            name: 'session_id',
            type: 'string',
          },
          {
            name: 'page_id',
            type: 'string',
          },
          {
            name: 'page_url',
            type: 'string',
          },
          {
            name: 'page_opened_at',
            type: 'timestamp',
          },
          {
            name: 'time_on_page',
            type: 'int',
          },
          {
            name: 'country_iso',
            type: 'string',
          },
          {
            name: 'country_name',
            type: 'string',
          },
          {
            name: 'city_name',
            type: 'string',
          },
          {
            name: 'device_type',
            type: 'string',
          },
          {
            name: 'is_bot',
            type: 'boolean',
          },
          {
            name: 'utm_source',
            type: 'string',
          },
          {
            name: 'utm_medium',
            type: 'string',
          },
          {
            name: 'utm_campaign',
            type: 'string',
          },
          {
            name: 'utm_term',
            type: 'string',
          },
          {
            name: 'utm_content',
            type: 'string',
          },
          {
            name: 'querystring',
            type: 'string',
          },
          {
            name: 'referrer',
            type: 'string',
          },
        ],
      },
      parameters: {
        'projection.enabled': 'true',
        'projection.page_opened_at_date.type': 'date',
        'projection.page_opened_at_date.format': 'yyyy-MM-dd',
        'projection.page_opened_at_date.interval': '1',
        'projection.page_opened_at_date.interval.unit': 'DAYS',
        'projection.page_opened_at_date.range': '2023-01-01,NOW',
        'projection.site.type': 'enum',
        'projection.site.values': props.sites.join(','),
      },
    },
  });
  glueTablePageViews.addDependency(glueDb);

  const firehosePageViews = new CfnDeliveryStream(scope, name('analytic-page-views-firehose'), {
    deliveryStreamName: name('analytic-page-views-firehose'),
    extendedS3DestinationConfiguration: {
      cloudWatchLoggingOptions: {
        enabled: true,
        logGroupName: logGroup.logGroupName,
        logStreamName: 'logs',
      },
      bucketArn: analyticsBucket.bucketArn,
      roleArn: firehoseDeliveryRole.roleArn,
      prefix:
        'page_views/site=!{partitionKeyFromQuery:site}/page_opened_at_date=!{partitionKeyFromQuery:page_opened_at_date}/',
      errorOutputPrefix: 'error/!{firehose:error-output-type}/',
      bufferingHints: {
        intervalInSeconds: props.firehoseBufferInterval ?? defaultFirehoseBufferInterval,
      },
      dynamicPartitioningConfiguration: {
        enabled: true,
        retryOptions: {
          durationInSeconds: 0,
        },
      },
      processingConfiguration: {
        enabled: true,
        processors: [
          {
            type: 'MetadataExtraction',
            parameters: [
              {
                parameterName: 'MetadataExtractionQuery',
                parameterValue: '{site: .site, page_opened_at_date: .page_opened_at_date}',
              },
              //Required as property it seems
              {
                parameterName: 'JsonParsingEngine',
                parameterValue: 'JQ-1.6',
              },
            ],
          },
        ],
      },
      dataFormatConversionConfiguration: {
        enabled: true,
        inputFormatConfiguration: {
          deserializer: {
            openXJsonSerDe: {},
          },
        },
        outputFormatConfiguration: {
          serializer: {
            parquetSerDe: {
              compression: 'SNAPPY', //faster decompression than GZIP
            },
          },
        },
        schemaConfiguration: {
          catalogId: props.awsEnv.account,
          region: props.awsEnv.region,
          databaseName: glueDbName,
          tableName: glueTablePageViewsName,
          roleArn: firehoseDeliveryRole.roleArn,
        },
      },
    },
  });
  firehosePageViews.addDependency(firehoseDeliveryRole.node.defaultChild as CfnRole);
  firehosePageViews.addDependency(logGroup.node.defaultChild as CfnLogGroup);

  /* ============================================================= */
  /* ============ Event Times - Glue Table and Firehose ========== */
  /* ============================================================= */

  const glueTableEventsName = 'events';
  const glueTableEvents = new glue.CfnTable(scope, name(glueTableEventsName), {
    databaseName: glueDbName,
    catalogId: props.awsEnv.account,
    tableInput: {
      name: glueTableEventsName,
      tableType: 'EXTERNAL_TABLE',
      partitionKeys: [
        {
          name: 'site',
          type: 'string',
        },
        {
          name: 'tracked_at_date',
          type: 'string',
        },
      ],
      storageDescriptor: {
        location: `s3://${analyticsBucket.bucketName}/events`,
        inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
        outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
        serdeInfo: {
          serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
        },
        parameters: {
          'storage.location.template':
            's3://' + analyticsBucket.bucketName + '/events/site=${site}/tracked_at_date=${tracked_at_date}',
        },
        columns: [
          {
            name: 'user_id',
            type: 'string',
          },
          {
            name: 'session_id',
            type: 'string',
          },
          {
            name: 'category',
            type: 'string',
          },
          {
            name: 'event',
            type: 'string',
          },
          {
            name: 'tracked_at',
            type: 'timestamp',
          },
          {
            name: 'data',
            type: 'int',
          },
          {
            name: 'country_iso',
            type: 'string',
          },
          {
            name: 'country_name',
            type: 'string',
          },
          {
            name: 'city_name',
            type: 'string',
          },
          {
            name: 'device_type',
            type: 'string',
          },
          {
            name: 'is_bot',
            type: 'boolean',
          },
          {
            name: 'utm_source',
            type: 'string',
          },
          {
            name: 'utm_medium',
            type: 'string',
          },
          {
            name: 'utm_campaign',
            type: 'string',
          },
          {
            name: 'utm_term',
            type: 'string',
          },
          {
            name: 'utm_content',
            type: 'string',
          },
          {
            name: 'querystring',
            type: 'string',
          },
          {
            name: 'referrer',
            type: 'string',
          },
        ],
      },
      parameters: {
        'projection.enabled': 'true',
        'projection.tracked_at_date.type': 'date',
        'projection.tracked_at_date.format': 'yyyy-MM-dd',
        'projection.tracked_at_date.interval': '1',
        'projection.tracked_at_date.interval.unit': 'DAYS',
        'projection.tracked_at_date.range': '2023-01-01,NOW',
        'projection.site.type': 'enum',
        'projection.site.values': props.sites.join(','),
      },
    },
  });
  glueTableEvents.addDependency(glueDb);

  const firehoseEvents = new CfnDeliveryStream(scope, name('analytic-events-firehose'), {
    deliveryStreamName: name('analytic-events-firehose'),
    extendedS3DestinationConfiguration: {
      cloudWatchLoggingOptions: {
        enabled: true,
        logGroupName: logGroup.logGroupName,
        logStreamName: 'logs',
      },
      bucketArn: analyticsBucket.bucketArn,
      roleArn: firehoseDeliveryRole.roleArn,
      prefix:
        'events/site=!{partitionKeyFromQuery:site}/tracked_at_date=!{partitionKeyFromQuery:tracked_at_date}/',
      errorOutputPrefix: 'error/!{firehose:error-output-type}/',
      bufferingHints: {
        intervalInSeconds: props.firehoseBufferInterval ?? defaultFirehoseBufferInterval,
      },
      dynamicPartitioningConfiguration: {
        enabled: true,
        retryOptions: {
          durationInSeconds: 0,
        },
      },
      processingConfiguration: {
        enabled: true,
        processors: [
          {
            type: 'MetadataExtraction',
            parameters: [
              {
                parameterName: 'MetadataExtractionQuery',
                parameterValue: '{site: .site, tracked_at_date: .tracked_at_date}',
              },
              //Required as property it seems
              {
                parameterName: 'JsonParsingEngine',
                parameterValue: 'JQ-1.6',
              },
            ],
          },
        ],
      },
      dataFormatConversionConfiguration: {
        enabled: true,
        inputFormatConfiguration: {
          deserializer: {
            openXJsonSerDe: {},
          },
        },
        outputFormatConfiguration: {
          serializer: {
            parquetSerDe: {
              compression: 'SNAPPY', //faster decompression than GZIP
            },
          },
        },
        schemaConfiguration: {
          catalogId: props.awsEnv.account,
          region: props.awsEnv.region,
          databaseName: glueDbName,
          tableName: glueTableEventsName,
          roleArn: firehoseDeliveryRole.roleArn,
        },
      },
    },
  });
  firehoseEvents.addDependency(firehoseDeliveryRole.node.defaultChild as CfnRole);
  firehoseEvents.addDependency(logGroup.node.defaultChild as CfnLogGroup);

  new cdk.CfnOutput(scope, name('AnalyticsBucket'), {
    description: 'Analytics Bucket',
    value: analyticsBucket.bucketName,
  });
  new cdk.CfnOutput(scope, name('FirehosePageViewsName'), {
    description: 'Firehose Page Views Name',
    value: firehosePageViews.deliveryStreamName!,
  });
  new cdk.CfnOutput(scope, name('FirehoseEventsName'), {
    description: 'Firehose Events Name',
    value: firehoseEvents.deliveryStreamName!,
  });
  new cdk.CfnOutput(scope, name('AnalyticsGlueDbName'), {
    description: 'Analytics Glue DB Name',
    value: glueDbName,
  });

  const cwBuckets: CwBucket[] = [{ bucket: analyticsBucket }];
  const cwFirehoses: CwFirehose[] = [{ firehose: firehosePageViews }, { firehose: firehoseEvents }];

  return {
    glueDbName,
    glueTablePageViewsName,
    glueTableEventsName,
    analyticsBucket,
    firehosePageViews,
    firehoseEvents,
    observability: {
      cwBuckets,
      cwFirehoses,
    },
  };
}
