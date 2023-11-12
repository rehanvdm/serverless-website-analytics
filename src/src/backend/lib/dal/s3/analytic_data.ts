import { getS3Client } from '@backend/lib/utils/lazy_aws';
import { S3Base } from '@backend/lib/utils/s3_base';

export class S3AnalyticData extends S3Base {
  constructor(analyticsBucket: string) {
    const s3Client = getS3Client();
    super(s3Client, analyticsBucket);
  }
}
