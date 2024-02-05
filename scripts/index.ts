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
import { TestConfig } from '@tests/test-config';
import {
  apiGwContext,
  ApiGwEventOptions,
  apiGwEventV2,
  setAWSSDKCreds,
  setEnvVariables,
} from '@tests/application/helpers';
import { appRouter } from '@backend/api-ingest/server';
import { handler as handlerApiIngest } from '@backend/api-ingest';
import { handler as handleApiFront } from '@backend/api-front';
import tsConfigPaths from 'tsconfig-paths';

process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

const baseDir = '../';
const infraSrc = ['infra', 'src'];
const infraBuild = ['infra', 'build'];
const applicationSrc = ['application', 'src'];
const applicationBuild = ['application', 'build'];

const paths = {
  workingDir: path.resolve(__dirname, baseDir),

  infraSrc: path.resolve(__dirname, baseDir, ...infraSrc),
  infraBuild: path.resolve(__dirname, baseDir, ...infraBuild),

  applicationSrc: path.resolve(__dirname, baseDir, ...applicationSrc),
  applicationBuild: path.resolve(__dirname, baseDir, ...applicationBuild),

  applicationBackendSrc: path.resolve(__dirname, baseDir, ...applicationSrc, 'backend'),
  applicationBackendBuild: path.resolve(__dirname, baseDir, ...applicationBuild, 'backend'),

  applicationFrontendSrc: path.resolve(__dirname, baseDir, ...applicationSrc, 'frontend'),
  applicationFrontendBuild: path.resolve(__dirname, baseDir, ...applicationBuild, 'frontend'),

  package: path.resolve(__dirname, baseDir, 'package'),
  packageApplicationBuild: path.resolve(__dirname, baseDir, 'package', ...applicationBuild),
  packageInfraBuild: path.resolve(__dirname, baseDir, 'package', ...infraBuild),
};

function createOrEmptyDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  else {
    fs.rmSync(dir, { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function runCommand(command: string, args: string[], options: execa.Options<string> = {}, echoCommand = true) {
  if (echoCommand) console.log('> Running:', command, args.join(' '));

  const resp = await execa(command, args, { preferLocal: true, reject: false, ...options });
  if (resp.exitCode !== 0) {
    console.error(resp.stderr || resp.stdout);
    process.exit(1);
  }

  console.log(resp.stdout);
}

const commands = [
  'validate',
  'build-application',
  // 'clean-lib',
  'copy-frontend-client-cdn-script',

  'generate-openapi-ingest',
  'start-local-api-ingest',
  'start-local-api-front',

  'package',
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
    case 'build-application':
      createOrEmptyDir(paths.applicationBuild);
      await buildTsLambdas();
      await buildLambdas();
      await buildLambdaLayers();
      await copyFrontendCdScript();
      await buildLFrontend();
      break;
    case 'copy-frontend-client-cdn-script':
      await copyFrontendCdScript();
      break;

    case 'validate':
      await validate();
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
    case 'package':
      await createPackage();
      break;
    default:
      throw new Error('Unknown command: ' + command);
  }
})();

async function validate() {
  /* Not using the npm commands as defined in the package.jsons because we loose the colors and direct link click ability */
  /* All TS */
  await runCommand('eslint', ['**/*.ts'], {
    cwd: paths.workingDir,
  });

  /* Frontend Vue */
  await runCommand('vue-tsc', ['--noEmit'], { cwd: paths.applicationFrontendSrc });
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
    const fullLambdaDir = path.join(paths.applicationBackendSrc, lambdaDir);
    const pathTs = path.join(fullLambdaDir, 'index.ts');
    const pathJs = path.join(paths.applicationBackendBuild, lambdaDir, 'index.js');

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
    const fullLambdaSrcDir = path.join(paths.applicationBackendSrc, lambdaDir);
    const fullLambdaDistDir = path.join(paths.applicationBackendBuild, lambdaDir);
    await fse.copy(fullLambdaSrcDir, fullLambdaDistDir);
  }

  console.log('BUILT JS LAMBDAS');
}
async function buildLambdaLayers() {
  console.log('BUILDING LAMBDA LAYERS');

  const layerLambdaDirectories = ['layer-geolite2'];

  for (const lambdaDir of layerLambdaDirectories) {
    const fullLambdaSrcDir = path.join(paths.applicationBackendSrc, lambdaDir);
    const fullLambdaDistDir = path.join(paths.applicationBackendBuild, lambdaDir);

    const packageJson = path.join(fullLambdaSrcDir, 'package.json');
    if (fse.existsSync(packageJson)) await runCommand('npm', ['ci'], { cwd: fullLambdaSrcDir });

    await fse.copy(fullLambdaSrcDir, fullLambdaDistDir);
  }

  console.log('BUILT LAMBDA LAYERS');
}
async function copyFrontendCdScript() {
  // Copy the build client cdn script to the frontend assets
  const clientCdnScript = path.join(
    paths.applicationFrontendSrc,
    'node_modules',
    'serverless-website-analytics-client',
    'cdn',
    'client-script.js'
  );
  const clientCdnScriptOut = path.join(paths.applicationFrontendSrc, 'public', 'cdn', 'client-script.js');
  await fse.copy(clientCdnScript, clientCdnScriptOut);
}
async function buildLFrontend() {
  console.log('BUILDING FRONTEND');

  // Output set to paths.distFrontend in vite.config
  await runCommand('npm', ['run', 'build'], { cwd: paths.applicationFrontendSrc });

  console.log('BUILT FRONTEND');
}

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

function replaceStringInFiles(directoryPath: string, searchString: string, replacementString: string): void {
  const files = fs.readdirSync(directoryPath);

  files.forEach((file) => {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // Recursively call replaceStringInFiles for subdirectories
      replaceStringInFiles(filePath, searchString, replacementString);
    } else {
      // Read the file contents
      let fileContent = fs.readFileSync(filePath, 'utf8');

      // Replace the string
      fileContent = fileContent.replace(new RegExp(searchString, 'g'), replacementString);

      // Write the modified content back to the file
      fs.writeFileSync(filePath, fileContent, 'utf8');
    }
  });
}

async function createPackage() {
  console.time('PACKAGE');

  createOrEmptyDir(paths.infraBuild);

  await runCommand('tsc', ['--project', 'tsconfig.package.infra.json']);

  // Remove infra/src nesting from tsc output
  await fse.copy(path.join(paths.workingDir, '.tsc-output/infra/src'), path.join(paths.infraBuild));
  // Remove application/src from tsc output and place into application
  await fse.copy(
    path.join(paths.workingDir, '.tsc-output/application/src'),
    path.join(paths.infraBuild, 'application')
  );
  // Rewrite the @backend tsconfig path to application/backend
  replaceStringInFiles(path.join(paths.infraBuild), '@backend/', './application/backend/');

  // Copy Build to package
  await fse.copy(paths.applicationBuild, paths.packageApplicationBuild);
  await fse.copy(paths.infraBuild, paths.packageInfraBuild);

  // Copy package.json and README.md
  await fse.copy(paths.workingDir + '/package.json', paths.packageInfraBuild + '/package.json');

  // Read the package.json that will be published and remove some stuff
  const packageJson = JSON.parse(fs.readFileSync(paths.workingDir + '/package.json').toString());
  delete packageJson.dependencies;
  delete packageJson.scripts;
  delete packageJson.wireit;
  fs.writeFileSync(paths.package + '/package.json', JSON.stringify(packageJson, null, 2));

  fs.copyFileSync(paths.workingDir + '/README.md', paths.package + '/README.md');

  console.timeEnd('PACKAGE');
}
