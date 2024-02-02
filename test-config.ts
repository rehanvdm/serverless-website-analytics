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

    ANALYTICS_DDB_TABLE: string;

    EVALUATION_WINDOW: string;
    BREACHING_MULTIPLIER: string;
    EVENT_BRIDGE_SOURCE: string;

    TIME_ZONE: string;

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

const sites = ['rehanvdm.com', 'cloudglance.dev', 'blog.cloudglance.dev', 'docs.cloudglance.dev', 'tests'];
const allowedOrigns = ['*']; // localhost:3000 localhost:5173

export const TestConfig: TestConfig = {
  awsProfile: 'systanics-prod-exported',
  awsRegion: 'eu-west-1',
  apiIngestUrl: 'https://analytics.rehanvdm.com/api-ingest',
  apiFrontUrl: 'https://analytics.rehanvdm.com/api',
  allowedOrigins: allowedOrigns,
  env: {
    AWS_REGION: 'eu-west-1',
    ENVIRONMENT: 'prod',
    VERSION: 'tests',
    TIMEOUT: '30',
    LOG_LEVEL: 'DEBUG',
    ENRICH_RETURNED_ERRORS: 'true',

    ANALYTICS_BUCKET: 'rehan-analytics-swa-bucket-analytics',
    FIREHOSE_PAGE_VIEWS_NAME: 'rehan-analytics-swa-analytic-page-views-firehose',
    FIREHOSE_EVENTS_NAME: 'rehan-analytics-swa-analytic-events-firehose',
    GEOLITE2_CITY_PATH: '../../src/src/backend/layer-geolite2/GeoLite2-City.mmdb',

    SITES: JSON.stringify(sites),
    ALLOWED_ORIGINS: JSON.stringify(allowedOrigns),
    ANALYTICS_GLUE_DB_NAME: 'rehan-analytics-swa-db',

    // Uncomment for no auth
    COGNITO_USER_POOL_ID: 'eu-west-1_MVlZ9lMld',
    COGNITO_CLIENT_ID: '6udmqo9nlqstcgulgebkpumtan',
    COGNITO_HOSTED_UI_URL: 'https://login.analytics.rehanvdm.com',

    ANALYTICS_DDB_TABLE: 'rehan-analytics-swa-table',

    EVALUATION_WINDOW: '2',
    BREACHING_MULTIPLIER: '2',
    // EVALUATION_WINDOW: '1',
    // BREACHING_MULTIPLIER: '4',
    EVENT_BRIDGE_SOURCE: 'rehan-analytics-swa-prod',

    ALERT_TOPIC_ARN: 'arn:aws:sns:eu-west-1:134204159843:rehan-analytics-rehananalyticsalarmtopic1C71C790-EuKfG1eF75C6',
    ALERT_ON_ALARM: 'true',
    ALERT_ON_OK: 'false',

    TIME_ZONE: 'Africa/Johannesburg',
  },
  // Uncomment for no auth
  cognitoAuthUser: {
    userPoolId: 'eu-west-1_MVlZ9lMld',
    clientId: '6udmqo9nlqstcgulgebkpumtan',
    username: 'rehan.vdm4@gmail.com',
    password: '2WgW2m6ZPwgafzp46XZg',
  },
};
