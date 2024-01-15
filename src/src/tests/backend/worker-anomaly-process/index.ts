import '@tests/environment-hoist';
import { handler } from '@backend/worker-anomaly-process';
import { TestConfig } from '../../../test-config';
import { apiGwContext, setEnvVariables, TEST_TYPE } from '@tests/helpers';
import { expect } from 'chai';
import { EventBridgeEvent } from 'aws-lambda';
import {EbAnalyticsEntryToEventBridgeEvent} from "@backend/lib/dal/eventbridge";
import {EbPageViewAnomalyAlarm} from "@backend/lib/dal/eventbridge/events/anomaly.page_view";

const ECHO_TEST_OUTPUTS = true;
const TimeOut = 60;
// Set in environment-hoist.ts
// process.env.TEST_TYPE = TEST_TYPE.UNIT;
// process.env.TEST_TYPE = TEST_TYPE.E2E;

describe('Cron - Worker Anomaly Process', function () {
  before(async function () {
    console.log('TEST_TYPE', process.env.TEST_TYPE);
  });

  it('Event anomaly.page_view.alarm', async function () {
    this.timeout(TimeOut * 1000);

    if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
      console.log('Skipping E2E test');
      return;
    }

    const context = apiGwContext();
    const event: EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyAlarm> = {
      account: "", id: "", region: "", resources: [], source: "", time: "", version: "",
      "detail-type": "anomaly.page_view.alarm",
      "detail": {
        "alarm": false,
        "state": "OK",
        "evaluations": [
          {
            "date": "2023-08-01T07:00:00.000Z",
            "value": 17,
            "predicted": 7.734813551079208,
            "breached": true,
            "breachingThreshold": 14.395938426926364,
            "breachingReason": "BREACHED",
            "slope": 12,
            "window": {
              "alarm": false,
              "state": "OK"
            }
          },
          {
            "date": "2023-08-01T06:00:00.000Z",
            "value": 5,
            "predicted": 5.6685169388490095,
            "breached": false,
            "breachingThreshold": 12.04941029430374,
            "breachingReason": "NOT_BREACHED",
            "slope": -2,
            "window": {
              "alarm": false,
              "state": "OK"
            }
          }
        ]
      }
    };

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });
});
