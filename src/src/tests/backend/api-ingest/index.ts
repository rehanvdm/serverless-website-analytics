import '@tests/environment-hoist';
import { handler } from '@backend/api-ingest';
import { TestConfig } from '../../../test-config';
import {
  apiGwContext,
  ApiGwEventOptions,
  invokeLocalHandlerOrMakeAPICall,
  setEnvVariables,
  TEST_TYPE,
} from '@tests/helpers';
import { expect } from 'chai';
import { V1PageViewInput } from '@backend/api-ingest/v1/page/view';
import { V1PageEventInput } from '@backend/api-ingest/v1/event/track';

const TimeOut = 10;
// Set in environment-hoist.ts
// process.env.TEST_TYPE = TEST_TYPE.UNIT;
process.env.TEST_TYPE = TEST_TYPE.E2E;

describe('API Ingest', function () {
  before(async function () {
    console.log('TEST_TYPE', process.env.TEST_TYPE);
  });

  it('API Docs', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: 'GET',
      path: '/docs',
    };

    // TestConfig.apiIngestUrl = 'http://localhost:3000';
    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);
    console.log(resp);
  });

  it('View Page - CORS OPTIONS NEGATIVE - Forbidden Origin', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: 'OPTIONS',
      path: '/v1/page/view',
      origin: 'nope',
    };

    // Force origin above to not be in allowed origins
    const testingConfig = { ...TestConfig.env, ALLOWED_ORIGINS: JSON.stringify(['localhost:5173']) };
    setEnvVariables(testingConfig);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);

    expect(resp.statusCode).to.equal(403);
  });

  it('View Page - CORS POST NEGATIVE - Forbidden Origin', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: 'POST',
      path: '/v1/page/view',
      body: JSON.stringify({}),
      origin: 'nope',
    };

    // Force origin above to not be in allowed origins
    const testingConfig = { ...TestConfig.env, ALLOWED_ORIGINS: JSON.stringify(['localhost:5173']) };
    setEnvVariables(testingConfig);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);

    expect(resp.statusCode).to.equal(403);
  });

  it('View Page - CORS OPTIONS POSITIVE - Return same origin', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: 'OPTIONS',
      path: '/v1/page/view',
      origin: 'okay',
    };

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);

    expect(resp.statusCode).to.equal(200);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(resp.headers!['Access-Control-Allow-Origin']).to.equal(event.origin);
  });

  it('View Page - single request', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const pageView: V1PageViewInput = {
      site: 'example.com',
      user_id: 'test_user_id_1',
      session_id: 'test_session_id_1',
      page_id: 'test_page_id_1',
      page_url: '/test_page_id_1.html',
      page_opened_at: '2022-12-03T07:15:00Z',
      time_on_page: 0,
      // referrer: "",
      referrer: 'something.com',
      // referrer: "tests.com/something",
    };
    const event: ApiGwEventOptions = {
      contentType: 'text/plain;charset=UTF-8',
      method: 'POST',
      path: '/v1/page/view',
      body: JSON.stringify(pageView),
      origin: 'localhost',
      ip: '169.0.15.7',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6,2 Safari/605.1.15',
    };

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);

    expect(resp.statusCode).to.equal(200);
  });

  it('View Page - double request', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    function getEvent(timeOnPage: number) {
      const pageView: V1PageViewInput = {
        site: 'example.com',
        user_id: 'test_user_id_2',
        session_id: 'test_session_id_2',
        page_id: 'test_page_id_2',
        page_url: '/test_page_id_2.html',
        page_opened_at: '2023-05-23T04:25:00Z',
        time_on_page: timeOnPage,
        // referrer: "",
      };
      const event: ApiGwEventOptions = {
        method: 'POST',
        path: '/v1/page/view',
        body: JSON.stringify(pageView),
        origin: 'localhost',
        ip: '169.0.15.7',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6,2 Safari/605.1.15',
      };
      return event;
    }

    let event = getEvent(0);
    setEnvVariables(TestConfig.env);
    let resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);
    expect(resp.statusCode).to.equal(200);

    event = getEvent(20);
    resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);
    expect(resp.statusCode).to.equal(200);
  });

  it('Event Track - no data', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const pageEvent: V1PageEventInput = {
      site: 'example.com',
      user_id: 'test_user_id_1',
      session_id: 'test_session_id_1',
      event: 'TEST',
      tracked_at: '2023-04-21T02:00:00Z',
      // data: 1,
      referrer: '',
    };
    const event: ApiGwEventOptions = {
      method: 'POST',
      path: '/v1/event/track',
      body: JSON.stringify(pageEvent),
      origin: 'localhost',
      ip: '169.0.15.7',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6,2 Safari/605.1.15',
    };

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);

    expect(resp.statusCode).to.equal(200);
  });

  it('Event Track', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const pageEvent: V1PageEventInput = {
      site: 'example.com',
      user_id: 'test_user_id_1',
      session_id: 'test_session_id_1',
      event: 'TEST_CUSTOM_VALUE',
      tracked_at: '2023-04-21T02:00:00Z',
      data: 104,
      referrer: '',
    };
    const event: ApiGwEventOptions = {
      method: 'POST',
      path: '/v1/event/track',
      body: JSON.stringify(pageEvent),
      origin: 'localhost',
      ip: '169.0.15.7',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6,2 Safari/605.1.15',
    };

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);

    expect(resp.statusCode).to.equal(200);
  });

  it('View Page - Site does not exist', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const pageView: V1PageViewInput = {
      site: 'nope nope',
      user_id: 'test_user_id_1',
      session_id: 'test_session_id_1',
      page_id: 'test_page_id_1',
      page_url: '/test_page_id_1.html',
      page_opened_at: '2022-12-03T07:15:00Z',
      time_on_page: 0,
      referrer: '',
    };
    const event: ApiGwEventOptions = {
      method: 'POST',
      path: '/v1/page/view',
      body: JSON.stringify(pageView),
      origin: 'localhost',
      ip: '169.0.15.7',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6,2 Safari/605.1.15',
    };

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiIngestUrl, context);

    expect(resp.statusCode).to.equal(400);
    const respData = JSON.parse(resp.body);
    expect(respData.message).to.equal('Site does not exist');
  });
});
