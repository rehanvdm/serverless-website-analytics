import { awscdk, javascript } from 'projen';
import { ArrowParens, NpmAccess, TrailingComma } from 'projen/lib/javascript';

const project = new awscdk.AwsCdkConstructLibrary({
  projenrcTs: true,
  name: 'serverless-website-analytics',
  author: 'rehanvdm',
  authorAddress: 'rehan.vdm4@gmial.com',
  license: 'GPL-2.0-or-later',
  workflowNodeVersion: '18',
  cdkVersion: '2.79.1',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.0.0',
  packageManager: javascript.NodePackageManager.NPM,
  releaseToNpm: true,
  npmAccess: NpmAccess.PUBLIC,
  repositoryUrl: 'https://github.com/rehan.merwe/serverless-website-analytics.git',
  excludeTypescript: ['src/src/**/*'],
  devDeps: ['husky', 'execa@5', 'fs-extra', '@types/fs-extra', 'esbuild', 'yargs'],
  eslint: true,
  prettier: true,
  prettierOptions: {
    settings: {
      printWidth: 120,
      useTabs: false,
      tabWidth: 2,
      semi: true,
      singleQuote: true,
      bracketSpacing: true,
      trailingComma: TrailingComma.ES5,
      arrowParens: ArrowParens.ALWAYS,
    },
  },
});

project.package.addEngine('node', '~18.*');
project.package.addEngine('npm', '~9.*');
project.npmignore!.exclude('scripts/**/*');
project.tsconfigDev!.addInclude('scripts/**/*');
project.eslint!.ignorePatterns!.push('src/src/**');
project.jest!.addIgnorePattern('<rootDir>/src/src');

project.compileTask.exec('ts-node ./scripts/index.ts -c install-src');
project.compileTask.exec('ts-node ./scripts/index.ts -c validate-src');
project.compileTask.exec('ts-node ./scripts/index.ts -c build-src');
project.compileTask.exec('ts-node ./scripts/index.ts -c clean-lib'); //removes source

project.synth();
