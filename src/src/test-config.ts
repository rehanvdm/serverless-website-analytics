export type TestConfig = {
  awsProfile: string;
  awsRegion: string;
  apiIngestUrl: string;
  apiFrontUrl: string;
  allowedOrigins: string[];
  env: {
    AWS_REGION: string;
    ENVIRONMENT: string;
    VERSION: string;
    TIMEOUT: string;
    LOG_LEVEL: string;
    ENRICH_RETURNED_ERRORS: string;

    ANALYTICS_BUCKET: string;
    FIREHOSE_PAGE_VIEWS_NAME: string;
    FIREHOSE_EVENTS_NAME: string;
    GEOLITE2_CITY_PATH: string;

    SITES: string;
    ALLOWED_ORIGINS: string;
    ANALYTICS_GLUE_DB_NAME: string;

    COGNITO_USER_POOL_ID?: string;
    COGNITO_CLIENT_ID?: string;
    COGNITO_HOSTED_UI_URL?: string;
  };
  cognitoAuthUser?: {
    userPoolId: string;
    clientId: string;
    username: string;
    password: string;
  };
};

const sites = ['example.com', 'tests1', 'tests2'];
const allowedOrigns = ['*']; // localhost:3000 localhost:5173

export const TestConfig: TestConfig = {
  awsProfile: 'rehan-demo-exported',
  awsRegion: 'us-east-1',
  apiIngestUrl: 'https://demo.serverless-website-analytics.com/api-ingest',
  apiFrontUrl: 'https://demo.serverless-website-analytics.com/api',
  allowedOrigins: allowedOrigns,
  env: {
    AWS_REGION: 'us-east-1',
    ENVIRONMENT: 'prod',
    VERSION: 'tests',
    TIMEOUT: '30',
    LOG_LEVEL: 'DEBUG',
    ENRICH_RETURNED_ERRORS: 'true',

    ANALYTICS_BUCKET: 'swa-demo-bucket-analytics',
    FIREHOSE_PAGE_VIEWS_NAME: 'swa-demo-analytic-page-views-firehose',
    FIREHOSE_EVENTS_NAME: 'swa-demo-analytic-events-firehose',
    GEOLITE2_CITY_PATH: '../../src/src/backend/layer-geolite2/GeoLite2-City.mmdb',

    SITES: JSON.stringify(sites),
    ALLOWED_ORIGINS: JSON.stringify(allowedOrigns),
    ANALYTICS_GLUE_DB_NAME: 'swa-demo-db',

    // Uncomment for no auth
    // COGNITO_USER_POOL_ID: 'us-east-1_tvl0sw7Ei',
    // COGNITO_CLIENT_ID: '1lqovfns5d5000va207dc6hhmo',
    // COGNITO_HOSTED_UI_URL: 'https://swa-demo-login.demo.serverless-website-analytics.com',
  },
  // Uncomment for no auth
  // cognitoAuthUser: {
  //   userPoolId: 'us-east-1_xIzDq3qma',
  //   clientId: '29h8gut29idqhobn0lovtvsvmq',
  //   username: 'rehan.vdm4@gmail.com',
  //   password: 'Rehan1234',
  // },
};
