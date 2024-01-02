import { ScheduledEvent, Context } from 'aws-lambda';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { LambdaEnvironment } from '@backend/cron-anomaly-detection/environment';
import { AuditLog } from '@backend/lib/models/audit_log';
import { v4 as uuidv4 } from 'uuid';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { AthenaPageViews } from '@backend/lib/dal/athena/page_views';
// import {DynamoDbAnalytics, PageHistory, PageHistoryCreateEntityItem, PageHistoryItem} from '@backend/lib/dal/dynamodb/analytics';
import { groupBy } from 'lodash';
import { calculateMSE, calculateStandardDeviation } from '@backend/cron-anomaly-detection/stat_functions';
import { nelderMeadOptimization } from '@backend/cron-anomaly-detection/nelder_mead_optimization';
import { holtWintersForecast } from '@backend/cron-anomaly-detection/holt_winters_forecast';
import { EventBridgeAnalytics } from '@backend/lib/dal/eventbridge';

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
  trainingData: Record[];
  trainingDataViews: number[];
  latest: {
    stdDevDev24Hours: number;
    record: Record;
  };
};

async function getData(
  athenaPageViews: AthenaPageViews,
  eventDate: Date,
  sites: string[],
  seasonLength: number,
  evaluationWindow: number
) {
  const toDate = eventDate;
  const fromDate = DateUtils.addHours(toDate, -(seasonLength + evaluationWindow));
  return athenaPageViews.totalViewsPerHour(fromDate, toDate, sites);
}
export function getTrainingDataForDate(rawData: Record[], eventDate: Date, seasonLength: number) {
  const toDate = eventDate;
  const fromDate = DateUtils.addHours(toDate, -seasonLength);

  const data = rawData.filter((row: Record) => row.date_key >= fromDate && row.date_key <= toDate);

  return {
    fromDate,
    toDate,
    data,
  };
}

export function cleanData(rawData: Record[], fromDate: Date, toDate: Date): CleanedData {
  const allData = fillMissingDates(rawData, fromDate, toDate, true);

  const trainingData = allData.slice(0, -1);
  const latestRecord = allData.slice(-1)[0];

  const trainingDataStdDevClamp = 2;
  const trainingDataValues = trainingData.map((row: any) => row.views);
  const trainingDataStdDev = calculateStandardDeviation(trainingDataValues);
  const latestStdDev24Hours = calculateStandardDeviation(trainingDataValues.slice(-24));

  const trainingDataMean = trainingDataValues.reduce((sum, value) => sum + value, 0) / trainingDataValues.length;
  const trainingDataMaxValue = Math.ceil(trainingDataMean + trainingDataStdDev * trainingDataStdDevClamp);
  // logger.debug("trainingDataStdDev", trainingDataStdDev);
  // logger.debug("trainingDataMean", trainingDataMean);
  // logger.debug("trainingDataMaxValue", trainingDataMaxValue);

  /* The training data needs to be clamped to prevent a heavy downwards trend prediction from the Holt-Winter prediction */
  const trainingDataClampedOutliers = trainingData.map((record) => {
    const zScore = (record.views - trainingDataMean) / trainingDataStdDev;
    const isWithinStdDev = Math.abs(zScore) <= trainingDataStdDevClamp;

    return {
      date_key: record.date_key,
      views: isWithinStdDev ? record.views : trainingDataMaxValue /* Clamp outliers to the max value */,
    };
  });

  return {
    trainingData: trainingDataClampedOutliers,
    trainingDataViews: trainingDataClampedOutliers.map((row: any) => row.views),
    latest: {
      stdDevDev24Hours: latestStdDev24Hours,
      record: latestRecord,
    },
  };
}

function train(trainingDataViews: number[], seasonLength: number) {
  function objectFunction(params: number[]) {
    const result = holtWintersForecast(
      trainingDataViews,
      params[0],
      params[1],
      params[2],
      seasonLength,
      trainingDataViews.length
    );
    return calculateMSE(trainingDataViews, result.forecast);
  }

  const initialPoints = [
    // [0.3, 0.3, 0.3],
    // [0,0,0],
    // [1, 1, 1],

    [0.1, 0.1, 0.1, 0.1],
    [0.25, 0.25, 0.25, 0.25],
    [0.5, 0.5, 0.5, 0.5],
    [1, 1, 1, 1],

    // [0.1,0.1,0.1],
    // [0.25,0.25,0.25,],
    // [0.5,0.5,0.5,],
    // [1, 1, 1,],
  ];

  // 1e-6
  const trainingResult = nelderMeadOptimization(objectFunction, initialPoints, 0.001, 1000);
  return {
    alpha: trainingResult.coordinates[0],
    beta: trainingResult.coordinates[1],
    gamma: trainingResult.coordinates[2],
  };
}

function train2(trainingDataViews: number[], seasonLength: number) {
  function objectFunction(params: number[]) {
    const result = holtWintersForecast(
      trainingDataViews,
      params[0],
      params[1],
      params[2],
      seasonLength,
      trainingDataViews.length
    );
    return calculateMSE(trainingDataViews, result.forecast);
  }

  interface Point {
    coordinates: number[];
    value: number;
  }

  class Simplex {
    points: Point[];

    constructor(dimensions: number, initialValue: number) {
      this.points = Array.from({ length: dimensions + 1 }, () => ({
        coordinates: Array.from({ length: dimensions }, () => initialValue),
        value: 0,
      }));
    }

    get highest(): Point {
      return this.points.reduce((acc, point) => (point.value > acc.value ? point : acc), this.points[0]);
    }

    get secondHighest(): Point {
      const highest = this.highest;
      return this.points.reduce(
        (acc, point) => (point.value > acc.value && point !== highest ? point : acc),
        this.points[0]
      );
    }

    get lowest(): Point {
      return this.points.reduce((acc, point) => (point.value < acc.value ? point : acc), this.points[0]);
    }
  }

  function nelderMead(
    objectiveFunction: (coordinates: number[]) => number,
    initialGuess: number[],
    tolerance: number,
    maxIterations: number
  ): number[] {
    const dimensions = initialGuess.length;
    const simplex = new Simplex(dimensions, 0.5);
    simplex.points[0].coordinates = initialGuess;
    simplex.points[0].value = objectiveFunction(initialGuess);

    for (let i = 1; i <= dimensions; i++) {
      const perturbedPoint = [...initialGuess];
      perturbedPoint[i - 1] += 1.0;
      simplex.points[i].coordinates = perturbedPoint;
      simplex.points[i].value = objectiveFunction(perturbedPoint);
    }

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      simplex.points.sort((a, b) => a.value - b.value);

      const highest = simplex.highest;
      const secondHighest = simplex.secondHighest;
      const lowest = simplex.lowest;

      const reflection = {
        coordinates: [],
        value: 0,
      };

      for (let i = 0; i < dimensions; i++) {
        reflection.coordinates[i] = highest.coordinates[i] + (highest.coordinates[i] - secondHighest.coordinates[i]);
      }

      reflection.value = objectiveFunction(reflection.coordinates);

      if (reflection.value < lowest.value) {
        const expansion = {
          coordinates: [],
          value: 0,
        };

        for (let i = 0; i < dimensions; i++) {
          expansion.coordinates[i] = highest.coordinates[i] + 2 * (reflection.coordinates[i] - highest.coordinates[i]);
        }

        expansion.value = objectiveFunction(expansion.coordinates);

        if (expansion.value < reflection.value) {
          simplex.points[simplex.points.indexOf(highest)] = expansion;
        } else {
          simplex.points[simplex.points.indexOf(highest)] = reflection;
        }
      } else {
        if (reflection.value < secondHighest.value) {
          simplex.points[simplex.points.indexOf(highest)] = reflection;
        }

        const contraction = {
          coordinates: [],
          value: 0,
        };

        for (let i = 0; i < dimensions; i++) {
          contraction.coordinates[i] =
            highest.coordinates[i] +
            0.5 * (simplex.points[simplex.points.indexOf(highest)].coordinates[i] - highest.coordinates[i]);
        }

        contraction.value = objectiveFunction(contraction.coordinates);

        if (contraction.value < highest.value) {
          simplex.points[simplex.points.indexOf(highest)] = contraction;
        } else {
          for (let i = 0; i < dimensions; i++) {
            simplex.points[i].coordinates = simplex.points[
              lowest.value === simplex.points[i].value ? i : 0
            ].coordinates.map(
              (coordinate, index) =>
                0.5 * (coordinate + simplex.points[lowest.value === simplex.points[i].value ? i : 0].coordinates[index])
            );
            simplex.points[i].value = objectiveFunction(simplex.points[i].coordinates);
          }
        }
      }

      const maxDiff = Math.max(...simplex.points.map((point) => Math.abs(point.value - lowest.value)));

      if (maxDiff < tolerance) {
        return simplex.lowest.coordinates;
      }
    }

    return simplex.lowest.coordinates;
  }

  // // Example usage:
  // //   const objectiveFunction = (x: number[]) => x.reduce((sum, val) => sum + val ** 2, 0); // Example: Minimize the sum of squares
  //   const initialGuess = [0.1,0.2,0.3]; // Initial guess for the minimum
  //   const tolerance = 1e-6; // Tolerance for convergence
  //   const maxIterations = 1000; // Maximum number of iterations
  //
  //   const trainingResult = nelderMead(objectFunction, initialGuess, tolerance, maxIterations);
  //   console.log('Optimal Solution:', trainingResult);
  //   return {
  //     alpha: trainingResult[0],
  //     beta: trainingResult[1],
  //     gamma: trainingResult[2]
  //   };
  // --
  // Example usage:
  const objectiveFunction = (x: number[]) => x.reduce((sum, val) => sum + val ** 2, 0); // Example: Minimize the sum of squares
  const initialGuess = [1, 2, 3]; // Initial guess for the minimum
  const tolerance = 1e-6; // Tolerance for convergence
  const maxIterations = 1000; // Maximum number of iterations

  const result = nelderMead(objectiveFunction, initialGuess, tolerance, maxIterations);
  console.log('Optimal Solution:', result);
  return {
    alpha: result[0],
    beta: result[1],
    gamma: result[2],
  };
  // --
}

export function predict(data: CleanedData, seasonLength: number, breachingStdDev: number) {
  const { alpha, beta, gamma } = train2(data.trainingDataViews, seasonLength);
  console.log('Training', { alpha, beta, gamma });
  const hwsResult = holtWintersForecast(data.trainingDataViews, alpha, beta, gamma, seasonLength, 1);

  const upperStdDevPredictedLatest = hwsResult.forecast[0] + data.latest.stdDevDev24Hours * breachingStdDev;
  const breachingLatest = data.latest.record.views > upperStdDevPredictedLatest;
  logger.info('Prediction', {
    Latest: data.latest.record,
    Predicted: hwsResult.forecast[0],
    StdDevDev24Hours: data.latest.stdDevDev24Hours,
    UpperStdDevPredicted: upperStdDevPredictedLatest,
    Breaching: breachingLatest,
  });

  // const formatNumber = (value: number) => value.toFixed(3).padStart(5, ' ');
  // console.debug(data.latest.record.date_key, formatNumber(data.latest.record.views),
  //   "[ ", formatNumber(alpha), formatNumber(beta), formatNumber(gamma), " ]",
  //   "[ ", formatNumber(hwsResult.forecast[0]), " ]",
  //   breachingLatest);

  return {
    predicted: hwsResult.forecast[0],
    upperStdDevPredicted: upperStdDevPredictedLatest,
    breaching: breachingLatest,
  };
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

    /* Event time will always be the current hour, Firehose S3 Buffer Hint + 5 minutes
     * Take it as if it was for that hour */
    const eventDateLatest = new Date(DateUtils.parseIso(event.time).setMinutes(0, 0, 0));
    /* Over fetches data from `eventDateLatest` to `trainingSeasonLength` + `evaluationWindow` so that we only do 1 Athena query */
    const rawData = await getData(
      athenaPageViews,
      eventDateLatest,
      LambdaEnvironment.SITES,
      seasonLength,
      LambdaEnvironment.EVALUATION_WINDOW
    );

    const evaluations: {
      date: string;
      value: number;
      std_dev: number;
      predicted: number;
      predicted_std_dev: number;
      breached: boolean;
    }[] = [];
    /* Stat at n = 1 because we can not evaluate the current hour, the previous hour(s) have full buckets, and it is
     * them that we want to analyze */
    for (let n = 1; n <= LambdaEnvironment.EVALUATION_WINDOW; n++) {
      const evaluationDate = DateUtils.addHours(eventDateLatest, -n);
      const { data, fromDate, toDate } = getTrainingDataForDate(rawData, evaluationDate, seasonLength);
      /* The first two ara always anomalous, skip them */
      if (data.length <= 2) {
        continue;
      }
      const dataCleaned = cleanData(rawData, fromDate, toDate);

      /* Increase the std deviation when we have less than `seasonLength` number of records. This is so that we
       * can still do some prediction when training. It will only catch big anomalies when `records < seasonLength`,
       * but as time progresses `records >= seasonLength` it becomes the specified std deviation.
       * This approach allows us to do some prediction while training as opposed to no prediction at all until we have
       * enough records for training. The multiplier 3 is chosen at random while testing. It is also sufficiently
       * large enough that we can be certain that it prevents any false-positives when training. */
      const predictionBreachingStdDev =
        data.length < seasonLength ? LambdaEnvironment.BREACHING_STD_DEV * 3 : LambdaEnvironment.BREACHING_STD_DEV;
      const prediction = predict(dataCleaned, seasonLength, predictionBreachingStdDev);
      evaluations.push({
        date: evaluationDate.toISOString(),
        value: dataCleaned.latest.record.views,
        std_dev: dataCleaned.latest.stdDevDev24Hours,
        predicted: prediction.predicted,
        predicted_std_dev: prediction.upperStdDevPredicted,
        breached: prediction.breaching,
      });
    }

    /* Alarm if all values in the evaluation array are true */
    const evaluationsBreached = evaluations.reduce((a, b) => a && b.breached, true);
    logger.info('Evaluations', evaluations, 'EvaluationsBreached', evaluationsBreached);

    await eventBridgeAnalytics.putEvent({
      DetailType: evaluationsBreached ? 'anomaly.page_view.breached' : 'anomaly.page_view.ok',
      Detail: {
        breached: evaluationsBreached,
        evaluations,
      },
    });

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
