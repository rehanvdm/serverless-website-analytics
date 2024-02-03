import { getS3Client } from '../../utils/lazy_aws';
import { S3Base } from '../../utils/s3_base';

export class S3PageViews extends S3Base {
  constructor(analyticsBucket: string) {
    const s3Client = getS3Client();
    super(s3Client, analyticsBucket);
  }

  sitePageViewPath(site: string, date: string) {
    return `page_views/site=${site}/page_opened_at_date=${date}`;
  }

  public async getAllSiteDateFiles(site: string, date: string) {
    const siteDatePrefix = this.sitePageViewPath(site, date);
    return this.getAllObjects(siteDatePrefix);
  }
}
