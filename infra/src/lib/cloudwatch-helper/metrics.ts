import * as assert from 'assert';
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { CwBucket, CwCloudFront, CwFirehose } from './index';

export namespace CwMetrics {
  export class S3 {
    static bucketSize(cwBucket: CwBucket, props?: Partial<cloudwatch.MetricProps>) {
      return new cloudwatch.Metric({
        namespace: 'AWS/S3',
        label: cwBucket.bucket.bucketName,
        metricName: 'BucketSizeBytes',
        dimensionsMap: { BucketName: cwBucket.bucket.bucketName, StorageType: 'StandardStorage' },
        statistic: 'Maximum',
        period: cdk.Duration.days(1),
        ...props,
      });
    }

    static objectCount(cwBucket: CwBucket, props?: Partial<cloudwatch.MetricProps>) {
      return new cloudwatch.Metric({
        namespace: 'AWS/S3',
        label: cwBucket.bucket.bucketName,
        metricName: 'NumberOfObjects',
        dimensionsMap: { BucketName: cwBucket.bucket.bucketName, StorageType: 'AllStorageTypes' },
        statistic: 'Maximum',
        period: cdk.Duration.days(1),
        ...props,
      });
    }
  }
  export class Firehose {
    static incomingRecords(cwFirehose: CwFirehose, props?: Partial<cloudwatch.MetricProps>) {
      assert.ok(cwFirehose.firehose.deliveryStreamName);
      return new cloudwatch.Metric({
        namespace: 'AWS/Firehose',
        label: cwFirehose.firehose.deliveryStreamName,
        metricName: 'IncomingRecords',
        dimensionsMap: { DeliveryStreamName: cwFirehose.firehose.deliveryStreamName },
        statistic: 'Sum',
        ...props,
      });
    }

    static deliveryToS3Success(cwFirehose: CwFirehose, props?: Partial<cloudwatch.MetricProps>) {
      assert.ok(cwFirehose.firehose.deliveryStreamName);
      return new cloudwatch.Metric({
        namespace: 'AWS/Firehose',
        label: cwFirehose.firehose.deliveryStreamName,
        metricName: 'DeliveryToS3.Success',
        dimensionsMap: { DeliveryStreamName: cwFirehose.firehose.deliveryStreamName },
        statistic: 'Average',
        ...props,
      });
    }

    static throttleRecords(cwFirehose: CwFirehose, props?: Partial<cloudwatch.MetricProps>) {
      assert.ok(cwFirehose.firehose.deliveryStreamName);
      return new cloudwatch.Metric({
        namespace: 'AWS/Firehose',
        label: cwFirehose.firehose.deliveryStreamName,
        metricName: 'ThrottledRecords',
        dimensionsMap: { DeliveryStreamName: cwFirehose.firehose.deliveryStreamName },
        statistic: 'Average',
        ...props,
      });
    }
  }

  export class CloudFront {
    static requests(cwCloudFront: CwCloudFront, props?: Partial<cloudwatch.MetricProps>) {
      return new cloudwatch.Metric({
        region: 'us-east-1',
        namespace: 'AWS/CloudFront',
        label: cwCloudFront.distribution.domainName,
        metricName: 'Requests',
        dimensionsMap: { Region: 'Global', DistributionId: cwCloudFront.distribution.distributionId },
        statistic: 'Sum',
        ...props,
      });
    }

    static errors4xxRate(cwCloudFront: CwCloudFront, props?: Partial<cloudwatch.MetricProps>) {
      return new cloudwatch.Metric({
        region: 'us-east-1',
        namespace: 'AWS/CloudFront',
        label: cwCloudFront.distribution.domainName,
        metricName: '4xxErrorRate',
        dimensionsMap: { Region: 'Global', DistributionId: cwCloudFront.distribution.distributionId },
        statistic: 'Average',
        ...props,
      });
    }

    static errors5xxRate(cwCloudFront: CwCloudFront, props?: Partial<cloudwatch.MetricProps>) {
      return new cloudwatch.Metric({
        region: 'us-east-1',
        namespace: 'AWS/CloudFront',
        label: cwCloudFront.distribution.domainName,
        metricName: '5xxErrorRate',
        dimensionsMap: { Region: 'Global', DistributionId: cwCloudFront.distribution.distributionId },
        statistic: 'Average',
        ...props,
      });
    }
  }
}
