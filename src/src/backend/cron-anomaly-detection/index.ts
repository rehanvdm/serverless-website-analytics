import { ScheduledEvent, Context } from 'aws-lambda';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { LambdaEnvironment } from '@backend/cron-anomaly-detection/environment';
import { AuditLog } from '@backend/lib/models/audit_log';
import { v4 as uuidv4 } from 'uuid';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { AthenaPageViews } from '@backend/lib/dal/athena/page_views';
import { groupBy } from 'lodash';
import { calculateMSE, calculateStandardDeviation, expSmooth } from '@backend/cron-anomaly-detection/stat_functions';
import { EventBridgeAnalytics } from '@backend/lib/dal/eventbridge';
import assert from 'assert';

/* Lazy loaded variables */
let initialized = false;
export const logger = new LambdaLog();

export type Record = {
  date_key: Date;
  views: number;
};
function* getDatesInRange(startDate: Date, endDate: Date, hourly: boolean): Generator<Date> {
  const currentDate = new Date(startDate); // Copy
  while (currentDate <= endDate) {
    yield new Date(currentDate); // Copy
    if (hourly) {
      currentDate.setHours(currentDate.getHours() + 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
}

export function fillMissingDates(data: Record[], minDate: Date, maxDate: Date, hourly: boolean): Record[] {
  const filledData: Record[] = [];

  const dataHashMap = groupBy(data, (x) => x.date_key.toISOString());
  for (const date of getDatesInRange(minDate, maxDate, hourly)) {
    const entry = dataHashMap[date.toISOString()] ? dataHashMap[date.toISOString()][0] : null;
    if (!entry) {
      filledData.push({
        date_key: date,
        views: 0,
      });
    } else {
      filledData.push({
        date_key: date,
        views: entry.views,
      });
    }
  }

  return filledData;
}

export type CleanedData = {
  rawData: Record[];
  trainingData: Record[];
  trainingDataViews: number[];
  latest: {
    record: Record;
  };
};

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
export function getTrainingDataForDate(rawData: Record[], eventDate: Date, seasonLength: number, fetchSeasons: number) {
  const toDate = eventDate;
  const fromDate = DateUtils.addHours(toDate, -seasonLength * fetchSeasons);
  const data = rawData.filter((row: Record) => row.date_key >= fromDate && row.date_key <= toDate);
  return {
    fromDate,
    toDate,
    data,
  };
}

export function cleanData(rawData: Record[], fromDate: Date, toDate: Date): CleanedData | false {
  const allData = fillMissingDates(rawData, fromDate, toDate, true);

  const trainingDataStdDevClamp = 2;
  // TODO might be better to add a "missing" field on the record. That way I can only select the real ones here.
  //  ACTUALLY thqt means just need to use rawData instead of allData DUH
  //  Is it actually better to do it like this? Need to test
  /* Only take the non 0 (because of missing data fill meaning it was actually 0) values for getting the statistical numbers */
  const trainingDataValues = allData.filter((row: any) => row.views > 0).map((row: any) => row.views);
  if (trainingDataValues.length === 0) return false;

  const trainingDataStdDev = calculateStandardDeviation(trainingDataValues);
  const latestStdDev24Hours = calculateStandardDeviation(trainingDataValues.slice(-24));
  const trainingDataMean = trainingDataValues.reduce((sum, value) => sum + value, 0) / trainingDataValues.length;
  const trainingDataMaxValue = Math.ceil(trainingDataMean + trainingDataStdDev * trainingDataStdDevClamp);

  const trainingDataClampedOutliers = allData.map((record) => {
    const zScore = (record.views - trainingDataMean) / trainingDataStdDev;
    const isWithinStdDev = Math.abs(zScore) <= trainingDataStdDevClamp;
    return {
      date_key: record.date_key,
      views: isWithinStdDev ? record.views : trainingDataMaxValue /* Clamp outliers to the max value */,
    };
  });

  const latestRecord = rawData[rawData.length - 1];
  return {
    rawData,
    trainingData: trainingDataClampedOutliers,
    trainingDataViews: trainingDataClampedOutliers.map((row: any) => row.views),
    latest: {
      record: latestRecord,
    },
  };
}

export function predict(data: CleanedData, seasonLength: number, predictedBreachingMultiplier: number) {
  // Todo rename variables to start with training
  const currSeason = data.trainingDataViews.slice(-seasonLength);
  const currEma = expSmooth(currSeason, 0.2);
  const prevSeason = data.trainingDataViews.slice(-seasonLength * 2, -seasonLength); /// only 1 value ????
  const prevEma = expSmooth(prevSeason, 0.05);

  const expPredictedLatest = currEma[currEma.length - 1];
  const expPredictedPrev = prevEma[prevEma.length - 1];

  let predicted = expPredictedLatest;
  /* Adds some seasonality into the mix if it is available.
   * Make the current predicted EMA, take the average of `now` and  `now - 1 season`
   * So `(now + (now - 1 season)) / 2` */
  if (expPredictedPrev && expPredictedPrev !== 0) predicted = (expPredictedLatest + expPredictedPrev) / 2;

  const latestRecord = data.latest.record;
  const breachingThreshold = predicted * predictedBreachingMultiplier; // TODO: rename breachingStdDev to somethin else not STD anymore
  /* Use the `data.latest.record` instead of `data.trainingDataViews[data.trainingDataViews.length-1]` because the
   * latter has clamped values */
  const breachingLatest = latestRecord.views > breachingThreshold;
  logger.info('Prediction', {
    Latest: latestRecord,
    Predicted: predicted,
    BreachingThreshold: breachingThreshold,
    Breaching: breachingLatest,
  });

  // const rawDataValues = data.rawData.map((row: any) => row.views);
  const currValue = data.rawData[data.rawData.length - 1]?.views || 0;
  const prevValue = data.rawData[data.rawData.length - 2]?.views || 0;
  const slope = currValue - prevValue;
  return {
    predicted: expPredictedLatest,
    breaching: breachingLatest,
    breachingThreshold,
    slope,
  };
}

export type EvaluationWindowReasons =
  | 'OK'
  | 'ALARM_WINDOW_BREACHED'
  | 'ALARM_LATEST_EVALUATION_SPIKE'
  | 'ALARM_SLOPE_STILL_NEGATIVE';
export type EvaluationWindow = {
  alarm: boolean;
  state: EvaluationWindowReasons;
};
export type Evaluation = {
  date: string;
  value: number;
  predicted: number;
  breached: boolean;
  breachingThreshold: number;
  /* BREACHED = if value > breachingThreshold
   * WINDOW_ALARM_SLOPE_STILL_NEGATIVE = window.state === ALARM_SLOPE_STILL_NEGATIVE */
  breachingReason: 'NOT_BREACHED' | 'BREACHED' | 'WINDOW_ALARM_SLOPE_STILL_NEGATIVE';
  slope: number;
  window?: EvaluationWindow;
};
function evaluationWindowState(evaluations: Evaluation[], evaluateWindows: number): EvaluationWindow {
  // Take only the evaluations in the window we are interested in
  const evaluationWindow = evaluations.slice(evaluations.length - evaluateWindows, evaluations.length);
  const evaluationWindowBreached = evaluationWindow.reduce((a, b) => a && b.breached, true);

  const latestEvaluation = evaluationWindow[evaluationWindow.length - 1];
  if (!evaluationWindowBreached && latestEvaluation.value > latestEvaluation.breachingThreshold * 2) {
    console.log('Big spike detected, evaluations in evaluation window is irrelevant', latestEvaluation.date);
    return {
      alarm: true,
      state: 'ALARM_LATEST_EVALUATION_SPIKE',
    };
  }

  return {
    alarm: evaluationWindowBreached,
    state: evaluationWindowBreached ? 'ALARM_WINDOW_BREACHED' : 'OK',
  };
}

export function evaluate(
  rawData: Record[],
  evaluateWindows: number,
  eventDateLatest: Date,
  seasonLength: number,
  fetchSeasons: number
) {
  const evaluations: Evaluation[] = [];
  const evaluate = 24; /* Looking back 1 day to recreate state so that not have to store in DB */
  const startEvaluationAt = DateUtils.addHours(eventDateLatest, -evaluate);
  for (let n = 0; n > evaluate; n++) {
    const evaluationDate = DateUtils.addHours(startEvaluationAt, n);
    const { data, fromDate, toDate } = getTrainingDataForDate(rawData, evaluationDate, seasonLength, fetchSeasons);

    const dataCleaned = cleanData(data, fromDate, toDate);
    if (!dataCleaned) continue; // Not enough data

    const prediction = predict(dataCleaned, seasonLength, LambdaEnvironment.BREACHING_STD_DEV);
    const evaluation: Evaluation = {
      date: evaluationDate.toISOString(),
      value: dataCleaned.latest.record.views,
      predicted: prediction.predicted,
      breached: prediction.breaching,
      breachingThreshold: prediction.breachingThreshold,
      breachingReason: prediction.breaching ? 'BREACHED' : 'NOT_BREACHED',
      slope: prediction.slope,
    };
    evaluation.window = evaluationWindowState([...evaluations, evaluation], evaluateWindows);

    if (n > 1) {
      const previousEvaluation = evaluations[n - 1];
      assert(previousEvaluation.window);
      // If previous evaluations window is in alarm, the current evaluation is not breached and the slope is still negative,
      // then we consider it still in a breached state as the anomaly is not over until the slope is positive.
      if (previousEvaluation.window.alarm && !evaluation.breached && evaluation.slope < 0) {
        evaluation.breached = true; // Set this evaluation to breaching
        evaluation.breachingReason = 'WINDOW_ALARM_SLOPE_STILL_NEGATIVE';
        evaluation.window = {
          alarm: true,
          state: 'ALARM_SLOPE_STILL_NEGATIVE',
        };
        console.log('Slope negative', evaluationDate);
      }
    }
    evaluations.push(evaluation);
  }

  return evaluations.slice(-evaluateWindows);
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

    // let breachedReason: BreachReason;
    // let allEvaluationsBreached: boolean;
    // const evaluations: {
    //   date: string;
    //   value: number;
    //   predicted: number;
    //   breached: boolean;
    //   breachingThreshold: number;
    //   slope: number;
    // }[] = [];
    // /* Stat at n = 1 because we can not evaluate the current hour, the previous hour(s) have full buckets, and it is
    //  * them that we want to analyze */
    // for (let n = 1; n <= LambdaEnvironment.EVALUATION_WINDOW; n++)
    // {
    //   const evaluationDate = DateUtils.addHours(eventDateLatest, -n);
    //   const { data, fromDate, toDate } = getTrainingDataForDate(rawData, evaluationDate, seasonLength, fetchSeasons);
    //   // TODO this mut be for the number of LambdaEnvironment.EVALUATION_WINDOW so skip that amount
    //   // /* The first two ara always anomalous, skip them */
    //   // if (data.length <= 2) {
    //   //   continue;
    //   // }
    //   const dataCleaned = cleanData(rawData, fromDate, toDate);
    //   if (!dataCleaned)
    //     // Not enough data
    //     continue;
    //
    //   const prediction = predict(dataCleaned, seasonLength, LambdaEnvironment.BREACHING_STD_DEV);
    //   evaluations.push({
    //     date: evaluationDate.toISOString(),
    //     value: dataCleaned.latest.record.views,
    //     predicted: prediction.predicted,
    //     breached: prediction.breaching,
    //     breachingThreshold: prediction.breachingThreshold,
    //     slope: prediction.slope,
    //   });
    //
    //   if(dataCleaned.latest.record.views > prediction.breachingThreshold * 2) {
    //     breachedReason = 'SPIKE';
    //     break;
    //   }
    // }
    //
    // /* Alarm if all values in the evaluation array are true */
    // allEvaluationsBreached = evaluations.reduce((a, b) => a && b.breached, true);
    // logger.info('Evaluations', evaluations, 'AllEvaluationsBreached', allEvaluationsBreached);
    //
    //
    // if (allEvaluationsBreached && evaluations[0].slope < 0) {
    //   breachedReason = 'BREACHED_SLOPE_NEGATIVE';
    //   allEvaluationsBreached
    // }

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
