import { S3Client } from '@aws-sdk/client-s3';
import { AthenaClient } from '@aws-sdk/client-athena';
import { FirehoseClient } from '@aws-sdk/client-firehose';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { SNSClient } from '@aws-sdk/client-sns';
import assert from 'assert';

const s3Client: Record<string, S3Client> = {};
const firehoseClient: Record<string, FirehoseClient> = {};
const athenaClient: Record<string, AthenaClient> = {};
const dynamodbClient: Record<string, DynamoDBClient> = {};
const eventBridgeClient: Record<string, EventBridgeClient> = {};
const snsClient: Record<string, SNSClient> = {};

function awsEnv() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  };
}

export function getS3Client(region?: string) {
  if (!region) {
    region = process.env.AWS_REGION;
  }

  assert(region);

  if (!s3Client[region]) {
    s3Client[region] = new S3Client({
      region,
      ...awsEnv(),
    });
  }

  return s3Client[region];
}

export function getAthenaClient(region?: string) {
  if (!region) {
    region = process.env.AWS_REGION;
  }

  assert(region);

  if (!athenaClient[region]) {
    athenaClient[region] = new AthenaClient({
      region,
      ...awsEnv(),
    });
  }

  return athenaClient[region];
}

export function getFirehoseClient(region?: string) {
  if (!region) {
    region = process.env.AWS_REGION;
  }

  assert(region);

  if (!firehoseClient[region]) {
    firehoseClient[region] = new FirehoseClient({
      region,
      ...awsEnv(),
    });
  }

  return firehoseClient[region];
}

export function getDdbClient(region?: string) {
  if (!region) {
    region = process.env.AWS_REGION;
  }

  assert(region);

  if (!dynamodbClient[region]) {
    dynamodbClient[region] = new DynamoDBClient({
      region,
      ...awsEnv(),
    });
  }
  return dynamodbClient[region];
}

export function getEventBridgeClient(region?: string) {
  if (!region) {
    region = process.env.AWS_REGION;
  }

  assert(region);

  if (!eventBridgeClient[region]) {
    eventBridgeClient[region] = new EventBridgeClient({
      region,
      ...awsEnv(),
    });
  }
  return eventBridgeClient[region];
}

export function getSnsClient(region?: string) {
  if (!region) {
    region = process.env.AWS_REGION;
  }

  assert(region);

  if (!snsClient[region]) {
    snsClient[region] = new SNSClient({
      region,
      ...awsEnv(),
    });
  }
  return snsClient[region];
}
