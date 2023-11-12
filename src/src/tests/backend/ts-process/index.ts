import '@tests/environment-hoist';
import { handler } from '@backend/ts-process';
import { TestConfig } from '../../../test-config';
import { apiGwContext, s3CreateNotification, setEnvVariables, sqsEvent, TEST_TYPE } from '@tests/helpers';
import { expect } from 'chai';
import { ScheduledEvent, SQSEvent } from 'aws-lambda';

const ECHO_TEST_OUTPUTS = true;
const TimeOut = 60;
// Set in environment-hoist.ts
// process.env.TEST_TYPE = TEST_TYPE.UNIT;
// process.env.TEST_TYPE = TEST_TYPE.E2E;

describe('TimeStream Process', function () {
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
    const s3Notification = s3CreateNotification({
      // "key": "ts-raw-data/timestamp=2023-11-11/rehan-analytics-swa-ts-firehose-4-2023-11-11-11-40-19-4f62ad4e-6829-4bd0-9357-be15a236bebf",
      key: 'ts-raw-data/timestamp%3D2023-11-11/rehan-analytics-swa-ts-firehose-4-2023-11-11-11-40-19-4f62ad4e-6829-4bd0-9357-be15a236bebf',
      size: 0,
      eTag: '',
      sequencer: '',
    });
    const event: SQSEvent = sqsEvent(JSON.stringify(s3Notification));

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });
});
