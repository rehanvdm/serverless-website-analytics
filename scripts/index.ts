import * as path from "path";
import * as fse from 'fs-extra';
import yargs from "yargs"
import {hideBin} from "yargs/helpers"
import * as esbuild from "esbuild";
import * as execa from "execa";

const baseDir = "../";
const srcSrc = ["src", "src"];
const libBuild = ["lib", "build"];
const paths = {
  workingDir: path.resolve(__dirname, baseDir),
  src: path.resolve(__dirname, baseDir, ...srcSrc),
  dist: path.resolve(__dirname, baseDir, ...libBuild),

  srcBackend: path.resolve(__dirname, baseDir, ...srcSrc, "backend"),
  distBackend: path.resolve(__dirname, baseDir, ...libBuild, "backend"),

  srcFrontend: path.resolve(__dirname, baseDir, ...srcSrc, "frontend"),
  distFrontend: path.resolve(__dirname, baseDir, ...libBuild, "frontend"),
};

async function runCommand(command: string, args: string[], options: execa.Options<string> = {}, echoCommand: boolean = true)
{
  if(echoCommand)
    console.log("> Running:", command, args.join(" "));

  const resp = await execa(command, args, { ...options, preferLocal: true, reject: false });
  if (resp.exitCode !== 0)
  {
    console.error(resp.stderr || resp.stdout);
    process.exit(1)
  }

  console.log(resp.stdout);
}

const commands = [
    'install-src',
    'validate-src',
    'build-src',
    'clean-lib',
    'build-lib',
    'copy-frontend-client-cdn-script',
] as const;
export type Command = typeof commands[number];

const argv = yargs(hideBin(process.argv))
  .option('command', {
    alias: 'c',
    describe: 'the command you want to run',
    choices: commands
  })
  .demandOption(['c'])
  .argv as any;


(async () =>
{
  const command = argv.c as Command;
  switch (command)
  {
    case "build-src":
      await buildTsLambdas();
      await buildLambdas();
      await buildLambdaLayers();
      await copyFrontendCdScript();
      await buildLFrontend();
      break;
    case "copy-frontend-client-cdn-script":
      await copyFrontendCdScript();
      break;
    case "clean-lib":
      await cleanLib();
      break;
    case "install-src":
      await installSrc();
      break;
    case "validate-src":
      await validateSrc();
      break;
    default:
        throw new Error("Unknown command: " + command);
  }
})();

async function installSrc()
{
  await runCommand('npm', ['ci'], { cwd: paths.src });
  await runCommand('npm', ['ci'], { cwd: paths.srcFrontend });
}
async function validateSrc()
{
  /* Not using the npm commands as defined in the package.jsons because we loose the colors and direct link click ability */

  /* All TS */
  await runCommand('tsc', ["--noEmit"], { cwd:paths.src});
  await runCommand('eslint', ['**/*.ts' , "--ignore-pattern", "'**/*.d.ts'", "--fix"], { cwd:paths.src });
  /* Frontend Vue */
  await runCommand('vue-tsc', ['--noEmit' ], { cwd:paths.srcFrontend });
}

async function buildTsLambdas()
{
  console.log("BUILDING TS LAMBDAS")

  const tsLambdaDirectories = [
    "api-front",
    "api-ingest",
    "cron-vacuum",
  ];

  for( let lambdaDir of tsLambdaDirectories)
  {
    let fullLambdaDir =  path.join(paths.srcBackend, lambdaDir);
    let pathTs =  path.join(fullLambdaDir, "index.ts");
    let pathJs =  path.join(paths.distBackend, lambdaDir, "index.js");

    await esbuild.build({
      platform: 'node',
      target: ["esnext"],
      minify: true,
      bundle: true,
      keepNames: true,
      sourcemap: 'linked',
      sourcesContent: false,
      entryPoints: [pathTs],
      outfile: pathJs,
      external: [""],
      logLevel: "warning",
      metafile: true,
    })
  }

  console.log("LAMBDAS TS BUILD");
}
async function buildLambdas()
{
  console.log("BUILDING JS LAMBDAS")

  const basicLambdaDirectories = [
    "cloudfront",
  ];

  for( let lambdaDir of basicLambdaDirectories)
  {
    let fullLambdaSrcDir =  path.join(paths.srcBackend, lambdaDir);
    let fullLambdaDistDir =  path.join(paths.distBackend, lambdaDir);
    await fse.copy(fullLambdaSrcDir, fullLambdaDistDir);
  }

  console.log("BUILT JS LAMBDAS");
}
async function buildLambdaLayers()
{
  console.log("BUILDING LAMBDA LAYERS")

  const layerLambdaDirectories = [
    "layer-geolite2",
  ];

  for( let lambdaDir of layerLambdaDirectories)
  {
    let fullLambdaSrcDir =  path.join(paths.srcBackend, lambdaDir);
    let fullLambdaDistDir =  path.join(paths.distBackend, lambdaDir);

    let packageJson =  path.join(fullLambdaSrcDir, "package.json");
    if(fse.existsSync(packageJson))
      await runCommand('npm', ['ci'], { cwd: fullLambdaSrcDir });

    await fse.copy(fullLambdaSrcDir, fullLambdaDistDir);
  }

  console.log("BUILT LAMBDA LAYERS");
}
async function copyFrontendCdScript()
{
  //Copy the build client cdn script to the frontend assets
  const clientCdnScript =  path.join(paths.srcFrontend, "node_modules", "serverless-website-analytics-client", "cdn", "client-script.js");
  const clientCdnScriptOut =  path.join(paths.srcFrontend, "public", "cdn", "client-script.js");
  await fse.copy(clientCdnScript, clientCdnScriptOut);
}
async function buildLFrontend()
{
  console.log("BUILDING FRONTEND")

  //Output set to paths.distFrontend in vite.config
  await runCommand('npm', ['run', 'build'], { cwd: paths.srcFrontend });

  console.log("BUILT FRONTEND");
}
async function cleanLib()
{
  console.log("Cleaning lib")
  const pathsToDelete = [
      path.join(paths.workingDir, "lib", "src"),
  ];

  for(let pathToDelete of pathsToDelete)
  {
    // console.log("Deleting: ", pathToDelete);
    await fse.remove(pathToDelete);
  }
  console.log("Cleaned lib");
}
