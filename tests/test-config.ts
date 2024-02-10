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

    TRACK_OWN_DOMAIN?: string;
    IS_DEMO_PAGE?: string;

    COGNITO_USER_POOL_ID?: string;
    COGNITO_CLIENT_ID?: string;
    COGNITO_HOSTED_UI_URL?: string;

    EVALUATION_WINDOW: string;
    BREACHING_MULTIPLIER: string;
    EVENT_BRIDGE_SOURCE: string;

    ALERT_TOPIC_ARN: string;
    ALERT_ON_ALARM: string;
    ALERT_ON_OK: string;
  };
  cognitoAuthUser?: {
    userPoolId: string;
    clientId: string;
    username: string;
    password: string;
  };
};

const sites = ['simulated', 'demo.serverless-website-analytics.com'];
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

    TRACK_OWN_DOMAIN: 'true',
    // TRACK_OWN_DOMAIN: 'false',
    IS_DEMO_PAGE: 'true',
    // IS_DEMO_PAGE: 'false',

    // Uncomment for no auth
    // COGNITO_USER_POOL_ID: 'us-east-1_tvl0sw7Ei',
    // COGNITO_CLIENT_ID: '1lqovfns5d5000va207dc6hhmo',
    // COGNITO_HOSTED_UI_URL: 'https://swa-demo-login.demo.serverless-website-analytics.com',

    EVALUATION_WINDOW: '2',
    BREACHING_MULTIPLIER: '2',
    EVENT_BRIDGE_SOURCE: 'swa-demo-prod',

    ALERT_TOPIC_ARN: 'arn:aws:sns:eu-west-1:123456789:your-topic-name',
    ALERT_ON_ALARM: 'true',
    ALERT_ON_OK: 'true',
  },
  // Uncomment for no auth
  // cognitoAuthUser: {
  //   userPoolId: 'us-east-1_xIzDq3qma',
  //   clientId: '29h8gut29idqhobn0lovtvsvmq',
  //   username: 'rehan.vdm4@gmail.com',
  //   password: 'Rehan1234',
  // },
};
