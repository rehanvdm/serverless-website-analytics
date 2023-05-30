# Contributing

If you start to work on something, create an issue on it first, then do one of the following to indicate you are working on it:
- Comment on the issue you created
- Create a draft PR
- DM me on any social media

This is so I can keep an accurate [roadmap](https://github.com/users/rehanvdm/projects/1/views/1) and ensure that no one is working on the same thing at the same time.

Code changes need accompanying tests.

Commits + PR names must follow the [Conventional Commits](https://gist.github.com/Zekfad/f51cb06ac76e2457f11c80ed705c95a3) standard.
Available PR name types:
- feat
- fix
- docs
- ci
- chore

## Projen

This repo follows the standard setup. The only deviation being the `src` directory for the source code. The whole
application source code is within the `/src` directory, it can run independently of projen. This is because I want/am
using this as a template where I can take any existing project and convert it to a projen project. This way I can
keep the source code in the same place and not have to worry about things like conflicting packages and TS paths.



## Setup

Install packages:
```
npm install
cd src/src/ && npm install
cd src/src/frontend && npm install
```

There are two build systems used, the top level projen one for everything projen related and then the one in the
`src/src` directory for the actual source code uses [wireit](https://github.com/google/wireit).

The only commands that you have to know about and run are in:
- `package.json` - The top level projen commands
- `src/src/package.json` - The wireit commands

## Tests


Similar to the build systems, there are two test systems. The top level projen one for everything projen related that
uses `ts-jest` and then the one in the `src/src/tests` directory for the actual source code tests that uses `mocha`
and `chai`. Both use `esbuid-runner` to transpile the TS to JS when testing.

Tests for the source code are both unit and end-to-end tests. This is decided by the `process.env.TEST_TYPE` flag in the
`src/src/tests/environment-hoist.ts` file. If set to `UNIT`, breakpoints can be placed in code and it can be debugged.
If set to `E2E`, it will do the actual API call and use the same test criteria as for the unit test.

The tests require a config file as we test against real AWS resource. The config file is located at
`src/src/test-config.ts`. These will have to be changed if you are running the tests in your own AWS account.

## Running the backend and frontend locally

The backend and frontend can be started locally for an improved DX. The backend will run as an express app that
wraps around the tRPC server, similarly to the tests, it makes use of the `src/src/test-config.ts` file and uses
real AWS resource. The frontend will run using the Vite dev command.
```
cd src/src/
npm run start-frontend
npm run watch-local-api-front-watch
npm run watch-local-api-ingest-watch
```

## Highlights

### Record storage strategy
Events/logs/records are stored in S3 in a partitioned manner. The partitioning is done by site, month and day by
Kinesis Firehose. The records are stored in parquet format. We are currently using an Append Only Log (AOL) pattern.
This means that we are never updating the logs, we are only adding new ones.

In order to track the time the use has been on the page we do the following:
- Create a unique page_id for the current page view
- When the user first loads the page we write a record with the `time_on_page` property set to 0
- When the user leaves the page we write a record with the `time_on_page` property set to the time the user has been on the page

This means we store almost twice as many records as opposed to updating the record when the user leaves the page. Updating
a single record inside a parquet file is not possible, or even if it is we would have to rewrite the whole file. We also
do not want to do individual PUTs for each record as that would be too expensive.

Technically we can do a CTAS query to remove the duplicate records, but my quick tests did not show much improvement on
query speed. This is why we rather do the group by the page_id and then take the record with the largest time_on_page as
the latest record for that page view.

The reason for writing the first record is that we can not assume the second record will reach us when the user navigates
away from the page. This is because the user might close the tab or browser before the record is sent. This is mitigated
by the client that uses the `navigator.sendBeacon(...)` function instead of a normal HTTP request.

The `navigator.sendBeacon(...)` has type `ping` in Chrome or `beacon` in FireFox instead of `POST` (but we receive it as a
POST server side), it also does not send preflight `OPTION` calls even if it is not the same host. Browsers just handle
it slightly differently and the probability of it being delivered is greater than fetch with `keepalive` set.
More on the [topic](https://medium.com/fiverr-engineering/benefits-of-sending-analytical-information-with-sendbeacon-a959cb206a7a).

### Other

CloudFront has multiple behaviours setup:
- `/api-front` Routes to the frontend Lambda Function URL
- `/api-ingest` Routes to the ingest Lambda Function URL
- `/*` Vue 3 SPA

## Design Decisions

These are just some of the design decisions (mini ADRs) that were made during the development of this project.

### Using S3 website hosting as the origin instead of OAI(Origin Access Identity )

We need the error document of the static website to also point to `index.html`, for handling deeplinking and errors.
We can not set the error document on the CloudFront as it will also be returned for the reverse proxied APIs.
It needs to be set on S3 website origin, hence we are doing it the "old" way.

### Using LambdaFunction URLs

It does not make sense using HTTP APIs and even less so REST APIs if we consider our objectives.

API requests will go: `Client => CloudFront => Lambda`. We do not use enough of the HTTP API features
to justify adding it in the mix: `Client => CloudFront => HTTP API => Lambda`. The only thing we would benefit from is
the route level throttling but that is not well documented and even supported in the AWS console.

Advantages:
- Cost nothing to execute on th Function URL
- Less integration latency

Disadvantages:
- Have to log at least 1 custom metric because when the API Lambda errors, it still returns data (success) and we need to
  track the 500s. This means +$0.30 but it is still less and almost constant compared to the $1 per million request for HTTP
  APIs.
- Can not do method level throttling. But this seems to be a mission in the CDK/CFN as well, not well supported but possible.
- Throttle on a Lambda level

### Number size limits

The different size for numbers used in the project:
- Athena: `2^63 - 1`
- JS: `2^53 - 1`
- JSON: Arbitrary large

JS has the smallest number size. We could use `BigInt` to also represent arbitrarily large numbers on the JS side
but that would mean that we need to convert all numbers to strings and then back to numbers on the frontend again.

We are making the assumption that the numbers we get from Athena are not larger than `2^53 - 1`, that is
`9,007,199,254,740,991` or more than 9 quintillion. This assumption is made on the basis that if you hit this limit you
have probably outgrown this solution, as the Objectives defined above will not align with your use case.

More info on the subject can be found [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt#use_within_json)
and [here](https://www.smashingmagazine.com/2019/07/essential-guide-javascript-newest-data-type-bigint/).

### Dates & Timezones

Dates are passed in ISO format in all DTOs and are assumed to be UTC. They are then parsed and used as UTC in the
backend when making queries to Athena.

### The TS

Tests are using mocha + chai and written in TS as well. TSC is too slow, so we are using
[esbuild-runner](https://www.npmjs.com/package/esbuild-runner) instead. Mocha needs to transpile the TS before it can
run the JS it produces. The `.src/src//tests/esbuild-runner-compile.js` file is registered in the `./.mocharc.json` file.

We also register the [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) package because we are using `paths` in the `.tsconfig.json` file. This
enables us to use `@src/backend/api/server.ts` instead of those nasty relative paths (`../../../src/backend/api/server.ts`)

There is no separate TS config for the frontend, this is because the backend and frontend share the same TS paths and
there were some strange results with tRPC not typing correctly.
