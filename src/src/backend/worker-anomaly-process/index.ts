import { Context, EventBridgeEvent } from 'aws-lambda';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { LambdaEnvironment } from '@backend/worker-anomaly-process/environment';
import { AuditLog } from '@backend/lib/models/audit_log';
import { v4 as uuidv4 } from 'uuid';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { AthenaPageViews } from '@backend/lib/dal/athena/page_views';
import { EbPageViewAnomalyOk, EbPageViewAnomalyAlarm } from '@backend/lib/dal/eventbridge/events/anomaly.page_view';
import { EbAnalyticsEntryToEventBridgeEvent } from '@backend/lib/dal/eventbridge';

/* Lazy loaded variables */
let initialized = false;
const logger = new LambdaLog();

type Event =
  | EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyOk>
  | EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyAlarm>;

export const handler = async (event: Event, context: Context): Promise<true> => {
  const shouldInitialize = !initialized || process.env.TESTING_LOCAL_RE_INIT === 'true';
  if (shouldInitialize) {
    LambdaEnvironment.init();
    logger.init(LambdaEnvironment.ENVIRONMENT);
    initialized = true;
  }
  logger.debug('EVENT', event);

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
    origin: 'swa/worker-anomaly-process',
    run_time: 0,
    success: true,
    type: 'cron',
  };

  try {
    const athenaPageViews = new AthenaPageViews(
      LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
      LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
    );

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
