# Serverless Website Analytics

- [Objectives](#objectives)
- [Getting started](#getting-started)
    * [Serverside setup](#serverside-setup)
        + [Certificate Requirements](#certificate-requirements)
    * [Client side setup](#client-side-setup)
        + [Standalone Import Script Usage](#standalone-import-script-usage)
        + [SDK Client Usage](#sdk-client-usage)
- [Worst case projected costs](#worst-case-projected-costs)
- [What's in the box](#what-s-in-the-box)
    * [Frontend](#frontend)
    * [Backend](#backend)
    * [Ingestion API](#ingestion-api)
- [Upgrading](#upgrading)
- [Sponsors](#sponsors)
- [Contributing](#contributing)
- [Roadmap](#roadmap)

This is a CDK serverless website analytics construct that can be deployed to AWS. This construct creates backend,
frontend and the ingestion APIs.

This solution was designed for multiple websites with low to moderate traffic. It is designed to be as cheap as
possible, but it is not free. The cost is mostly driven by the ingestion API that saves the data to S3 through a
Kinesis Firehose.

You can see a LIVE DEMO [HERE](https://demo.serverless-website-analytics.com/) and read about the simulated traffic
[here](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/DEMO-TRAFFIC.md)

## Objectives
- Multi site
- Privacy focused, don't store any Personally Identifiable Information (PII).
- Low frequency of dashboard views
- The target audience is small to medium website(s) with low to moderate page view traffic (equal or less than 10M views)
- Lowest possible cost
- KISS
- No direct server-side state
- Low maintenance
- Easy to deploy in your AWS account, any *region
- Pay for what you use (scale to 0)

The main objective is to keep it simple and the operational cost low, keeping true to "scale to 0" tenants of serverless,
even if it goes against "best practices".

## Getting started

> 📖 Alternatively, read a [step-by-step guide](https://dev.to/aws/deploying-a-serverless-web-analytics-solution-for-your-websites-5coh) written by Ricardo Sueiras

### Serverside setup

> ⚠️ Requires your project `aws-cdk` and `aws-cdk-lib` packages to be greater than  2.79.1

Install the [CDK construct library](https://www.npmjs.com/package/serverless-website-analytics) in your project:
```
npm install serverless-website-analytics
```

Add the construct to your stack:
```typescript
import { ServerlessWebsiteAnalytics } from 'serverless-website-analytics';

export class App extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    ...

    new Swa(this, 'swa-demo-codesnippet-screenshot', {
      environment: 'prod',
      awsEnv: {
        account: this.account,
        region: this.region,
      },
      sites: ['example.com', 'tests1', 'tests2'],
      allowedOrigins: ['*'],
      /* None and Basic Auth also available, see options below */
      auth: {
        cognito: {
          loginSubDomain: 'login',
          users: [
              { name: '<full name>',  email: '<name@mail.com>' },
          ]
        }
      },
      /* Optional, if not specified uses default CloudFront and Cognito domains */
      domain: {
        name: 'demo.serverless-website-analytics.com',
        /* The certificate must be in us-east-1 */
        usEast1Certificate: wildCardCertUsEast1,
        /* Optional, if not specified then no DNS records will be created. You will have to create the DNS records yourself. */
        hostedZone: route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
          hostedZoneId: 'Z00387321EPPVXNC20CIS',
          zoneName: 'demo.serverless-website-analytics.com',
        }),
      },
      /* Optional, adds alarms and dashboards but also raises the cost */
      observability: {
        dashboard: true,
        alarms: {
          alarmTopic,
          alarmTypes: AllAlarmTypes
        },
      }
    });

  }
}
```

Quick option rundown:
- `sites`: The list of allowed sites. This does not have to be a domain name, it can also be string. It can be anything
  you want to use to identify a site. The client-side script that sends analytics will have to specify one of these names.
- `firehoseBufferInterval`: The number in seconds for the Firehose buffer interval. The default is 15 minutes (900 seconds), minimum is 60 and
  maximum is 900.
- `allowedOrigins`: The origins that are allowed to make requests to the backend Ingest API. This CORS check is done as an extra
  security measure to prevent other sites from making requests to your backend. It must include the protocol and
  full domain. Ex: If your site is `example.com` and it can be accessed using `https://example.com` and
  `https://www.example.com` then both need to be listed. A value of `*` specifies all origins are allowed.
- `auth`: Defaults to none. If you want to enable auth, you can specify either Basic Auth or Cognito auth but not both.
  - `undefined`: If not specified, then no authentication is applied, everything is publicly available.
  - `basicAuth`: Uses a CloudFront function to validate the Basic Auth credentials. The credentials are hard coded in
    the Lambda function. This is not recommended for production, it also only secures the HTML page abd API is still
    accessible without auth.
  - `cognito`: Uses an AWS Cognito user pool. Users will get a temporary password via email after deployment. They will
    then be prompted to change their password on the first login. This is the recommended option for production as it uses
    JWT tokens to secure the API as well.
- `domain`: If specified, it will create the CloudFront and Cognito resources at the specified domain and optionally
  create the DNS records in the specified Route53 hosted zone. If not specified, it uses the default autogenerated
  CloudFront(`cloudfront.net`) and Cognito(`auth.us-east-1.amazoncognito.com`) domains. You can read the website URL
  from the stack output.
- `observability`: Adds a CloudWatch Dashboard and Alarms if specified.
- `rateLimit`: Adds a rate limit to the Ingest API and Frontend/Dashboard API. Defaults to 200 and 100 respectively.

For a full list of options see the [API.md](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/API.md#api-reference-) docs.

You can see an example implementation of the demo site [here](https://github.com/rehanvdm/serverless-website-analytics-test)

#### Certificate Requirements
When specifying a domain, the certificate must be in `us-east-1` but your stack can be in ANY region. This is because
CloudFront requires the certificate to be in `us-east-1`.

You have one of two choices:
  - Create the certificate in `us-east-1` manually (Click Ops) and import it from the Cert ARN as in the [demo example](https://github.com/rehanvdm/serverless-website-analytics-test/blob/main/lib/app.ts#L16).
  - Create a `us-east-1` stack that your main stack (that contains this construct) depends. This main stack can be in any region.
    Create the Certificate in the `us-east-1` stack and export the cert ARN. Then import the cert ARN in your main stack.
    Ensure that you have the [crossRegionReferences](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Stack.html#crossregionreferences) flag set
    on both stacks so that the CDK can export and import the Cert ARN via SSM. This is necessary because CloudFormation
    can not export and import values across regions. Alternatively you can DIY it, here is a blog from [AWS](https://aws.amazon.com/blogs/infrastructure-and-automation/read-parameters-across-aws-regions-with-aws-cloudformation-custom-resources/)
    and a quick example from [SO](https://stackoverflow.com/questions/59774627/cloudformation-cross-region-reference).

### Client side setup

There are **two ways to use the client**:
- **Standalone import script** - Single line, standard JS script in your HTML.
- **SDK client** - Import the SDK client into your project and use in any SPA.

#### Standalone Import Script Usage

Then include the standalone script in your HTML:
```html
<html lang="en">
<head> ... </head>
<body>
...
<script src="<YOUR BACKEND ORIGIN>/cdn/client-script.js" site="<THE SITE YOU ARE TRACKING>" attr-tracking="true"></script>
</body>
</html>
```
You need to replace `<YOUR BACKEND ORIGIN>` with the origin of your deployed backend. Available attributes on the script
are:
- `site` - Required. The name of your site, this must correspond with the name you specified when deploying the
  `serverless-website-analytics` backend.
- `attr-tracking` - Optional. If `"true"`, the script will track all `button` and `a` HTML elements that have the
  `swa-event` attribute on them. Example: `<button swa-event="download">Download</button>`, it is also possible to
    specify a category(`swa-event-category`) and the data(`swa-event-data`).

See the [client-side library](https://www.npmjs.com/package/serverless-website-analytics-client) for more options.

Beacon/pixel tracking can be used as alternative to HTML attribute tracking. Beacon tracking is useful for
tracking events outside your domain, like email opens, external blog views, etc.
See the [client-side library](https://www.npmjs.com/package/serverless-website-analytics-client) for more info.
```html
<img src="<YOUR BACKEND ORIGIN>/api-ingest/v1/event/track/beacon.gif?site=<SITE>&event=<EVENT>" height="1" width="1" alt="">
```

#### SDK Client Usage

Install the [client-side library](https://www.npmjs.com/package/serverless-website-analytics-client):
```
npm install serverless-website-analytics-client
```

Irrelevant of the framework, you have to do the following to track page views on your site:

1. Initialize the client only once with `analyticsPageInit`. The site name must correspond with the one that you specified
   when deploying the `serverless-website-analytics` backend. You also need the URL to the backend. Make sure your frontend
   site's `Origin` is whitelisted in the backend config.
2. On each route change call the `analyticsPageChange` function with the name of the new page.

> [!IMPORTANT]
> The `serverless-website-analytics` can be used in **ANY framework**. To demonstrate this, find examples for Svelte and React in the
> [_client project_](https://github.com/rehanvdm/serverless-website-analytics-client#usage)

#### Vue

[_./serverless-website-analytics-client/usage/vue/vue-project/src/main.ts_](https://github.com/rehanvdm/serverless-website-analytics-client/blob/master/usage/vue/vue-project/src/main.ts)
```typescript
...
import * as swaClient from 'serverless-website-analytics-client';

const app = createApp(App);
app.use(router);

swaClient.v1.analyticsPageInit({
  inBrowser: true, //Not SSR
  site: "<Friendly site name>", //example.com
  apiUrl: "<YOUR BACKEND ORIGIN>", //https://my-serverless-website-analytics-backend.com
  // debug: true,
});
router.afterEach((event) => {
  swaClient.v1.analyticsPageChange(event.path);
});

app.mount('#app');

export { swaClient };
```

Event Tracking:

[_./usage/vue/vue-project/src/App.vue_](https://github.com/rehanvdm/serverless-website-analytics-client/blob/master/usage/vue/vue-project/src/App.vue)
```typescript
import {swaClient} from "./main";
...
//                         (event: string, data?: number, category?: string)
swaClient.v1.analyticsTrack("subscribe", 1, "clicks")
```

Alternatively, you can use a beacon/pixel for tracking as described above in standalone import script usage.

## Worst case projected costs

**SEE THE FULL COST BREAKDOWN AND SPREAD SHEET > [HERE](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/COST.md)**

> [!IMPORTANT]
> We make calculations without considering the daily vacuum cron process which reduces the S3 files stored by magnitudes.
> Real costs will be 10x to 100x lower than the worst case costs.

The worst case projected costs are:

| Views       | Cost($) |
|-------------|---------|
| 10,000      | 0.52    |
| 100,000     | 1.01    |
| 1,000,000   | 10.18   |
| 10,000,000  | 58.88   |
| 100,000,000 | 550.32  |

## What's in the box

The architecture consists of four components: frontend, backend, ingestion API and the client JS library.

![serverless-website-analytics.drawio-2023-09-10.png](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs%2Fimgs%2Fserverless-website-analytics.drawio-2023-09-10.png)

See the [highlights](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/CONTRIBUTING.md#highlights)
and [design decisions](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/CONTRIBUTING.md#design-decisions)
sections in the [CONTRIBUTING](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/CONTRIBUTING.md#design-decisions)
file for detailed info.

### Frontend

AWS CloudFront is used to host the frontend. The frontend is a Vue 3 SPA app that is hosted on S3 and served through
CloudFront. The [Element UI Plus](https://element-plus.org/en-US/) frontend framework is used for the UI components
and [Plotly.js](https://plotly.com/javascript/) for the charts.

![2_frontend_1.png](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/imgs/2_frontend_1.png)
![2_frontend_2.png](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/imgs/2_frontend_2.png)

![2_frontend_3.png](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/imgs/2_frontend_3.png)

### Backend

This is a Lambda-lith hit through the Lambda Function URLs (FURL) by reverse proxying through CloudFront. It is written
in TypeScript and uses [tRPC](https://trpc.io/) to handle API requests.

The Queries to Athena are synchronous, the connection timeout between CloudFront and the FURL has been increased
to 60 seconds. Partitions are dynamic, they do not need to be added manually.

There are three available authentication configurations:
- **None**, it is open to the public
- **Basic Authentication**, basic protection for the index.html file
- **AWS Cogntio**, recommended for production

### Ingestion API

Similarly to the backend, it is also a TS Lambda-lith that is hit through the FURL by reverse proxying through CloudFront.
It also uses [tRPC](https://trpc.io/) but uses the  [trpc-openapi](https://github.com/jlalmes/trpc-openapi) package to
generate an [OpenAPI spec](https://github.com/rehanvdm/serverless-website-analytics-client/blob/master/package/src/OpenAPI-Ingest.yaml).
This is used to generate the API types used in the [client JS package](https://www.npmjs.com/package/serverless-website-analytics-client).
and can also be used to generate other language client libraries.

The lambda function then saves the data to S3 through a Kinesis Firehose. The Firehose is configured to save the data
in a partitioned manner, by site, year and month. The data is saved in parquet format, buffered for 1 minute, which means
the date will be stored after about 1min ± 1min.

Location data is obtained by looking the IP address up in the [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geoip2/geolite2/) database.
We don't store any Personally Identifiable Information (PII) in the logs or S3, the IP address is never stored.

### Querying data manually

You can query the data manually using Athena. The data is partitioned by site and date. There are two tables,
one for the page views (`page_views`) and another for the tracking data(`events`).

Pages view query:
```sql
WITH
cte_data AS (
  SELECT site, page_url, time_on_page, page_opened_at,
         ROW_NUMBER() OVER (PARTITION BY page_id ORDER BY time_on_page DESC) rn
  FROM page_views
  WHERE (site = 'site1' site = 'site2') AND (page_opened_at_date = '2023-10-26' OR page_opened_at_date = '2023-10-27')
),
cte_data_filtered AS (
  SELECT *
  FROM cte_data
  WHERE rn = 1 AND page_opened_at BETWEEN parse_datetime('2023-10-26 22:00:00.000','yyyy-MM-dd HH:mm:ss.SSS')
        AND parse_datetime('2023-11-03 21:59:59.999','yyyy-MM-dd HH:mm:ss.SSS')
),
cte_data_by_page_view AS (
SELECT
 site,
 page_url,
 COUNT(*) as "views",
 ROUND(AVG(time_on_page),2) as "avg_time_on_page"
FROM cte_data_filtered
GROUP BY site, page_url
)
SELECT *
FROM cte_data_by_page_view
ORDER BY views DESC, page_url ASC
```

Events query:
```sql
WITH
cte_data AS (
  SELECT site, category, event, data, tracked_at,
         ROW_NUMBER() OVER (PARTITION BY event_id) rn
  FROM events
  WHERE (site = 'site1' site = 'site2') AND (tracked_at_date = '2023-11-03' OR tracked_at_date = '2023-11-04')
),
cte_data_filtered AS (
  SELECT *
  FROM cte_data
  WHERE rn = 1 AND tracked_at BETWEEN parse_datetime('2023-11-03 22:00:00.000','yyyy-MM-dd HH:mm:ss.SSS')
        AND parse_datetime('2023-11-04 21:59:59.999','yyyy-MM-dd HH:mm:ss.SSS')
),
cte_data_by_event AS (
SELECT
 site,
 category,
 event,
 COUNT(data) as "count",
 ROUND(AVG(data),2) as "avg",
 MIN(data) as "min",
 MAX(data) as "max",
 SUM(data) as "sum"
FROM cte_data_filtered
GROUP BY site, category, event
)
SELECT *
FROM cte_data_by_event
ORDER BY count DESC, category ASC, event ASC
```

A few things to note:
- The first CTE query is used to get the latest page view/event for each page/event, but it is only in the second query
where we select the top row of that query.
- The first query specifies the partitions, the site and dates. The dates can be specified with a range query, but
it is more performant to specify the exact partitions.
- The second query along with selecting the latest row frm the first, specifies the date range exactly, taking into
consideration the time zone. Within the code we over fetch the data to be returned by 2 days, this is to ensure that
this secondary query has the data the specific time query that takes into consideration the zone.
- The third query does the aggregation and the last one the ordering.

## Upgrading

### From V0 to V1

This upgrade brings two breaking changes:
1. Daily partitions, querying is not backwards compatible. The data is still there, it is just in
a different location so the dashboard will look empty after migrating.
2. A change of Route53 record construct IDs that need manual intervention (only if you specified the `domains` property)

Install the new version:
```
npm install npm install serverless-website-analytics@~1
```

#### Data "loss" because of S3 path changes to accommodate daily partitions

Data will seem lost after upgrading to V1 because of the S3 path changes to accommodate daily partitions. The data is
still there, it is just in a different location. The backend won't know about the old location and only use the new location
so your dashboard will look empty after migrating. You can possibly run an Athena CTAS query to migrate the data to the new
location, but it would need to be crafted carefully. If this is really important for you, please create a ticket and I can
see if I can help.

#### Recreate the old Route53 records (only if you specified the `domains' property)

This is because we needed to change the CDK construct IDs of the Route53 records and Route53 can not create duplicate
record names. See issue: https://github.com/rehanvdm/serverless-website-analytics/issues/26

There will be some downtime, it should be less than 10 minutes. If downtime is not acceptable then use CDK escape
hatches to hardcode the Route53 record IDs of your existing constructs.

**IMPORTANT: Take note of the names and values of these DNS records as we need to recreate them manually after deleting them.**

Order of operation:
1. Delete DNS records with AWS CLI/Console
   1.1 Delete the A record pointing to your CloudFront as defined by the `domain.name` property.
   1.2 Optional, if using `auth.cognito` delete the Cognito login A record as well, which is defined as: `{auth.cognito.loginSubDomain}.{domain.name}`
2. CDK deploy
3. Recreate the DNS records with AWS CLI/Console that you deleted in step 1.

If you do not delete them before upgrading, you will get one of these errors in CloudFormation and it will roll back.
```
[Tried to create resource record set [name='analytics.rehanvdm.com.', type='A'] but it already exists]
[Tried to create resource record set [name='login.analytics.rehanvdm.com.', type='A'] but it already exists]
```

## Sponsors

Proudly sponsored by:
- [Cloud Glance](https://cloudglance.dev/?utm_source=github-sponsors) - A Single pane of glass for
all your AWS credentials and more.
- Interested in [sponsoring](https://rehanvdm.com/contact-me)?

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for more info on how to contribute + design decisions.

## Roadmap

Can be found in the [here](https://github.com/users/rehanvdm/projects/1/views/1)

