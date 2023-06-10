import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { CwBucket, CwCloudFront, CwFirehose, CwLambda, CwMetrics } from './index';

export namespace CwGraphWidgets {
  export class S3 {
    static bucketSize(cwBuckets: CwBucket[]) {
      return new cloudwatch.GraphWidget({
        title: 'S3 Bucket Size',
        left: cwBuckets.map((cwBucket) => CwMetrics.S3.bucketSize(cwBucket)),
      });
    }
    static objectCount(cwBuckets: CwBucket[]) {
      return new cloudwatch.GraphWidget({
        title: 'S3 Object Count',
        left: cwBuckets.map((cwBucket) => CwMetrics.S3.objectCount(cwBucket)),
      });
    }
  }

  export class Firehose {
    static incomingRecords(cwFirehoses: CwFirehose[]) {
      return new cloudwatch.GraphWidget({
        title: 'Firehose Incoming Records',
        left: cwFirehoses.map((cwFirehose) => CwMetrics.Firehose.incomingRecords(cwFirehose)),
      });
    }
    static deliveryToS3Success(cwFirehoses: CwFirehose[]) {
      return new cloudwatch.GraphWidget({
        title: 'Firehose Delivery To S3',
        left: cwFirehoses.map((cwFirehose) => CwMetrics.Firehose.deliveryToS3Success(cwFirehose)),
      });
    }
  }

  export class CloudFront {
    static requests(cwCloudFronts: CwCloudFront[]) {
      return new cloudwatch.GraphWidget({
        title: 'CloudFront Requests',
        left: cwCloudFronts.map((cwCloudFront) => CwMetrics.CloudFront.requests(cwCloudFront)),
      });
    }

    static errors4xxRate(cwCloudFronts: CwCloudFront[]) {
      return new cloudwatch.GraphWidget({
        title: 'CloudFront 4xx Error Rate',
        left: cwCloudFronts.map((cwCloudFront) => CwMetrics.CloudFront.errors4xxRate(cwCloudFront)),
      });
    }

    static errors5xxRate(cwCloudFronts: CwCloudFront[]) {
      return new cloudwatch.GraphWidget({
        title: 'CloudFront 5xx Error Rate',
        left: cwCloudFronts.map((cwCloudFront) => CwMetrics.CloudFront.errors5xxRate(cwCloudFront)),
      });
    }
  }

  export class Logs {
    static insightsLambdaErrors(
      accountId: string,
      lambdaNamePrefix: string,
      region: string,
      graphLambdas: CwLambda[]
    ): cloudwatch.LogQueryWidget {
      /* The execution log url is double encoded
         So a $25 is actually becomes % .. ehh  was something like that when I reverse engineered there logic. Here are
         the charters that need replacing below:
            $252F is /
            $255B$2524 is [$
            $255D is ]
       */
      let logNameStartsWith = accountId + ':/aws/lambda/' + lambdaNamePrefix;
      return new cloudwatch.LogQueryWidget({
        title: 'Lambda Errors (desc)',
        logGroupNames: graphLambdas.map((x) => x.func.logGroup.logGroupName),
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        width: 24,
        height: 12,
        queryString:
          "fields date, replace(@log, '" +
          logNameStartsWith +
          "', '') as Lambda, level, msg, \n" +
          " concat('https://" +
          region +
          '.console.aws.amazon.com/cloudwatch/home?region=' +
          region +
          "#logsV2:log-groups/log-group/$252Faws$252Flambda$252F',\n" +
          " substr(@log, 25), \"/log-events/\", replace(replace(replace (@logStream, '/', '$252F'), '[$' , '$255B$2524'), ']', '$255D'), \n" +
          " '$3FfilterPattern$3D$2522', traceId, '$2522') as `ExecutionLogsUrl (Triple click, right click open new tab)` \n" +
          '| filter level == "error" OR level == "warning"  \n' +
          '| sort @timestamp desc \n' +
          '| limit 100',
      });
    }
  }
}
