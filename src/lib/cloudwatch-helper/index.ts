import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface CwLambda {
  alarm: {
    softErrorFilter?: logs.IFilterPattern;
    hardError: boolean;
  };
  func: lambda.Function;
}

export interface CwBucket {
  bucket: s3.Bucket;
}
export interface CwFirehose {
  firehose: CfnDeliveryStream;
}
export interface CwCloudFront {
  distribution: cloudfront.Distribution;
}

export * from './metrics';
export * from './alarms';
export * from './graph-widgets';
