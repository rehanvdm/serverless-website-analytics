import '@tests/environment-hoist';
import {
  cleanData,
  fillMissingDates,
  getTrainingDataForDate,
  handler,
  logger,
  predict,
  Record,
} from '@backend/cron-anomaly-detection';
import { TestConfig } from '../../../test-config';
import { apiGwContext, setEnvVariables, TEST_TYPE } from '@tests/helpers';
import { expect } from 'chai';
import { ScheduledEvent } from 'aws-lambda';
import { LambdaEnvironment } from '@backend/cron-anomaly-detection/environment';
import fs from 'fs';
import path from 'path';
import { parse } from 'papaparse';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { LogLevel } from '@backend/lib/utils/lambda_logger';
import { plot, Plot } from 'nodeplotlib';
import assert from 'assert';

const ECHO_TEST_OUTPUTS = true;
const TimeOut = 120;
// Set in environment-hoist.ts
// process.env.TEST_TYPE = TEST_TYPE.UNIT;
// process.env.TEST_TYPE = TEST_TYPE.E2E;

describe('Cron - Anomaly Detection', function () {
  before(async function () {
    console.log('TEST_TYPE', process.env.TEST_TYPE);
  });

  it('Run', async function () {
    this.timeout(TimeOut * 1000);

    if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
      console.log('Skipping E2E test');
      return;
    }

    const context = apiGwContext();
    const event: ScheduledEvent = {
      version: '0',
      id: '0',
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      account: '0',
      // time: '2023-07-01T00:20:00Z', // Never on the hour

      // time: '2023-08-01T00:20:00Z',
      time: '2023-08-01T08:20:00Z',

      region: 'eu-west-1',
      resources: ['0'],
      detail: {},
    };

    // console.log(JSON.stringify(event, null, 2))

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });

  it('Unit Test and Graph', async function () {
    this.timeout(TimeOut * 1000);

    if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
      console.log('Skipping E2E test');
      return;
    }

    /* Some globals used by following functions */
    setEnvVariables(TestConfig.env);
    LambdaEnvironment.init();
    logger.init(LambdaEnvironment.ENVIRONMENT);
    // logger.setLogLevel(LogLevel.INFO); // Do not show the debug lines which is more useful in the actual lambda execution
    logger.setLogLevel(LogLevel.ERROR); // Do not show the debug lines which is more useful in the actual lambda execution

    // const dataAllFile = fs.readFileSync(path.resolve(__dirname, "./sinusoidal.csv"), { encoding: "utf8"})
    // const dataAllFile = fs.readFileSync(path.resolve(__dirname, './sinusoidal-trend.csv'), { encoding: 'utf8' });
    const dataAllFile = fs.readFileSync(path.resolve(__dirname, './data-realistic-2023-07-01-to-2023-11-30-dec.csv'), {
      encoding: 'utf8',
    });
    // const dataAllFile = fs.readFileSync(path.resolve(__dirname, "./data-consistent-2023-07-07-to-2023-11-30.csv"), { encoding: "utf8"})
    const dataAll = parse(dataAllFile, {
      header: true,
      skipEmptyLines: true,
    });

    const csvRecords = dataAll.data.map(
      (row: any): Record => ({
        date_key: DateUtils.parseFormat(row.date_key, 'yyyy-MM-dd HH:mm:ss.SSS'),
        views: Number(row.views),
      })
    );

    const records = fillMissingDates(
      csvRecords,
      csvRecords[0].date_key,
      DateUtils.parseIso('2023-11-30T23:00:00'),
      true
    );
    // records = records.filter((row: Record) => row.date_key >= DateUtils.parseIso('2023-08-01T11:00:00')); // Tests not starting at a low value.

    const evaluate = 24;
    const evaluationWindow = LambdaEnvironment.EVALUATION_WINDOW;
    const breachingStdDev = LambdaEnvironment.BREACHING_STD_DEV;
    const seasonLength = 7 * 24; // 7 days == 168 hours
    // const trainingSeasonLength = 4*seasonLength;  // 4 weeks == 28 days == 672 hours

    const chartData = [];
    // const db = {
    //   isAlarm: false,
    // };
    for (const record of records)
    {
      const evaluations = [];
      let latest;

      TODO: Redo and test the Lambda `evaluateWindow` function make this code the same...


      const startEvaluationAt = DateUtils.addHours(record.date_key, -evaluate);
      for (let n = 0; n < evaluate; n++) {
        const evaluationDate = DateUtils.addHours(record.date_key, n);
        const { data, fromDate, toDate } = getTrainingDataForDate(records, evaluationDate, seasonLength, 2);
        // if (data.length <= 2) {
        //   evaluations.push(false);
        //   continue;
        // }

        const dataCleaned = cleanData(data, fromDate, toDate);
        if (!dataCleaned) continue;

        // // const prediction = predict(dataCleaned, seasonLength, breachingStdDev);
        // const predictionBreachingStdDev = data.length < seasonLength ? breachingStdDev * 3 : breachingStdDev;
        // // const predictiveBreachingStdDevMultiplier = (1 - (data.length/seasonLength)) * 3;
        // // const predictionBreachingStdDev = Math.max(breachingStdDev, breachingStdDev * predictiveBreachingStdDevMultiplier);
        // const prediction = predict(dataCleaned, seasonLength, predictionBreachingStdDev);
        const prediction = predict(dataCleaned, seasonLength, breachingStdDev);


        if (n > 0)
        {

          //If previous evaluations was in breached, the current is not, but the slope is still negative,
          // then we consider it still in a breached state as the anomaly is not over.
          if(evaluations[0] && !evaluations[n] && prediction.slope < 0)
          {
            evaluations[0] = true; // Then the previous evaluation is still breaching
            console.log('Still in alarm state', evaluationDate);
          }
        }
        if (n == 0) {
          // // Only save the latest value, but we evaluate all values in window
          // // These two evaluations can be in the other lambda function. Just need to report the slope + laterst record views
          // // Extends the window of anomaly so that can get better context if the spike traffic goes down slowly
          // if (db.isAlarm && prediction.slope < 0) {
          //   prediction.breaching = true; // still say breaching if EMA is negative and currently in alarm state
          //   console.log('Still in alarm state', evaluationDate);
          // }

          latest = {
            prediction,
            breachingStdDev,
          };

          // Catches single off big spikes/bypassing the need to check the n-previous evaluations
          // Big spikes classified as the current value being 2x the predicted upper std dev
          // Aug 28 18:00 spike
          // Sep 23 spike
          // Oct 04 04:00 spike
          if (prediction.breaching && dataCleaned.latest.record.views > prediction.breachingThreshold * 2) {
            console.log('Big spike detected, not evaluating the rest of window', evaluationDate);
            break;
          }
        }

        evaluations.push(prediction.breaching);
      }



      /* Alarm if all values in the evaluation array are true */
      const shouldAlarm = evaluations.reduce((a, b) => a && b, true);
      // db.isAlarm = shouldAlarm;
      // console.log(record, JSON.stringify(latest), "Evaluations", evaluations, "ShouldAlarm", shouldAlarm);

      chartData.push({
        date_key: record.date_key,
        actualValue: record.views,
        prediction: latest?.prediction.predicted || 0,
        breachingThreshold: latest?.prediction.breachingThreshold || 0,
        breaching: latest?.prediction.breaching || false,
        shouldAlarm,
      });

      // For testing and want to return early
      // if(record.date_key > DateUtils.parseIso('2023-09-01T00:00:00'))
      // break;
    }

    const chartX = chartData.map((row) => row.date_key);
    const data: Plot[] = [
      {
        name: 'Actual',
        x: chartX,
        y: chartData.map((row) => row.actualValue),
        type: 'scatter',
      },

      // {
      //   name: 'Predicted Upper Std Dev',
      //   x: chartX,
      //   y: chartData.map((row) => row.breachingThreshold),
      //   type: 'scatter',
      //   // line: {
      //   //   width: 2,
      //   //   color: 'lightblue',
      //   // }
      // },
      {
        name: 'Predicted',
        x: chartX,
        y: chartData.map((row) => row.prediction),
        type: 'scatter',
        // line: {
        //   width: 2,
        //   color: 'lightblue',
        // }
      },
      {
        name: 'Predicted with previous seasonvalue',
        x: chartX,
        y: chartData.map((row) => row.breachingThreshold),
        type: 'scatter',
        // line: {
        //   width: 2,
        //   color: 'lightblue',
        // }
      },

      {
        name: 'Breached',
        x: chartX,
        y: chartData.map((row) => (row.breaching ? row.actualValue - row.breachingThreshold : null)),
        type: 'bar',
      },

      {
        name: 'Alarm',
        x: chartX,
        y: chartData.map((row) => (row.shouldAlarm ? row.actualValue - row.breachingThreshold : null)),
        type: 'bar',
      },
    ];

    plot(data, { height: 1000, width: 3000 });

    expect(true).to.eq(true);
  });
});
