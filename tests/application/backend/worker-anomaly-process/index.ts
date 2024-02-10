import '@tests/application/environment-hoist';
import { handler } from '@backend/worker-anomaly-process';
import { TestConfig } from '@tests/test-config';
import { apiGwContext, setEnvVariables, TEST_TYPE } from '@tests/application/helpers';
import { expect } from 'chai';
import { EbAnalyticsEntryToEventBridgeEvent } from '@backend/lib/dal/eventbridge';
import { EbPageViewAnomalyAlarm, EbPageViewAnomalyOk } from '@backend/lib/dal/eventbridge/events/anomaly.page_view';

const ECHO_TEST_OUTPUTS = true;
const TimeOut = 60;
// Set in environment-hoist.ts
// process.env.TEST_TYPE = TEST_TYPE.UNIT;
// process.env.TEST_TYPE = TEST_TYPE.E2E;

describe('Cron - Worker Anomaly Process', function () {
  before(async function () {
    console.log('TEST_TYPE', process.env.TEST_TYPE);
  });

  it('Event anomaly.page_view.alarm - No alarm, single breach', async function () {
    this.timeout(TimeOut * 1000);

    if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
      console.log('Skipping E2E test');
      return;
    }

    const context = apiGwContext();
    const event: EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyAlarm> = {
      account: '',
      id: '',
      region: '',
      resources: [],
      source: '',
      time: '',
      version: '',
      'detail-type': 'anomaly.page_view.alarm',
      detail: {
        alarm: false,
        state: 'OK',
        evaluations: [
          {
            date: '2023-08-01T07:00:00.000Z',
            value: 17,
            predicted: 7.734813551079208,
            breached: true,
            breachingThreshold: 14.395938426926364,
            breachingReason: 'BREACHED',
            slope: 12,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2023-08-01T06:00:00.000Z',
            value: 5,
            predicted: 5.6685169388490095,
            breached: false,
            breachingThreshold: 12.04941029430374,
            breachingReason: 'NOT_BREACHED',
            slope: -2,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
        ],
      },
    };

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });

  it('Event anomaly.page_view.alarm - No alarm, no transition, all evaluation windows breached', async function () {
    this.timeout(TimeOut * 1000);

    if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
      console.log('Skipping E2E test');
      return;
    }

    const context = apiGwContext();
    const event: EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyAlarm> = {
      account: '',
      id: '',
      region: '',
      resources: [],
      source: '',
      time: '',
      version: '',
      'detail-type': 'anomaly.page_view.alarm',
      detail: {
        alarm: true,
        state: 'ALARM_WINDOW_BREACHED',
        evaluations: [
          {
            date: '2023-08-01T07:00:00.000Z',
            value: 17,
            predicted: 7.734813551079208,
            breached: true,
            breachingThreshold: 14.395938426926364,
            breachingReason: 'BREACHED',
            slope: 12,
            window: {
              alarm: true,
              state: 'ALARM_WINDOW_BREACHED',
            },
          },
          {
            date: '2023-08-01T06:00:00.000Z',
            value: 15,
            predicted: 5.6685169388490095,
            breached: true,
            breachingThreshold: 12.04941029430374,
            breachingReason: 'BREACHED',
            slope: 2,
            window: {
              alarm: true,
              state: 'ALARM_WINDOW_BREACHED',
            },
          },
        ],
      },
    };

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });

  it('Event anomaly.page_view.alarm - Alarm, evaluation windows transition', async function () {
    this.timeout(TimeOut * 1000);

    if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
      console.log('Skipping E2E test');
      return;
    }

    const context = apiGwContext();
    const event: EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyAlarm> = {
      account: '',
      id: '',
      region: '',
      resources: [],
      source: '',
      time: '',
      version: '',
      'detail-type': 'anomaly.page_view.alarm',
      detail: {
        alarm: true,
        state: 'ALARM_WINDOW_BREACHED',
        evaluations: [
          {
            date: '2023-08-01T07:00:00.000Z',
            value: 17,
            predicted: 7.734813551079208,
            breached: true,
            breachingThreshold: 14.395938426926364,
            breachingReason: 'BREACHED',
            slope: 12,
            window: {
              alarm: true,
              state: 'ALARM_WINDOW_BREACHED',
            },
          },
          {
            date: '2023-08-01T06:00:00.000Z',
            value: 15,
            predicted: 5.6685169388490095,
            breached: true,
            breachingThreshold: 12.04941029430374,
            breachingReason: 'BREACHED',
            slope: 2,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
        ],
      },
    };

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });

  it('Event anomaly.page_view.ok - OK, evaluation windows transition', async function () {
    this.timeout(TimeOut * 1000);

    if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
      console.log('Skipping E2E test');
      return;
    }

    const context = apiGwContext();
    const event: EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyOk> = {
      account: '',
      id: '',
      region: '',
      resources: [],
      source: '',
      time: '',
      version: '',
      'detail-type': 'anomaly.page_view.ok',
      detail: {
        alarm: false,
        state: 'OK',
        evaluations: [
          {
            date: '2023-08-01T08:00:00.000Z',
            value: 5,
            predicted: 10,
            breached: false,
            breachingThreshold: 15,
            breachingReason: 'NOT_BREACHED',
            slope: -12,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2023-08-01T07:00:00.000Z',
            value: 17,
            predicted: 7.734813551079208,
            breached: true,
            breachingThreshold: 14.395938426926364,
            breachingReason: 'BREACHED',
            slope: 12,
            window: {
              alarm: true,
              state: 'ALARM_WINDOW_BREACHED',
            },
          },
          {
            date: '2023-08-01T06:00:00.000Z',
            value: 15,
            predicted: 5.6685169388490095,
            breached: true,
            breachingThreshold: 12.04941029430374,
            breachingReason: 'BREACHED',
            slope: 2,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
        ],
      },
    };

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });

  it('Event anomaly.page_view.ok - Test chart', async function () {
    this.timeout(TimeOut * 1000);

    if (process.env.TEST_TYPE === TEST_TYPE.E2E) {
      console.log('Skipping E2E test');
      return;
    }

    const context = apiGwContext();
    const event: EbAnalyticsEntryToEventBridgeEvent<EbPageViewAnomalyOk> = {
      account: '',
      id: '',
      region: '',
      resources: [],
      source: '',
      time: '',
      version: '',
      'detail-type': 'anomaly.page_view.ok',
      detail: {
        alarm: true,
        state: 'ALARM_WINDOW_BREACHED',
        evaluations: [
          // {
          //   "date": "2024-01-24T02:00:00.000Z",
          //   "value": 10,
          //   "predicted": 10.763400767234597,
          //   "breached": false,
          //   "breachingThreshold": 18.747986917205,
          //   "breachingReason": "NOT_BREACHED",
          //   "slope": 2,
          //   "window": {
          //     "alarm": false,
          //     "state": "OK"
          //   }
          // },
          // {
          //   "date": "2024-01-24T01:00:00.000Z",
          //   "value": 10,
          //   "predicted": 10.763400767234597,
          //   "breached": false,
          //   "breachingThreshold": 18.747986917205,
          //   "breachingReason": "NOT_BREACHED",
          //   "slope": 2,
          //   "window": {
          //     "alarm": false,
          //     "state": "OK"
          //   }
          // },
          // {
          //   "date": "2024-01-24T00:00:00.000Z",
          //   "value": 10,
          //   "predicted": 10.763400767234597,
          //   "breached": false,
          //   "breachingThreshold": 18.747986917205,
          //   "breachingReason": "NOT_BREACHED",
          //   "slope": 2,
          //   "window": {
          //     "alarm": false,
          //     "state": "OK"
          //   }
          // },
          // {
          //   "date": "2024-01-23T23:00:00.000Z",
          //   "value": 10,
          //   "predicted": 10.763400767234597,
          //   "breached": false,
          //   "breachingThreshold": 18.747986917205,
          //   "breachingReason": "NOT_BREACHED",
          //   "slope": 2,
          //   "window": {
          //     "alarm": false,
          //     "state": "OK"
          //   }
          // },
          // {
          //   "date": "2024-01-23T22:00:00.000Z",
          //   "value": 8,
          //   "predicted": 10.954250959043245,
          //   "breached": true,
          //   "breachingThreshold": 19.30625642958187,
          //   "breachingReason": "WINDOW_ALARM_SLOPE_STILL_NEGATIVE",
          //   "slope": -36,
          //   "window": {
          //     "alarm": true,
          //     "state": "ALARM_SLOPE_STILL_NEGATIVE"
          //   }
          // },
          {
            date: '2024-01-23T21:00:00.000Z',
            value: 44,
            predicted: 11.692813698804056,
            breached: true,
            breachingThreshold: 20.063536249853883,
            breachingReason: 'BREACHED',
            slope: 34,
            window: {
              alarm: true,
              state: 'ALARM_LATEST_EVALUATION_SPIKE',
            },
          },
          {
            date: '2024-01-23T20:00:00.000Z',
            value: 10,
            predicted: 10.116014456784685,
            breached: false,
            breachingThreshold: 18.513612351720646,
            breachingReason: 'NOT_BREACHED',
            slope: 1,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T19:00:00.000Z',
            value: 9,
            predicted: 10.145018070980855,
            breached: false,
            breachingThreshold: 18.721436907755553,
            breachingReason: 'NOT_BREACHED',
            slope: -7,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T18:00:00.000Z',
            value: 16,
            predicted: 10.431272588726069,
            breached: false,
            breachingThreshold: 19.14329241690996,
            breachingReason: 'NOT_BREACHED',
            slope: 6,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T17:00:00.000Z',
            value: 10,
            predicted: 9.039090735907585,
            breached: false,
            breachingThreshold: 17.735953712943264,
            breachingReason: 'NOT_BREACHED',
            slope: 4,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T16:00:00.000Z',
            value: 6,
            predicted: 8.79886341988448,
            breached: false,
            breachingThreshold: 17.058719185185197,
            breachingReason: 'NOT_BREACHED',
            slope: -5,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T15:00:00.000Z',
            value: 11,
            predicted: 9.4985792748556,
            breached: false,
            breachingThreshold: 17.508953764645828,
            breachingReason: 'NOT_BREACHED',
            slope: 1,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T14:00:00.000Z',
            value: 10,
            predicted: 9.123224093569501,
            breached: false,
            breachingThreshold: 16.92361829334869,
            breachingReason: 'NOT_BREACHED',
            slope: -6,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T13:00:00.000Z',
            value: 16,
            predicted: 8.904030116961877,
            breached: false,
            breachingThreshold: 16.220234537782073,
            breachingReason: 'NOT_BREACHED',
            slope: 5,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T12:00:00.000Z',
            value: 11,
            predicted: 7.130037646202346,
            breached: false,
            breachingThreshold: 13.936568615486763,
            breachingReason: 'NOT_BREACHED',
            slope: 7,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T11:00:00.000Z',
            value: 4,
            predicted: 6.162547057752931,
            breached: false,
            breachingThreshold: 12.432579656999685,
            breachingReason: 'NOT_BREACHED',
            slope: 1,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T10:00:00.000Z',
            value: 3,
            predicted: 6.703183822191164,
            breached: false,
            breachingThreshold: 12.776902347714064,
            breachingReason: 'NOT_BREACHED',
            slope: -1,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T09:00:00.000Z',
            value: 4,
            predicted: 7.628979777738954,
            breached: false,
            breachingThreshold: 13.285525594078848,
            breachingReason: 'NOT_BREACHED',
            slope: -8,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T08:00:00.000Z',
            value: 12,
            predicted: 8.536224722173692,
            breached: false,
            breachingThreshold: 14.174694002531478,
            breachingReason: 'NOT_BREACHED',
            slope: -2,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T07:00:00.000Z',
            value: 14,
            predicted: 7.6702809027171135,
            breached: true,
            breachingThreshold: 13.02656435572531,
            breachingReason: 'BREACHED',
            slope: 4,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T06:00:00.000Z',
            value: 10,
            predicted: 6.08785112839639,
            breached: false,
            breachingThreshold: 11.515517921036595,
            breachingReason: 'NOT_BREACHED',
            slope: 7,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T05:00:00.000Z',
            value: 3,
            predicted: 5.109813910495488,
            breached: false,
            breachingThreshold: 10.612621060643072,
            breachingReason: 'NOT_BREACHED',
            slope: -3,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T04:00:00.000Z',
            value: 6,
            predicted: 5.63726738811936,
            breached: false,
            breachingThreshold: 11.271801230379975,
            breachingReason: 'NOT_BREACHED',
            slope: 2,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          {
            date: '2024-01-23T03:00:00.000Z',
            value: 4,
            predicted: 5.5465842351492,
            breached: false,
            breachingThreshold: 11.161883016476164,
            breachingReason: 'NOT_BREACHED',
            slope: -4,
            window: {
              alarm: false,
              state: 'OK',
            },
          },
          // {
          //   "date": "2024-01-23T02:00:00.000Z",
          //   "value": 8,
          //   "predicted": 5.9332302939365,
          //   "breached": false,
          //   "breachingThreshold": 11.528281642701726,
          //   "breachingReason": "NOT_BREACHED",
          //   "slope": 4,
          //   "window": {
          //     "alarm": false,
          //     "state": "OK"
          //   }
          // },
          // {
          //   "date": "2024-01-23T01:00:00.000Z",
          //   "value": 4,
          //   "predicted": 5.416537867420625,
          //   "breached": false,
          //   "breachingThreshold": 11.148170866120864,
          //   "breachingReason": "NOT_BREACHED",
          //   "slope": -1,
          //   "window": {
          //     "alarm": false,
          //     "state": "OK"
          //   }
          // },
          // {
          //   "date": "2024-01-23T00:00:00.000Z",
          //   "value": 5,
          //   "predicted": 5.7706723342757815,
          //   "breached": false,
          //   "breachingThreshold": 11.277654438170769,
          //   "breachingReason": "NOT_BREACHED",
          //   "slope": 2,
          //   "window": {
          //     "alarm": false,
          //     "state": "OK"
          //   }
          // },
        ],
      },
    };

    setEnvVariables(TestConfig.env);
    const resp = await handler(event, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp).to.eq(true);
  });
});
