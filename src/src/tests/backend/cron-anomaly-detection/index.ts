import '@tests/environment-hoist';
import {
  handler,
  logger,
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
import {
  cleanData,
  evaluate,
  Evaluation,
  fillMissingDates,
  predict,
  Record
} from "@backend/cron-anomaly-detection/stat_functions";

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

    // const dataAllFile = fs.readFileSync(path.resolve(__dirname, "./sinusoidal.csv"), {
    //   encoding: "utf8"
    // })
    // TODO: This shows we need refinement for upwards trend..
    // const dataAllFile = fs.readFileSync(path.resolve(__dirname, './sinusoidal-trend.csv'), {
    //   encoding: 'utf8'
    // });
    const dataAllFile = fs.readFileSync(path.resolve(__dirname, './data-realistic-2023-07-01-to-2023-11-30-dec.csv'), {
      encoding: 'utf8',
    });
    // TODO out of scope for now but would be nice if we could make this universal, also detect downwards trend and narrow
    //  the breaching threshold if we have constant like this (maybe take (average of previous 24 values abs(predicted - actual)) * breaching multiplier)
    // const dataAllFile = fs.readFileSync(path.resolve(__dirname, "./data-consistent-2023-07-07-to-2023-11-30.csv"), {
    //   encoding: "utf8"
    // })
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

    /* Missing values will be filled in evaluate but we prefill because we need to iterate over all for an accurate test */
    const rawData = fillMissingDates(
      csvRecords,
      csvRecords[0].date_key,
      DateUtils.parseIso('2023-11-30T23:00:00'),
      true
    );
    // records = records.filter((row: Record) => row.date_key >= DateUtils.parseIso('2023-08-01T11:00:00')); // Tests not starting at a low value.

    const seasonLength = 7 * 24; /* 7 days == 168 hours */
    const fetchSeasons = 2;

    const chartEvaluations: Evaluation[] = [];
    // Running 6 months simulation is now a lot of itterations because we are not storing state, but replaying
    // the last 24 hours every time to rebuild the state.
    // iterations = hours * state replay hours * evaluations
    //            = 3500 * 24 * 2 = 168,000

    for (const record of rawData)
    {
      /* Event time will always be the current hour, Firehose S3 Buffer Hint + 5 minutes
       * Take it as if it was for that hour */
      const eventDateLatest = new Date(record.date_key.setMinutes(0, 0, 0));
      /* Over fetches data from `eventDateLatest` to `trainingSeasonLength` + `evaluationWindow` so that we only do 1 Athena query */

      const evaluations = evaluate(
        rawData,
        LambdaEnvironment.EVALUATION_WINDOW,
        eventDateLatest,
        seasonLength,
        fetchSeasons
      );
      const latestEvaluation = evaluations[evaluations.length - 1];
      if(!latestEvaluation)       //TODO first is undefined should not be
        continue;

      chartEvaluations.push(latestEvaluation);

      // For testing and want to return early
      if(record.date_key > DateUtils.parseIso('2023-08-01T00:00:00'))
        break;
    }

    const chartX = chartEvaluations.map((row) => row.date);
    const data: Plot[] = [
      {
        name: 'Actual',
        x: chartX,
        y: chartEvaluations.map((row) => row.value),
        type: 'scatter',
      },
      {
        name: 'Predicted',
        x: chartX,
        y: chartEvaluations.map((row) => row.predicted),
        type: 'scatter',
        // line: {
        //   width: 2,
        //   color: 'lightblue',
        // }
      },
      {
        name: 'Breaching Threshold',
        x: chartX,
        y: chartEvaluations.map((row) => row.breachingThreshold),
        type: 'scatter',
        // line: {
        //   width: 2,
        //   color: 'lightblue',
        // }
      },

      {
        name: 'Breached By',
        x: chartX,
        y: chartEvaluations.map((row) => (row.breached ? row.value - row.breachingThreshold : null)),
        type: 'bar',
      },
      {
        name: 'Alarm',
        x: chartX,
        y: chartEvaluations.map((row) => (row.window?.alarm ? row.value - row.breachingThreshold : null)),
        type: 'bar',
      },
    ];

    plot(data, { height: 1000, width: 3000 });

    expect(true).to.eq(true);
  });
});
