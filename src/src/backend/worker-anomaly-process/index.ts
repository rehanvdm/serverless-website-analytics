import { Context } from 'aws-lambda';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { LambdaEnvironment } from '@backend/worker-anomaly-process/environment';
import { AuditLog } from '@backend/lib/models/audit_log';
import { v4 as uuidv4 } from 'uuid';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { EbPageViewAnomalyOk, EbPageViewAnomalyAlarm } from '@backend/lib/dal/eventbridge/events/anomaly.page_view';
import { EbAnalyticsEntryToEventBridgeEvent } from '@backend/lib/dal/eventbridge';
import { Sns } from '@backend/lib/dal/sns';
import { Evaluation } from '@backend/cron-anomaly-detection/stat_functions';

/* Lazy loaded variables */
let initialized = false;
const logger = new LambdaLog();

type Event =
  | EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyOk>
  | EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyAlarm>;

export function visualizeEvaluations(evaluations: Evaluation[]) {
  const predicted = evaluations.map((e) => Math.round(e.breachingThreshold));
  const actual = evaluations.map((e) => e.value);

  const columns = 30;
  const max = Math.max(...predicted, ...actual);
  const maxValue = Math.max(...actual);
  const maxPredicted = Math.max(...predicted);
  const maxValueLength = maxValue.toString().length;
  const maxPredictedLength = maxPredicted.toString().length;

  const stepSize = max / columns;
  const snapValueToStep = (value: number) => {
    return Math.round(value / stepSize);
  };

  const canvas: string[] = [];
  for (const evaluation of evaluations) {
    const valueColumn = snapValueToStep(evaluation.value);
    const breachingColumn = snapValueToStep(evaluation.breachingThreshold);

    const chartRow = Array.from({ length: columns }).fill(' ');
    for (let chartColumn = 0; chartColumn < columns; chartColumn++) {
      if (chartColumn < valueColumn) chartRow[chartColumn] = '=';

      if (chartColumn === breachingColumn) chartRow[chartColumn] = evaluation.breached ? '#' : '|';
    }
    canvas.push(
      '  ' +
        evaluation.date.slice(0, 10) +
        ' ' +
        evaluation.date.slice(11, 13) +
        ':00' +
        ' ' +
        evaluation.value.toString().padStart(maxValueLength, '0') +
        ' (' +
        Math.round(evaluation.breachingThreshold).toString().padStart(maxPredictedLength, '0') +
        ') ' +
        chartRow.join('')
    );
  }
  return canvas.join('\n');
}

function alamrMessage(event: Event) {
  let status = '';
  const dateTime = event.detail.evaluations[0].date;
  let message = '';

  if (event.detail.state === 'ALARM_WINDOW_BREACHED') {
    status = 'ALARM_WINDOW_BREACHED';
    message = `${LambdaEnvironment.EVALUATION_WINDOW} Out of ${LambdaEnvironment.EVALUATION_WINDOW} data points have breached the predicted threshold.`;
  } else if (event.detail.state === 'ALARM_LATEST_EVALUATION_SPIKE') {
    status = 'ALARM_LATEST_EVALUATION_SPIKE';
    message =
      'The latest evaluation was more than 2 times the predicted threshold, big spikes make the evaluation window irrelevant.';
  } else if (event.detail.state === 'OK') {
    status = 'OKAY';
    message = 'The Anomaly is over and traffic returned back to normal.';
  }

  return (
    'STATUS: ' +
    status +
    '\n\n' +
    'DATE: ' +
    dateTime +
    '\n\n' +
    'MESSAGE: ' +
    message +
    '\n\n' +
    'EVALUATIONS: \n' +
    '  Columns: Date Time Value (Breach threshold) Chart\n' +
    '  Legend: \n' +
    '  - `=` Page view \n' +
    '  - `|` Anomaly breaching threshold - Okay \n' +
    '  - `#` Anomaly breaching threshold - Breached \n\n' +
    visualizeEvaluations(event.detail.evaluations) +
    '\n\n' +
    'RAW: ' +
    JSON.stringify(event.detail.evaluations, null, 4)
  );
}

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
    let transitionedTo: 'NONE' | 'ALARM' | 'OK' = 'NONE';
    if (!event.detail.evaluations[1].window!.alarm && event.detail.evaluations[0].window!.alarm)
      transitionedTo = 'ALARM';
    else if (event.detail.evaluations[1].window!.alarm && !event.detail.evaluations[0].window!.alarm)
      transitionedTo = 'OK';

    if (transitionedTo !== 'NONE' && LambdaEnvironment.ALERT_ON_ALARM) {
      const alertSns = new Sns(LambdaEnvironment.ALERT_TOPIC_ARN);

      if (
        transitionedTo === 'ALARM' &&
        (event.detail.state === 'ALARM_WINDOW_BREACHED' || event.detail.state === 'ALARM_LATEST_EVALUATION_SPIKE')
      ) {
        logger.debug('Publishing alert - Alarm');
        const message = alamrMessage(event);
        await alertSns.publishCommand({
          Subject: 'Page View Anomaly Alarm',
          Message: message,
        });
      } else if (transitionedTo === 'OK' && event.detail.state === 'OK') {
        logger.debug('Publishing alert - Ok');
        const message = alamrMessage(event);
        await alertSns.publishCommand({
          Subject: 'Page View Anomaly Okay',
          Message: message,
        });
      } else {
        logger.debug('Not publishing alert');
      }
    } else {
      logger.debug('Not publishing alert, not transitioning or alerting disabled');
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
