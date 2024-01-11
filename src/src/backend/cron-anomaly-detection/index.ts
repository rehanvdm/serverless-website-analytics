import {Context, ScheduledEvent} from 'aws-lambda';
import {LambdaLog} from '@backend/lib/utils/lambda_logger';
import {LambdaEnvironment} from '@backend/cron-anomaly-detection/environment';
import {AuditLog} from '@backend/lib/models/audit_log';
import {v4 as uuidv4} from 'uuid';
import {DateUtils} from '@backend/lib/utils/date_utils';
import {AthenaPageViews} from '@backend/lib/dal/athena/page_views';
import {evaluate, Record} from '@backend/cron-anomaly-detection/stat_functions';
import {EventBridgeAnalytics} from '@backend/lib/dal/eventbridge';

/* Lazy loaded variables */
let initialized = false;
export const logger = new LambdaLog();

async function getData(
  athenaPageViews: AthenaPageViews,
  eventDate: Date,
  sites: string[],
  seasonLength: number,
  fetchSeasons: number,
  evaluationWindow: number
) {
  const toDate = eventDate;
  const fromDate = DateUtils.addHours(toDate, -(seasonLength * fetchSeasons + evaluationWindow));
  return athenaPageViews.totalViewsPerHour(fromDate, toDate, sites);
}

export const handler = async (event: ScheduledEvent, context: Context): Promise<true> => {
  // logger.debug("EVENT", event);
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
    origin: 'swa/cron-anomaly-detection',
    run_time: 0,
    success: true,
    type: 'cron',
  };

  try {
    const athenaPageViews = new AthenaPageViews(
      LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
      LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
    );
    const eventBridgeAnalytics = new EventBridgeAnalytics(LambdaEnvironment.EVENT_BRIDGE_SOURCE);

    const seasonLength = 7 * 24; /* 7 days == 168 hours */
    const fetchSeasons = 2;

    /* Event time will always be the current hour, Firehose S3 Buffer Hint + 5 minutes
     * Take it as if it was for that hour */
    const eventDateLatest = new Date(DateUtils.parseIso(event.time).setMinutes(0, 0, 0));
    /* Over fetches data from `eventDateLatest` to `trainingSeasonLength` + `evaluationWindow` so that we only do 1 Athena query */
    const rawData = await getData(
      athenaPageViews,
      eventDateLatest,
      LambdaEnvironment.SITES,
      seasonLength,
      fetchSeasons,
      LambdaEnvironment.EVALUATION_WINDOW
    );

    const evaluations = evaluate(
      rawData,
      LambdaEnvironment.EVALUATION_WINDOW,
      eventDateLatest,
      seasonLength,
      fetchSeasons
    );
    const latestEvaluation = evaluations[evaluations.length - 1];

    if (!latestEvaluation.window) console.log('Evaluation window not full, not sending event');
    else {
      await eventBridgeAnalytics.putEvent({
        DetailType: latestEvaluation.window.alarm ? 'anomaly.page_view.alarm' : 'anomaly.page_view.ok',
        Detail: {
          ...latestEvaluation.window,
          evaluations,
        },
      });
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
