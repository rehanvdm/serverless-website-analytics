# Contributing

1. If you start to work on something, create an issue on it first, then do one of the following to indicate you are working on it:
   - Comment on the issue you created
   - Create a draft PR
   - DM me on any social media
2. This is so I can keep an accurate [roadmap](https://github.com/users/rehanvdm/projects/1/views/1) and ensure that no one is working on the same thing at the same time.
3. Code changes need accompanying tests.
4. Commits + PR names must follow the [Conventional Commits](https://gist.github.com/Zekfad/f51cb06ac76e2457f11c80ed705c95a3) standard.
Available PR name types:
   - feat
   - fix
   - docs
   - ci
   - chore
5. Install husky to run the git hooks on committing:
```
husky install
```

Alternatively run the following command **before committing** to check if your changed code passes the linter, prettier
and tsc checks:
```
npm run pre-commit-check
```

## No Projen and JSII

See [EJECTING_FROM_PROJEN.md](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/EJECTING_FROM_PROJEN.md)
for more details.

## Setup

Install packages:
```
npm install
cd application/src/frontend && npm install
```

The build system is powered by [wireit](https://github.com/google/wireit).

The only commands that you have to know about and run are in the  `package.json`. These commands execute TS code in
`scripts/index.ts`. There are commands from building application code to packaging code. Most of the time you won't have
to modify these.

## Tests

Testes are done with `mocha` and `chai`. Both use [esbuid-runner](https://github.com/folke/esbuild-runner) to transpile
the TS to JS when testing.

Tests for the source code are both unit and end-to-end tests. This is decided by the `process.env.TEST_TYPE` flag in the
`tests/applications/environment-hoist.ts` file. If set to `UNIT`, breakpoints can be placed in code and it can be debugged.
If set to `E2E`, it will do the actual API call and use the same test criteria as for the unit test.

The tests require a config file as we test against real AWS resources. The config file is located at
`tests/test-config.ts`. These will have to be changed if you are running the tests in your own AWS account.

## Running the backend and frontend locally

The backend and frontend can be started locally for an improved DX. The backend will run as an express app that
wraps around the tRPC server, similarly to the tests, it makes use of the `tests/test-config.ts` file and uses
real AWS resources. The frontend will run using the Vite dev command.
```
npm run start-frontend
npm run watch-local-api-front-watch
npm run watch-local-api-ingest-watch
```

## Highlights

### Record storage strategy
Events/logs/records are stored in S3 in a partitioned manner. The partitioning is dynamic, so all that is left is to store
the data correctly and that is done by Kinesis Firehose in the format of: site and day(`2023-08-23`). The records are buffered
and stored in parquet format. We are currently using an Append Only Log (AOL) pattern. This means that we are never
updating the logs, we are only adding new ones.

In order to track the time the user has been on the page we do the following:
- Create a unique `page_id` for the current page view
- When the user first loads the page we write a record with the `time_on_page` property set to 0
- When the user leaves the page we write a record with the `time_on_page` property set to the time the user has been on the page

This means we store almost twice as many records as opposed to updating the record when the user leaves the page. Updating
a single record inside a parquet file is not possible, or even if it is we would have to rewrite the whole file. We also
do not want to do individual PUTs for each record as that would be too expensive.

The reason for writing the first record is that we can not assume the second record will reach us when the user navigates
away from the page. This is because the user might close the tab or browser before the record is sent. This is mitigated
by the client that uses the `navigator.sendBeacon(...)` function instead of a normal HTTP request.

The `navigator.sendBeacon(...)` has type `ping` in Chrome or `beacon` in FireFox instead of `POST` (but we receive it as a
POST server side), it also does not send preflight `OPTION` calls even if it is not the same host. Browsers just handle
it slightly differently and the probability of it being delivered is greater than fetch with `keepalive` set.
More on the [topic](https://medium.com/fiverr-engineering/benefits-of-sending-analytical-information-with-sendbeacon-a959cb206a7a).

### Vacuum and record format

As mentioned above, we are using an AOL pattern. The `page_id` is used to group these records, the first records is when
the page is navigated to and the second one when they leave. The only value that differs between the two is that the last
one will have a higher `time_on_page`. So when we do queries we need to group by the `page_id` and then order by the
biggest `time_on_page` and select the first one.

Depending on the Firehose buffer time, we will have multiple records in a single parquet file. If the buffer time is set
to say 1 minute and we get 1 view every 10 seconds, we will have 1440 parquet files per day. Athena reading S3 files
can get expensive considering that we do about 8 queries per dashboard load. Let's also assume we look at 30 days data
and that we view the dashboard 100 times that month. That means we will be scanning 1440 * 8 * 30 * 100 = 34,560,000 records.
Let's use one of the cheapest region's, `us-east-1`, where 1000 S3 reads cost $0.0004. This means that we will be paying
$13.82 for the S3 reads and as we know, is the biggest cost driver, see [COST](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/COST.md)
for more info on cost estimations.

This is why we run a vacuum function that will for each site, run the group by and order function mentioned before.
This results in less parquet files, it should be around 4, and it will also be magnitudes smaller.

The vacuum function runs at 01:00 UTC when all the previous day's data has been written to S3. It runs as a CTAS query
and stores the data back into the original S3 location the Athena query used to select from. This is by design as we
then delete all the S3 files before the CTAS query ran, making the process idempotent.

There will be a brief period when the Firehose parquet files and the CTAS parquet files are both in S3. This is fine
because of how we query data, group by `page_id` and then order by `time_on_page`. There will just be slightly more
records scanned before the Firehose parquet files are deleted.

See benchmarks on this https://github.com/rehanvdm/serverless-website-analytics/pull/43

### Other

CloudFront has multiple behaviours setup:
- `/api-front` Routes to the frontend Lambda Function URL
- `/api-ingest` Routes to the ingest Lambda Function URL
- `/*` Vue 3 SPA

## Design Decisions

These are just some of the design decisions (mini ADRs) that were made during the development of this project.

### Using S3 website hosting as the origin instead of OAI(Origin Access Identity )

We need the error document of the static website to also point to `index.html`, for handling deep linking and errors.
We can not set the error document on the CloudFront as it will also be returned for the reverse proxied APIs.
It needs to be set on S3 website origin, hence we are doing it the "old" way.

### Using LambdaFunction URLs

It does not make sense to use HTTP APIs and even less so REST APIs if we consider our objectives.

API requests will go: `Client => CloudFront => Lambda`. We do not use enough of the HTTP API features
to justify adding it in the mix: `Client => CloudFront => HTTP API => Lambda`. The only thing we would benefit from is
the route level throttling but that is not well documented and even supported in the AWS console.

Advantages:
- Cost nothing to execute the Function URL
- Less integration latency

Disadvantages:
- Have to log at least 1 custom metric because when the API Lambda errors, it still returns data (success) and we need to
  track the 500s. This means +$0.30 but it is still less and almost constant compared to the $1 per million request for HTTP
  APIs.
- Can not do method-level throttling. But this seems to be a mission in the CDK/CFN as well, not well supported but possible.
- We will throttle on a Lambda level

### Number size limits

The different sizes for numbers used in the project:
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

### TypeScript

Tests are using mocha + chai and are written in TS as well. TSC is too slow, so we are using
[esbuild-runner](https://www.npmjs.com/package/esbuild-runner) instead. Mocha needs to transpile the TS before it can
run the JS it produces. The `esbuild-runner-compile.js` file is registered in the `./.mocharc.json` file.

We also register the [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) package because we are using `paths` in the `.tsconfig.json` file. This
enables us to use `@src/backend/api/server.ts` instead of those nasty relative paths (`../../../src/backend/api/server.ts`)

There is no separate TS config for the frontend, this is because the backend and frontend share the same TS paths and
there were some strange results with tRPC not typing correctly.

### null  vs undefined

The API will always return `null` to indicate that a value is not set. A value of `undefined` will indicate that the
value is not set and that the key is not present in the object. This is important for the PageFilter and EventFilter.
A value of `null` will search where that column has no value and `undefined` will ignore that column from the search.
