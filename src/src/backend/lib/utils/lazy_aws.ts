import {S3Client} from '@aws-sdk/client-s3';
import {AthenaClient} from '@aws-sdk/client-athena';
import {FirehoseClient} from '@aws-sdk/client-firehose';
import assert from "assert";

let s3Client: Record<string, S3Client> = { };
let firehoseClient: Record<string, FirehoseClient> = { };
let athenaClient: Record<string, AthenaClient> = { };

function awsEnv()
{
  return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
  };
}

export function getS3Client(region?: string) {
  if(!region)
    region = process.env.AWS_REGION;

  assert(region);

  if(!s3Client[region])
    s3Client[region] = new S3Client({
      region,
      ...awsEnv()
    });

  return s3Client[region];
}

export function getAthenaClient(region?: string) {
  if(!region)
    region = process.env.AWS_REGION;

  assert(region);

  if(!athenaClient[region])
    athenaClient[region] = new AthenaClient({
      region,
      ...awsEnv()
    });

  return athenaClient[region];
}

export function getFirehoseClient(region?: string) {
  if(!region)
    region = process.env.AWS_REGION;

  assert(region);

  if(!firehoseClient[region])
    firehoseClient[region] = new FirehoseClient({
      region,
      ...awsEnv()
    });

  return firehoseClient[region];
}
