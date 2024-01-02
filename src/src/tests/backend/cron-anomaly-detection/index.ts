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
    const dataAllFile = fs.readFileSync(path.resolve(__dirname, './sinusoidal-trend.csv'), { encoding: 'utf8' });
    // const dataAllFile = fs.readFileSync(path.resolve(__dirname, "./data-realistic-2023-07-01-to-2023-11-30-dec.csv"), { encoding: "utf8"})
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

    let records = fillMissingDates(csvRecords, csvRecords[0].date_key, DateUtils.parseIso('2023-11-30T23:00:00'), true);

    /*
     * Plotting from Aug, making that the first month and comparing where it is the second month reveals that the
     * Nelder Mead (+ Winter Holtz) produces inconsistent and wildly varying values for alpha, gamma, beta
     * when the data it has to train on is less than 4 seasons. Where 1 season is 7 days for us. So we only get
     * accurate/consistent results if we train on 4*7days of data.
     * Example of alpha, gamma,beta
     * n-1: [  -0.003 -0.002 0.261  ]
     * n    [  0.957 0.001 0.044  ]
     */
    // records = records.filter((row: Record) => row.date_key >= DateUtils.parseIso('2023-08-01T00:00:00'))
    records = records.filter((row: Record) => row.date_key >= DateUtils.parseIso('2023-08-01T11:00:00')); // Test not starting at a low value.

    const evaluationWindow = LambdaEnvironment.EVALUATION_WINDOW;
    const breachingStdDev = LambdaEnvironment.BREACHING_STD_DEV;
    const seasonLength = 7 * 24; // 7 days == 168 hours
    // const trainingSeasonLength = 4*seasonLength;  // 4 weeks == 28 days == 672 hours

    const chartData = [];
    for (const record of records) {
      const evaluations = [];
      let latest;
      for (let n = 0; n < evaluationWindow; n++) {
        const evaluationDate = DateUtils.addHours(record.date_key, -n);
        const { data, fromDate, toDate } = getTrainingDataForDate(records, evaluationDate, seasonLength);
        if (data.length <= 2) {
          evaluations.push(false);
          continue;
        }

        const dataCleaned = cleanData(data, fromDate, toDate);
        // const prediction = predict(dataCleaned, seasonLength, breachingStdDev);
        const predictionBreachingStdDev = data.length < seasonLength ? breachingStdDev * 3 : breachingStdDev;
        // const predictiveBreachingStdDevMultiplier = (1 - (data.length/seasonLength)) * 3;
        // const predictionBreachingStdDev = Math.max(breachingStdDev, breachingStdDev * predictiveBreachingStdDevMultiplier);
        const prediction = predict(dataCleaned, seasonLength, predictionBreachingStdDev);
        if (n == 0) {
          latest = {
            prediction,
            breachingStdDev,
          };
        }

        evaluations.push(prediction.breaching);
      }

      /* Alarm if all values in the evaluation array are true */
      const shouldAlarm = evaluations.reduce((a, b) => a && b, true);
      // console.log(record, JSON.stringify(latest), "Evaluations", evaluations, "ShouldAlarm", shouldAlarm);

      chartData.push({
        date_key: record.date_key,
        actualValue: record.views,
        upperStdDevPredicted: latest?.prediction.upperStdDevPredicted || 0,
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

      {
        name: 'Predicted Upper Std Dev',
        x: chartX,
        y: chartData.map((row) => row.upperStdDevPredicted),
        type: 'scatter',
        // line: {
        //   width: 2,
        //   color: 'lightblue',
        // }
      },

      {
        name: 'Breached',
        x: chartX,
        y: chartData.map((row) => (row.breaching ? row.actualValue - row.upperStdDevPredicted : null)),
        type: 'bar',
      },

      {
        name: 'Alarm',
        x: chartX,
        y: chartData.map((row) => (row.shouldAlarm ? row.actualValue - row.upperStdDevPredicted : null)),
        type: 'bar',
      },
    ];

    plot(data, { height: 1000, width: 3000 });

    expect(true).to.eq(true);
  });
});
