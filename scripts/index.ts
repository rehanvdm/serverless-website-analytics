import * as path from 'path';
import * as fse from 'fs-extra';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as esbuild from 'esbuild';
import execa from 'execa';
import { generateOpenApiDocument } from 'trpc-openapi';
import * as fs from 'fs';
import yaml from 'js-yaml';
import express, { Request, Response } from 'express';
import * as bodyParser from 'body-parser';
import cors from 'cors';

import { TestConfig } from '../test-config';
import { apiGwContext, ApiGwEventOptions, apiGwEventV2, setAWSSDKCreds, setEnvVariables } from '@tests/helpers';
import { appRouter } from '@backend/api-ingest/server';
import { handler as handlerApiIngest } from '@backend/api-ingest';
import { handler as handleApiFront } from '@backend/api-front';

process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

const baseDir = '../';
const srcSrc = ['src', 'src'];
const libBuild = ['lib', 'build'];
const paths = {
  workingDir: path.resolve(__dirname, baseDir),
  src: path.resolve(__dirname, baseDir, ...srcSrc),
  dist: path.resolve(__dirname, baseDir, ...libBuild),

  srcBackend: path.resolve(__dirname, baseDir, ...srcSrc, 'backend'),
  distBackend: path.resolve(__dirname, baseDir, ...libBuild, 'backend'),

  srcFrontend: path.resolve(__dirname, baseDir, ...srcSrc, 'frontend'),
  distFrontend: path.resolve(__dirname, baseDir, ...libBuild, 'frontend'),
};

async function runCommand(command: string, args: string[], options: execa.Options<string> = {}, echoCommand = true) {
  if (echoCommand) console.log('> Running:', command, args.join(' '));

  const resp = await execa(command, args, { ...options, preferLocal: true, reject: false });
  if (resp.exitCode !== 0) {
    console.error(resp.stderr || resp.stdout);
    process.exit(1);
  }

  console.log(resp.stdout);
}

const commands = [
  'install-src',
  'validate-src',
  'build-src',
  // 'clean-lib',
  'copy-frontend-client-cdn-script',

  'generate-openapi-ingest',
  'start-local-api-ingest',
  'start-local-api-front',
] as const;
export type Command = (typeof commands)[number];

const argv = yargs(hideBin(process.argv))
  .option('command', {
    alias: 'c',
    describe: 'the command you want to run',
    choices: commands,
  })
  .demandOption(['c']).argv as any;

(async () => {
  const command = argv.c as Command;
  switch (command) {
    case 'build-src':
      await buildTsLambdas();
      await buildLambdas();
      await buildLambdaLayers();
      await copyFrontendCdScript();
      await buildLFrontend();
      break;
    case 'copy-frontend-client-cdn-script':
      await copyFrontendCdScript();
      break;
    // case "clean-lib":
    //   await cleanLib();
    //   break;
    case 'install-src':
      await installSrc();
      break;
    case 'validate-src':
      await validateSrc();
      break;
    case 'generate-openapi-ingest':
      await generateOpenApiIngest();
      break;
    case 'start-local-api-ingest':
      await startLocalApiIngest();
      break;
    case 'start-local-api-front':
      await startLocalApiFront();
      break;
    default:
      throw new Error('Unknown command: ' + command);
  }
})();

async function installSrc() {
  await runCommand('npm', ['ci'], { cwd: paths.srcFrontend });
}
async function validateSrc() {
  /* Not using the npm commands as defined in the package.jsons because we loose the colors and direct link click ability */

  /* All TS */
  await runCommand('tsc', ['--noEmit'], { cwd: paths.src });
  await runCommand('eslint', ['**/*.ts', '--ignore-pattern', "'**/*.d.ts'", '--fix'], { cwd: paths.src });
  /* Frontend Vue */
  await runCommand('vue-tsc', ['--noEmit'], { cwd: paths.srcFrontend });
}

async function buildTsLambdas() {
  console.log('BUILDING TS LAMBDAS');

  const tsLambdaDirectories = [
    'api-front',
    'api-ingest',
    'cron-vacuum',
    'cron-anomaly-detection',
    'worker-anomaly-process',
  ];

  for (const lambdaDir of tsLambdaDirectories) {
    const fullLambdaDir = path.join(paths.srcBackend, lambdaDir);
    const pathTs = path.join(fullLambdaDir, 'index.ts');
    const pathJs = path.join(paths.distBackend, lambdaDir, 'index.js');

    await esbuild.build({
      platform: 'node',
      target: ['esnext'],
      minify: true,
      bundle: true,
      keepNames: true,
      sourcemap: 'linked',
      sourcesContent: false,
      entryPoints: [pathTs],
      outfile: pathJs,
      external: [''],
      logLevel: 'warning',
      metafile: true,
    });
  }

  console.log('LAMBDAS TS BUILD');
}
async function buildLambdas() {
  console.log('BUILDING JS LAMBDAS');

  const basicLambdaDirectories = ['cloudfront'];

  for (const lambdaDir of basicLambdaDirectories) {
    const fullLambdaSrcDir = path.join(paths.srcBackend, lambdaDir);
    const fullLambdaDistDir = path.join(paths.distBackend, lambdaDir);
    await fse.copy(fullLambdaSrcDir, fullLambdaDistDir);
  }

  console.log('BUILT JS LAMBDAS');
}
async function buildLambdaLayers() {
  console.log('BUILDING LAMBDA LAYERS');

  const layerLambdaDirectories = ['layer-geolite2'];

  for (const lambdaDir of layerLambdaDirectories) {
    const fullLambdaSrcDir = path.join(paths.srcBackend, lambdaDir);
    const fullLambdaDistDir = path.join(paths.distBackend, lambdaDir);

    const packageJson = path.join(fullLambdaSrcDir, 'package.json');
    if (fse.existsSync(packageJson)) await runCommand('npm', ['ci'], { cwd: fullLambdaSrcDir });

    await fse.copy(fullLambdaSrcDir, fullLambdaDistDir);
  }

  console.log('BUILT LAMBDA LAYERS');
}
async function copyFrontendCdScript() {
  // Copy the build client cdn script to the frontend assets
  const clientCdnScript = path.join(
    paths.srcFrontend,
    'node_modules',
    'serverless-website-analytics-client',
    'cdn',
    'client-script.js'
  );
  const clientCdnScriptOut = path.join(paths.srcFrontend, 'public', 'cdn', 'client-script.js');
  await fse.copy(clientCdnScript, clientCdnScriptOut);
}
async function buildLFrontend() {
  console.log('BUILDING FRONTEND');

  // Output set to paths.distFrontend in vite.config
  await runCommand('npm', ['run', 'build'], { cwd: paths.srcFrontend });

  console.log('BUILT FRONTEND');
}
// async function cleanLib()
// {
//   console.log("Cleaning lib")
//   const pathsToDelete = [
//       path.join(paths.workingDir, "lib", "src"),
//   ];
//
//   for(let pathToDelete of pathsToDelete)
//   {
//     // console.log("Deleting: ", pathToDelete);
//     await fse.remove(pathToDelete);
//   }
//   console.log("Cleaned lib");
// }

/**
 * Application
 */

async function startLocalApiIngest() {
  // Can put `DEBUG=express:*` in front of the command that starts the server.
  const port = 3000;
  console.log('STARTING..');

  /* Set ENV variables */
  process.env.TESTING_LOCAL = 'true';
  setEnvVariables(TestConfig.env);
  setAWSSDKCreds(TestConfig.awsProfile, TestConfig.awsRegion, true);

  const app = express();
  app.use(bodyParser.text());

  app.use('/', async (req: Request, res: Response) => {
    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: req.method as 'GET' | 'POST' | 'OPTIONS',
      path: req.path,
      body: req.body,
      headers: req.headers as { [p: string]: string },
      pathParameters: req.params,
      queryStringParameters: req.query as { [p: string]: string | undefined } | undefined,
      origin: req.headers.origin,
      ip: '169.0.15.7',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6,2 Safari/605.1.15',
    };

    const resp = await handlerApiIngest(apiGwEventV2(event), context);
    res.status(resp.statusCode).set(resp.headers).end(resp.body);
  });
  app.listen(port);
  console.log('STARTED on port ' + port);
}

async function startLocalApiFront() {
  // Can put `DEBUG=express:*` in front of the command that starts the server.
  const port = 3001;
  console.log('STARTING..');

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
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: req.method as 'GET' | 'POST' | 'OPTIONS',
      path: req.path,
      body: JSON.stringify(req.body),
      headers: req.headers as { [p: string]: string },
      pathParameters: req.params,
      queryStringParameters: req.query as { [p: string]: string | undefined } | undefined,
      origin: req.headers.origin,
    };

    const resp = await handleApiFront(apiGwEventV2(event), context);
    res.status(resp.statusCode).set(resp.headers).end(resp.body);
  });
  app.listen(port);
  console.log('STARTED on port ' + port);
}

async function generateOpenApiIngest() {
  console.time('* GENERATE OPEN API INGEST');
  const openApiDocument = generateOpenApiDocument(appRouter, {
    title: 'Serverless Website Analytics Ingest API',
    version: '-',
    baseUrl: '-',
  });
  fs.writeFileSync('./OpenAPI-Ingest.yaml', yaml.dump(openApiDocument));
  console.timeEnd('* GENERATE OPEN API INGEST');
}
