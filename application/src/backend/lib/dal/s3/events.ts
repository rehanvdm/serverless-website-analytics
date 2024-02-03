import { getS3Client } from '../../utils/lazy_aws';
import { S3Base } from '../../utils/s3_base';

export class S3Events extends S3Base {
  constructor(analyticsBucket: string) {
    const s3Client = getS3Client();
    super(s3Client, analyticsBucket);
  }

  siteEventPath(site: string, date: string) {
    return `events/site=${site}/tracked_at_date=${date}`;
  }

  public async getAllSiteDateFiles(site: string, date: string) {
    const siteDatePrefix = this.siteEventPath(site, date);
    return this.getAllObjects(siteDatePrefix);
  }
}
