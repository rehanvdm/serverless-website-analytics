import '@tests/environment-hoist';
import { handler } from '@backend/api-front';
import { TestConfig } from '../../../test-config';
import {
  apiGwContext,
  ApiGwEventOptions,
  getCognitoIdentity,
  invokeLocalHandlerOrMakeAPICall,
  setEnvVariables,
} from '@tests/helpers';
import { inferProcedureInput, inferProcedureOutput } from '@trpc/server';
import { AppRouter } from '@backend/api-front/server';
import { expect } from 'chai';

const ECHO_TEST_OUTPUTS = true;
const TimeOut = 60;
// Set in environment-hoist.ts
// process.env.TEST_TYPE = TEST_TYPE.UNIT;
// process.env.TEST_TYPE = TEST_TYPE.E2E;

// TODO: Better define this according to https://trpc.io/docs/v9/infer-types

export function trpcToApiGwOptions<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TRouter extends AppRouter,
  T extends Exclude<keyof AppRouter, '_def' | 'createCaller' | 'getErrorShape'> = Exclude<
    keyof AppRouter,
    '_def' | 'createCaller' | 'getErrorShape'
  >
>(
  functionKey: T,
  type: 'query' | 'mutation',
  args: inferProcedureInput<AppRouter[T]>,
  headers: Record<string, string> = {}
): ApiGwEventOptions {
  return type === 'query'
    ? {
        method: 'GET',
        path: '/' + functionKey,
        queryStringParameters: {
          input: args ? JSON.stringify(args) : undefined,
        },
        headers,
      }
    : {
        method: 'POST',
        path: '/' + functionKey,
        body: JSON.stringify(args),
        headers,
      };
}

async function getCognitoAuthHeaders() {
  let authHeaders = {};
  if (TestConfig.cognitoAuthUser) {
    const testUser = TestConfig.cognitoAuthUser;
    const cognitoUser = await getCognitoIdentity(
      testUser.userPoolId,
      testUser.clientId,
      testUser.username,
      testUser.password
    );
    authHeaders = { Authorization: cognitoUser.jwtIdToken };
  }
  return authHeaders;
}

describe('API Frontend', function () {
  before(async function () {
    console.log('TEST_TYPE', process.env.TEST_TYPE);
  });

  it('getFrontendEnvironment', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getFrontendEnvironment'>(
      'getFrontendEnvironment',
      'query',
      undefined
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    if (TestConfig.env.COGNITO_HOSTED_UI_URL) {
      const expectedCognitoLoginUrl =
        TestConfig.env.COGNITO_HOSTED_UI_URL +
        '/login?client_id=' +
        TestConfig.env.COGNITO_CLIENT_ID +
        '&response_type=token&scope=aws.cognito.signin.user.admin+email+openid+profile';
      expect(respData.result.data.cognitoLoginUrl).to.eq(expectedCognitoLoginUrl);
    } else {
      expect(Object.keys(respData.result.data).length).to.eq(0);
    }
  });

  it('Get sites - Cognito Not Authenticated', async function () {
    if (!TestConfig.env.COGNITO_HOSTED_UI_URL) return;

    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'sites'>('sites', 'query', undefined);

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(401);
    const respData = JSON.parse(resp.body);
    expect(respData.error.message).to.eq('Not authenticated');
  });

  it('Get sites - Authenticated', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'sites'>('sites', 'query', undefined, authHeaders);
    const expectedOutput: inferProcedureOutput<AppRouter['sites']> = JSON.parse(TestConfig.env.SITES);

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    expect(JSON.stringify(respData.result.data)).to.eq(JSON.stringify(expectedOutput));
  });

  it('Get getTopLevelStats', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getTopLevelStats'>(
      'getTopLevelStats',
      'query',
      {
        sites: ['tests'],

        // From 2023-03-01 to 2023-04-01
        // Meaning UTC backend 2023-02-28 22:00:00 to 2023-03-31 22:00:00
        from: new Date(2023, 2, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 3, 1, 23, 59, 59, 999).toISOString(),

        // From 2023-04-01 to 2023-05-01
        // Meaning UTC backend 2023-03-31 22:00:00 to 2023-04-30 22:00:00
        // from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        // to: new Date(2023, 4, 1, 0, 0, 0).toISOString(),

        // Test differences between dates.
        // from: new Date(2023, 3, 14).toISOString(),
        // to: new Date(2023, 3, 21).toISOString(),
      },
      authHeaders
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    const output = respData.result.data as inferProcedureOutput<AppRouter['getTopLevelStats']>;
    console.log(output);

    expect(output.previous.period.from).to.eql('2023-01-27T22:00:00.000Z');
    expect(output.previous.period.to).to.eql('2023-02-28T21:59:59.999Z');
    expect(output.period.from).to.eql('2023-02-28T22:00:00.000Z');
    expect(output.period.to).to.eql('2023-04-01T21:59:59.999Z');
  });

  it('Get pageViews', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getPageViews'>(
      'getPageViews',
      'query',
      {
        sites: ['tests'],
        // From 2023-03-01 to 2023-04-01
        // Meaning UTC backend 2023-02-28 22:00:00 to 2023-03-31 22:00:00

        // // Month 3 - March
        // from: new Date(2023, 2, 1, 0, 0, 0).toISOString(),
        // to: new Date(2023, 2, 30, 23, 59, 59,999).toISOString(),

        // //Month 4 - April
        // from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        // to: new Date(2023, 3, 30, 23, 59, 59,999).toISOString(),

        // Month 5 - June
        from: new Date(2023, 5, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 5, 22, 23, 59, 59, 999).toISOString(),
      },
      authHeaders
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    const output = respData.result.data as inferProcedureOutput<AppRouter['getPageViews']>;
    expect(output.queryExecutionId).to.be.a('string');
    // expect(output.nextToken).to.be.a('string');
    expect(output.data).to.be.an('array');
  });

  it('Get pageViews - Paginate', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getPageViews'>(
      'getPageViews',
      'query',
      {
        sites: ['tests'],
        // Month 4 - April - Past so data fixed, not changing still
        from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 3, 22, 23, 59, 59, 999).toISOString(),
      },
      authHeaders
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    const output = respData.result.data as inferProcedureOutput<AppRouter['getPageViews']>;
    expect(output.queryExecutionId).to.be.a('string');
    expect(output.nextToken).to.be.a('string');
    expect(output.data).to.be.an('array');

    const event2 = trpcToApiGwOptions<AppRouter, 'getPageViews'>(
      'getPageViews',
      'query',
      {
        sites: ['tests'],
        // Month 4 - April - Past so data fixed, not changing still
        from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 3, 22, 23, 59, 59, 999).toISOString(),
        queryExecutionId: output.queryExecutionId,
        nextToken: output.nextToken,
      },
      authHeaders
    );
    const resp2 = await invokeLocalHandlerOrMakeAPICall(event2, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp2);

    expect(resp2.statusCode).to.eq(200);
    const respData2 = JSON.parse(resp2.body);
    const output2 = respData2.result.data as inferProcedureOutput<AppRouter['getPageViews']>;
    expect(output2.data).to.be.an('array');
    expect(output2.queryExecutionId).to.eql(output.queryExecutionId);
    expect(output2.nextToken).to.not.eql(output.nextToken);
    expect(output.data[0].page_url).to.not.eql(output2.data[0].page_url);
  });

  it('Get getChartViews - hour', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getChartViews'>(
      'getChartViews',
      'query',
      {
        sites: ['tests'],
        // Month 4 - April - Past so data fixed, not changing still
        from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 3, 22, 23, 59, 59, 999).toISOString(),
        period: 'hour',
        timeZone: 'Africa/Johannesburg',
      },
      authHeaders
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    const output = respData.result.data as inferProcedureOutput<AppRouter['getChartViews']>;
    // console.log(output);

    expect(output).to.be.an('array');
    expect(output[0].site).to.be.a('string');
    expect(output[0].date_key).to.be.a('string');
    expect(output[0].views).to.be.a('number');
    expect(output[0].visitors).to.be.a('number');
  });

  it('Get getChartViews - day', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getChartViews'>(
      'getChartViews',
      'query',
      {
        sites: ['tests'],
        // Month 4 - April - Past so data fixed, not changing still
        from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 3, 22, 23, 59, 59, 999).toISOString(),
        period: 'day',
        timeZone: 'Africa/Johannesburg',
      },
      authHeaders
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    const output = respData.result.data as inferProcedureOutput<AppRouter['getChartViews']>;
    // console.log(output);

    expect(output).to.be.an('array');
    expect(output[0].site).to.be.a('string');
    expect(output[0].date_key).to.be.a('string');
    expect(output[0].views).to.be.a('number');
    expect(output[0].visitors).to.be.a('number');
  });

  it('Get getChartViews - negative timezone does not exist', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getChartViews'>(
      'getChartViews',
      'query',
      {
        sites: ['tests'],
        // Month 4 - April - Past so data fixed, not changing still
        from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 3, 22, 23, 59, 59, 999).toISOString(),
        period: 'day',
        timeZone: 'XXXX',
      },
      authHeaders
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(500);
  });

  it('Get getChartLocations', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getUsersGroupedByStatForPeriod'>(
      'getUsersGroupedByStatForPeriod',
      'query',
      {
        sites: ['tests'],
        // Month 4 - April - Past so data fixed, not changing still
        from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 3, 22, 23, 59, 59, 999).toISOString(),
        groupBy: 'country_name',
      },
      authHeaders
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    const output = respData.result.data as inferProcedureOutput<AppRouter['getUsersGroupedByStatForPeriod']>;
    // console.log(output);

    expect(output).to.be.an('array');
    expect(output[0].group).to.be.a('string');
    expect(output[0].visitors).to.be.a('number');
  });

  it('Get getPageReferrers', async function () {
    this.timeout(TimeOut * 1000);

    const context = apiGwContext();
    const authHeaders = await getCognitoAuthHeaders();
    const event: ApiGwEventOptions = trpcToApiGwOptions<AppRouter, 'getPageReferrers'>(
      'getPageReferrers',
      'query',
      {
        sites: ['tests'],
        // Month 4 - April - Past so data fixed, not changing still
        from: new Date(2023, 3, 1, 0, 0, 0).toISOString(),
        to: new Date(2023, 3, 30, 23, 59, 59, 999).toISOString(),
      },
      authHeaders
    );

    setEnvVariables(TestConfig.env);
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TestConfig.apiFrontUrl, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    const output = respData.result.data as inferProcedureOutput<AppRouter['getPageReferrers']>;
    // console.log(output);

    expect(output).to.be.an('array');
    expect(output[0].referrer).to.be.a('string');
    expect(output[0].views).to.be.a('number');
  });
});
