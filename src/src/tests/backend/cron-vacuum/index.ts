import '@tests/environment-hoist';
import { handler } from '@backend/cron-vacuum';
import { TestConfig } from '../../../test-config';
import { apiGwContext, setEnvVariables, TEST_TYPE } from '@tests/helpers';
import { expect } from 'chai';
import { ScheduledEvent } from 'aws-lambda';

const ECHO_TEST_OUTPUTS = true;
const TimeOut = 60;
// Set in environment-hoist.ts
// process.env.TEST_TYPE = TEST_TYPE.UNIT;
// process.env.TEST_TYPE = TEST_TYPE.E2E;

describe('Cron - Vacuum', function () {
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
      time: '1970-01-01T00:00:00Z',
      region: 'eu-west-1',
      resources: ['0'],
      detail: {},
    };

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });
});
