import { DateUtils } from '@backend/lib/utils/date_utils';
import { LambdaEnvironment } from '@backend/cron-anomaly-detection/environment';
import assert from 'assert';
import { groupBy } from 'lodash';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';

const logger = new LambdaLog();

export type Record = {
  date_key: Date;
  views: number;
};

export type CleanedData = {
  /* Actual values */
  rawData: Record[];
  /* Missing values filled in and maximum values clamped */
  trainingData: Record[];
  /* Array of trainingData views property */
  trainingDataViews: number[];
  /* The latest value */
  latest: {
    record: Record;
  };
};

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

// =====================================================================================================================
// =============================================== Data Functions ======================================================
// =====================================================================================================================
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
// =====================================================================================================================
// =====================================================================================================================
// =====================================================================================================================

export function calculateStandardDeviation(data: number[]): number {
  const n = data.length;
  if (n === 0) throw new Error('Input array is empty');

  const mean = data.reduce((sum, value) => sum + value, 0) / n;
  const sumSquaredDifferences = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0);
  return Math.sqrt(sumSquaredDifferences / n);
}

export const expSmooth = (data: number[], alpha: number) => {
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
};

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
  const breachingThreshold = predicted * predictedBreachingMultiplier;
  /* Use the `data.latest.record` instead of `data.trainingDataViews[data.trainingDataViews.length-1]` because the
   * latter has clamped values */
  const breachingLatest = latestRecord.views > breachingThreshold;
  logger.debug('Prediction', {
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

  for (let n = 0; n < evaluate; n++) {
    const evaluationDate = DateUtils.addHours(startEvaluationAt, n); // TODO think +1 here, else won't have the first value on first itteration
    const { data, fromDate, toDate } = getTrainingDataForDate(rawData, evaluationDate, seasonLength, fetchSeasons);

    const dataCleaned = cleanData(data, fromDate, toDate);
    if (!dataCleaned) continue; // Not enough data

    const prediction = predict(dataCleaned, seasonLength, LambdaEnvironment.BREACHING_MULTIPLIER);
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
      if (previousEvaluation && previousEvaluation.window) {
        // If previous evaluations window is in alarm, the current evaluation is not breached and the slope is still negative,
        // then we consider it still in a breached state as the anomaly is not over until the slope is positive.
        if (previousEvaluation.window.alarm && !evaluation.breached && evaluation.slope < 0) {
          evaluation.breached = true; // Set this evaluation to breaching
          evaluation.breachingReason = 'WINDOW_ALARM_SLOPE_STILL_NEGATIVE';
          evaluation.window = {
            alarm: true,
            state: 'ALARM_SLOPE_STILL_NEGATIVE',
          };
          logger.info('Slope negative', evaluationDate);
        }
      }
    }
    evaluations.push(evaluation);
  }

  logger.info('Evaluations', evaluations);

  return evaluations.slice(-evaluateWindows);
}
