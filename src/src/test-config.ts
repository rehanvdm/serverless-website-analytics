export type TestConfig = {
  awsProfile: string;
  apiIngestUrl: string;
  apiFrontUrl: string;
  allowedOrigins: string; // comma delimited
  env: {
    AWS_REGION: string;
    ENVIRONMENT: string;
    VERSION: string;
    TIMEOUT: string;
    LOG_LEVEL: string;
    ENRICH_RETURNED_ERRORS: string;

    ANALYTICS_BUCKET: string;
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

const sites = [
  'tests',
  'tests1',
  'tests2',
  'tests3',
  'localhost:5173', // < Writes but can not read, can not make partition
  'rehanvdm.com',
  'cloudglance.dev',
  'blog.cloudglance.dev',
  'docs.cloudglance.dev',
];
const allowedOrigns = '*'; // localhost:3000 localhost:5173

export const TestConfig = {
  awsProfile: 'rehan-demo-exported',
  awsRegion: 'us-east-1',
  apiIngestUrl: 'https://d3nhr87nci4rd5.cloudfront.net',
  apiFrontUrl: 'https://d3nhr87nci4rd5.cloudfront.net/api',
  allowedOrigins: allowedOrigns,
  env: {
    AWS_REGION: 'us-east-1',
    ENVIRONMENT: 'prod',
    VERSION: 'tests',
    TIMEOUT: '30',
    LOG_LEVEL: 'DEBUG',
    ENRICH_RETURNED_ERRORS: 'true',

    ANALYTICS_BUCKET: 'swa-prod-bucket-analytics',
    GEOLITE2_CITY_PATH: '../../src/src/backend/layer-geolite2/GeoLite2-City.mmdb',

    SITES: JSON.stringify(sites),
    ALLOWED_ORIGINS: allowedOrigns,
    ANALYTICS_GLUE_DB_NAME: 'swa-prod-db',

    // Uncomment for no auth
    COGNITO_USER_POOL_ID: 'us-east-1_p5R0wUQDM',
    COGNITO_CLIENT_ID: '6sb9c1fn4fcvtetfp4ap7dqm0e',
    COGNITO_HOSTED_UI_URL: 'https://swa-test-1.auth.us-east-1.amazoncognito.com',
  },
  // Uncomment for no auth
  cognitoAuthUser: {
    userPoolId: 'us-east-1_p5R0wUQDM',
    clientId: '6sb9c1fn4fcvtetfp4ap7dqm0e',
    username: 'rehan.vdm4@gmail.com',
    password: 'Rehan1234',
  },
};
