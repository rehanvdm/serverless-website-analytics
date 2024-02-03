import { ScheduledEvent, Context } from 'aws-lambda';
import { LambdaLog } from '../lib/utils/lambda_logger';
import { LambdaEnvironment } from './environment';
import { AuditLog } from '../lib/models/audit_log';
import { v4 as uuidv4 } from 'uuid';
import { DateUtils } from '../lib/utils/date_utils';
import { S3PageViews } from '../lib/dal/s3/page_views';
import { AthenaPageViews } from '../lib/dal/athena/page_views';
import { S3Events } from '../lib/dal/s3/events';
import { AthenaEvents } from '../lib/dal/athena/events';

/* Lazy loaded variables */
let initialized = false;
const logger = new LambdaLog();

type VacuumEntity = {
  name: string;
  getAllSiteDateFiles: (site: string, date: string) => Promise<{ key: string }[]>;
  rollupPageViews: (pageViewBucketName: string, site: string, date: string) => Promise<boolean>;
  deleteAllObjects: (keys: string[], concurrency?: number) => Promise<void>;
};
async function vacuum(vacuumEntity: VacuumEntity) {
  logger.info('Vacuuming', vacuumEntity.name);

  /* Always rollup the previous day (for now) */
  const previousDayDate = DateUtils.stringifyFormat(DateUtils.addDays(DateUtils.now(), -1), 'yyyy-MM-dd');

  for (const site of LambdaEnvironment.SITES) {
    const rawFiles = await vacuumEntity.getAllSiteDateFiles(site, previousDayDate);
    if (!rawFiles.length) {
      logger.info('No files to rollup', site, previousDayDate);
      continue;
    }

    logger.info('Starting rollup', site, previousDayDate, rawFiles.length);
    await vacuumEntity.rollupPageViews(LambdaEnvironment.ANALYTICS_BUCKET, site, previousDayDate);

    /* Get all files again, only if there are more files than before we started does it mean the rollup was successful
     * Considering that the rollup runs on the previous days data, nothing can be written to it via the Firehose
     * under normal circumstances. Therefore, this is thus a safe assumption for data protection , preventing data
     * deletion if the rollup failed. This is just extra safety as the CTAS query throws an error on failure */
    const allFilesPostRollup = await vacuumEntity.getAllSiteDateFiles(site, previousDayDate);
    if (allFilesPostRollup.length === rawFiles.length) {
      logger.error('Rollup failed ', site, previousDayDate);
      continue;
    }
    const rolledUpFileCount = allFilesPostRollup.length - rawFiles.length;
    const fileReductionPercent = Math.round((1 - rolledUpFileCount / rawFiles.length) * 100);
    logger.info(
      `Reduced file count from ${rawFiles.length} to ${rolledUpFileCount} a ${fileReductionPercent}% reduction`
    );

    logger.info('Deleting all raw files', rawFiles.length);
    await vacuumEntity.deleteAllObjects(rawFiles.map((f) => f.key));
  }
}

export const handler = async (event: ScheduledEvent, context: Context): Promise<true> => {
  // console.log("EVENT", event);
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

    const eventsBucket = new S3Events(LambdaEnvironment.ANALYTICS_BUCKET);
    const athenaEvents = new AthenaEvents(
      LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
      LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
    );

    const vacuumEntities: VacuumEntity[] = [
      {
        name: 'page',
        getAllSiteDateFiles: pageViewBucket.getAllSiteDateFiles.bind(pageViewBucket),
        rollupPageViews: athenaPageViews.rollupPageViews.bind(athenaPageViews),
        deleteAllObjects: pageViewBucket.deleteAllObjects.bind(pageViewBucket),
      },
      {
        name: 'event',
        getAllSiteDateFiles: eventsBucket.getAllSiteDateFiles.bind(eventsBucket),
        rollupPageViews: athenaEvents.rollupEvents.bind(athenaEvents),
        deleteAllObjects: eventsBucket.deleteAllObjects.bind(eventsBucket),
      },
    ];

    for (const vacuumEntity of vacuumEntities) {
      await vacuum(vacuumEntity);
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
