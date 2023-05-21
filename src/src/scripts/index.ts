import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { generateOpenApiDocument } from 'trpc-openapi';
import { appRouter } from '@backend/api-ingest/server';
import * as fs from 'fs';
import yaml from 'js-yaml';
import express, { Request, Response } from 'express';
import * as bodyParser from 'body-parser';
import cors from 'cors';
import { TestConfig } from '../test-config';
import {
  apiGwContext,
  ApiGwEventOptions,
  apiGwEventV2,
  setAWSSDKCreds,
  setEnvVariables
} from '@tests/helpers';
import { handler as handlerApiIngest } from '@backend/api-ingest';
import { handler as handleApiFront } from '@backend/api-front';
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

// const paths = {
//   workingDir: path.resolve(__dirname),
//   openApiSpec: path.resolve(__dirname + '/OpenAPI.yaml')
// }

const commands = ['generate-openapi-ingest', 'start-local-api-ingest', 'start-local-api-front'] as const;
export type Command = typeof commands[number];

const argv = yargs(hideBin(process.argv))
  .option('command', {
    alias: 'c',
    describe: 'the command you want to run',
    choices: commands
  })
  .demandOption(['c'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .argv as any;

(async () => {
  const command = argv.c as Command;
  switch (command) {
    case 'generate-openapi-ingest':
      await generateOpenApiIngest();
      break;
    case 'start-local-api-ingest':
      await startLocalApiIngest();
      break;
    case 'start-local-api-front':
      await startLocalApiFront();
      break;
  }
})();

async function startLocalApiIngest () {
  // Can put `DEBUG=express:*` in front of the command that starts the server.
  const port = 3000;
  console.log('STARTING..')

  /* Set ENV variables */
  process.env.TESTING_LOCAL = 'true';
  setEnvVariables(TestConfig.env);
  setAWSSDKCreds(TestConfig.awsProfile, TestConfig.awsRegion, true);

  const app = express();
  app.use(bodyParser.text())

  app.use('/', async (req: Request, res: Response) => {
    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: req.method as 'GET' | 'POST' | 'OPTIONS',
      path: req.path,
      body: req.body,
      headers: req.headers as {[p: string]: string},
      pathParameters: req.params,
      queryStringParameters: req.query as {[p: string]: string | undefined} | undefined,
      origin: req.headers.origin,
      ip: '169.0.15.7',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6,2 Safari/605.1.15'
    };

    const resp = await handlerApiIngest(apiGwEventV2(event), context);
    res.status(resp.statusCode)
      .set(resp.headers)
      .end(resp.body);
  })
  app.listen(port);
  console.log('STARTED on port ' + port);
}

async function startLocalApiFront () {
  // Can put `DEBUG=express:*` in front of the command that starts the server.
  const port = 3001;
  console.log('STARTING..')

  /* Set ENV variables */
  process.env.TESTING_LOCAL = 'true';
  setEnvVariables(TestConfig.env);
  setAWSSDKCreds(TestConfig.awsProfile, TestConfig.awsRegion, true);

  const app = express();
  app.use(bodyParser.json());
  // Only handle cors on local testing, server side it is not a problem because we reverse proxy on the same domain
  app.use(cors());

  app.use('/', async (req: Request, res: Response) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: req.method as 'GET' | 'POST' | 'OPTIONS',
      path: req.path,
      body: JSON.stringify(req.body),
      headers: req.headers as {[p: string]: string},
      pathParameters: req.params,
      queryStringParameters: req.query as {[p: string]: string | undefined} | undefined,
      origin: req.headers.origin
    };

    const resp = await handleApiFront(apiGwEventV2(event), context);
    res.status(resp.statusCode)
      .set(resp.headers)
      .end(resp.body);
  })
  app.listen(port);
  console.log('STARTED on port ' + port);
}

async function generateOpenApiIngest () {
  console.time('* GENERATE OPEN API INGEST');
  const openApiDocument = generateOpenApiDocument(appRouter, {
    title: 'Serverless Website Analytics Ingest API',
    version: '-',
    baseUrl: '-'
  });
  fs.writeFileSync('./OpenAPI-Ingest.yaml', yaml.dump(openApiDocument));
  console.timeEnd('* GENERATE OPEN API INGEST');
}
