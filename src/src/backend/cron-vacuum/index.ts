import { ScheduledEvent, Context } from 'aws-lambda';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { LambdaEnvironment } from '@backend/cron-vacuum/environment';
import { AuditLog } from '@backend/lib/models/audit_log';
import { v4 as uuidv4 } from 'uuid';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { S3PageViews } from '@backend/lib/dal/s3/page_views';
import { AthenaPageViews } from '@backend/lib/dal/athena/page_views';

/* Lazy loaded variables */
let initialized = false;
export const handler = async (event: ScheduledEvent, context: Context): Promise<true> => {
  // console.log("EVENT", event);
  const logger = new LambdaLog();
  const shouldInitialize = !initialized || process.env.TESTING_LOCAL_RE_INIT === 'true';
  if (shouldInitialize) {
    LambdaEnvironment.init();
    logger.init(LambdaEnvironment.ENVIRONMENT);
    initialized = true;
  }

  LambdaEnvironment.TRACE_ID = context.awsRequestId;
  logger.start(LambdaEnvironment.LOG_LEVEL, LambdaEnvironment.TRACE_ID);
  // logger.info('Init', event);

  const audit: AuditLog = {
    app_version: LambdaEnvironment.VERSION,
    audit_log_id: uuidv4(),
    trace_id: LambdaEnvironment.TRACE_ID,
    created_at: DateUtils.stringifyIso(DateUtils.now()),
    environment: LambdaEnvironment.ENVIRONMENT,
    meta: '',
    origin: 'swa/cron-vacuum',
    run_time: 0,
    success: true,
    type: 'cron',
  };

  try {
    const pageViewBucket = new S3PageViews(LambdaEnvironment.ANALYTICS_BUCKET);
    const athenaPageViews = new AthenaPageViews(
      LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
      LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
    );

    /* Always rollup the previous day (for now) */
    const previousDayDate = DateUtils.stringifyFormat(DateUtils.addDays(DateUtils.now(), -1), 'yyyy-MM-dd');

    for (const site of LambdaEnvironment.SITES) {
      const rawFiles = await pageViewBucket.getAllSiteDateFiles(site, previousDayDate);
      if (!rawFiles.length) {
        logger.info('No files to rollup', site, previousDayDate);
        continue;
      }

      logger.info('Starting rollup', site, previousDayDate, rawFiles.length);
      await athenaPageViews.rollupPageViews(LambdaEnvironment.ANALYTICS_BUCKET, site, previousDayDate);

      /* Get all files again, only if there are more files than before we started does it mean the rollup was successful
       * Considering that the rollup runs on the previous days data, nothing can be written to it via the Firehose
       * under normal circumstances. Therefore, this is thus a safe assumption for data protection , preventing data
       * deletion if the rollup failed. This is just extra safety as the CTAS query throws an error on failure */
      const allFilesPostRollup = await pageViewBucket.getAllSiteDateFiles(site, previousDayDate);
      if (allFilesPostRollup.length === rawFiles.length) {
        logger.error('Rollup failed ', site, previousDayDate);
        continue;
      }

      logger.info('Deleting all raw files', rawFiles.length);
      await pageViewBucket.deleteAllObjects(rawFiles.map((f) => f.key));
    }

    audit.success = true;
  } catch (err) {
    /* Should ideally never happen, the tRPC Lambda Handler will catch any `throw new Error(...)` and still
     * return a response that has status code 500. This is just to cover all the basis. */
    if (err instanceof Error) {
      logger.error(err);
      audit.success = false;
      audit.status_description = err.message;
      audit.meta = JSON.stringify(err.message);
    } else {
      throw new Error('Error is unknown', { cause: err });
    }
  } finally {
    audit.run_time = LambdaEnvironment.TIMEOUT * 1000 - context.getRemainingTimeInMillis();
    logger.audit(audit);
  }

  return true;
};
