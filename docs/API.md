# Serverless Website Analytics

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
<script src="<YOUR BACKEND ORIGIN>/cdn/client-script.js" site="<THE SITE YOU ARE TRACKING>"></script>
</body>
</html>
```

See the [client-side library](https://www.npmjs.com/package/serverless-website-analytics-client) for more options.

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

The following sections show you how to do it in Vue, see [the readme of the client](https://github.com/rehanvdm/serverless-website-analytics-client-development#usage)
for React and Svelte usage, but again the SDK allows for usage in **ANY framework**.

#### Vue

[_./serverless-website-analytics-client/usage/vue/vue-project/src/main.ts_](https://github.com/rehanvdm/serverless-website-analytics-client-development/blob/master/usage/vue/vue-project/src/main.ts)
```typescript
...
import * as swaClient from 'serverless-website-analytics-client';

const app = createApp(App);
app.use(router);

swaClient.v1.analyticsPageInit({
  inBrowser: true, //Not SSR
  site: "<Friendly site name>", //example.com
  apiUrl: "<Your serverless-website-analytics URL>", //https://my-serverless-website-analytics-backend.com
  // debug: true,
});
router.afterEach((event) => {
  swaClient.v1.analyticsPageChange(event.path);
});

app.mount('#app');
```

..Any other framework

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

![frontend_1.png](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/imgs/frontend_1.png)
![frontend_2.png](https://github.com/rehanvdm/serverless-website-analytics/blob/main/docs/imgs/frontend_2.png)

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
generate an OpenAPI spec. This is used to generate the API types used in the [client JS package](https://www.npmjs.com/package/serverless-website-analytics-client).
and can also be used to generate other language client libraries.

The lambda function then saves the data to S3 through a Kinesis Firehose. The Firehose is configured to save the data
in a partitioned manner, by site, year and month. The data is saved in parquet format, buffered for 1 minute, which means
the date will be stored after about 1min ± 1min.

Location data is obtained by looking the IP address up in the [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geoip2/geolite2/) database.
We don't store any Personally Identifiable Information (PII) in the logs or S3, the IP address is never stored.

# Upgrading

## From V0 to V1

This upgrade brings two breaking changes:
1. Daily partitions, querying is not backwards compatible. The data is still there, it is just in
a different location so the dashboard will look empty after migrating.
2. A change of Route53 record construct IDs that need manual intervention (only if you specified the `domains` property)

Install the new version:
```
npm install npm install serverless-website-analytics@~1
```

### Data "loss" because of S3 path changes to accommodate daily partitions

Data will seem lost after upgrading to V1 because of the S3 path changes to accommodate daily partitions. The data is
still there, it is just in a different location. The backend won't know about the old location and only use the new location
so your dashboard will look empty after migrating. You can possibly run an Athena CTAS query to migrate the data to the new
location, but it would need to be crafted carefully. If this is really important for you, please create a ticket and I can
see if I can help.

### Recreate the old Route53 records (only if you specified the `domains' property)

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


# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### Swa <a name="Swa" id="serverless-website-analytics.Swa"></a>

#### Initializers <a name="Initializers" id="serverless-website-analytics.Swa.Initializer"></a>

```typescript
import { Swa } from 'serverless-website-analytics'

new Swa(scope: Construct, id: string, props: SwaProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.Swa.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#serverless-website-analytics.Swa.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#serverless-website-analytics.Swa.Initializer.parameter.props">props</a></code> | <code><a href="#serverless-website-analytics.SwaProps">SwaProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="serverless-website-analytics.Swa.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="serverless-website-analytics.Swa.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="serverless-website-analytics.Swa.Initializer.parameter.props"></a>

- *Type:* <a href="#serverless-website-analytics.SwaProps">SwaProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#serverless-website-analytics.Swa.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="serverless-website-analytics.Swa.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#serverless-website-analytics.Swa.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="serverless-website-analytics.Swa.isConstruct"></a>

```typescript
import { Swa } from 'serverless-website-analytics'

Swa.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="serverless-website-analytics.Swa.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.Swa.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |

---

##### `node`<sup>Required</sup> <a name="node" id="serverless-website-analytics.Swa.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---


## Structs <a name="Structs" id="Structs"></a>

### AlarmProps <a name="AlarmProps" id="serverless-website-analytics.AlarmProps"></a>

#### Initializer <a name="Initializer" id="serverless-website-analytics.AlarmProps.Initializer"></a>

```typescript
import { AlarmProps } from 'serverless-website-analytics'

const alarmProps: AlarmProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.AlarmProps.property.alarmTopic">alarmTopic</a></code> | <code>aws-cdk-lib.aws_sns.Topic</code> | The SNS topic to send alarms to. |
| <code><a href="#serverless-website-analytics.AlarmProps.property.alarmTypes">alarmTypes</a></code> | <code><a href="#serverless-website-analytics.AlarmTypes">AlarmTypes</a></code> | Specify which alarms you want. |

---

##### `alarmTopic`<sup>Required</sup> <a name="alarmTopic" id="serverless-website-analytics.AlarmProps.property.alarmTopic"></a>

```typescript
public readonly alarmTopic: Topic;
```

- *Type:* aws-cdk-lib.aws_sns.Topic

The SNS topic to send alarms to.

---

##### `alarmTypes`<sup>Required</sup> <a name="alarmTypes" id="serverless-website-analytics.AlarmProps.property.alarmTypes"></a>

```typescript
public readonly alarmTypes: AlarmTypes;
```

- *Type:* <a href="#serverless-website-analytics.AlarmTypes">AlarmTypes</a>

Specify which alarms you want.

---

### AlarmTypes <a name="AlarmTypes" id="serverless-website-analytics.AlarmTypes"></a>

#### Initializer <a name="Initializer" id="serverless-website-analytics.AlarmTypes.Initializer"></a>

```typescript
import { AlarmTypes } from 'serverless-website-analytics'

const alarmTypes: AlarmTypes = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.AlarmTypes.property.firehose">firehose</a></code> | <code>boolean</code> | Adds a throttle and s3 delivery failure alarms for both Firehoses. |
| <code><a href="#serverless-website-analytics.AlarmTypes.property.lambda">lambda</a></code> | <code>boolean</code> | Adds a hard and soft alarm to both Lambda functions; |

---

##### `firehose`<sup>Required</sup> <a name="firehose" id="serverless-website-analytics.AlarmTypes.property.firehose"></a>

```typescript
public readonly firehose: boolean;
```

- *Type:* boolean

Adds a throttle and s3 delivery failure alarms for both Firehoses.

---

##### `lambda`<sup>Required</sup> <a name="lambda" id="serverless-website-analytics.AlarmTypes.property.lambda"></a>

```typescript
public readonly lambda: boolean;
```

- *Type:* boolean

Adds a hard and soft alarm to both Lambda functions;

---

### AwsEnv <a name="AwsEnv" id="serverless-website-analytics.AwsEnv"></a>

The AWS environment (account and region) to deploy to.

#### Initializer <a name="Initializer" id="serverless-website-analytics.AwsEnv.Initializer"></a>

```typescript
import { AwsEnv } from 'serverless-website-analytics'

const awsEnv: AwsEnv = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.AwsEnv.property.account">account</a></code> | <code>string</code> | *No description.* |
| <code><a href="#serverless-website-analytics.AwsEnv.property.region">region</a></code> | <code>string</code> | *No description.* |

---

##### `account`<sup>Required</sup> <a name="account" id="serverless-website-analytics.AwsEnv.property.account"></a>

```typescript
public readonly account: string;
```

- *Type:* string

---

##### `region`<sup>Required</sup> <a name="region" id="serverless-website-analytics.AwsEnv.property.region"></a>

```typescript
public readonly region: string;
```

- *Type:* string

---

### Domain <a name="Domain" id="serverless-website-analytics.Domain"></a>

Info about the domain to use for the site.

Defaults to an autogenerated `cloudfront.net` domain. You can read the
website URL from the stack output.

#### Initializer <a name="Initializer" id="serverless-website-analytics.Domain.Initializer"></a>

```typescript
import { Domain } from 'serverless-website-analytics'

const domain: Domain = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.Domain.property.name">name</a></code> | <code>string</code> | Name of the domain to use for the site, example: `serverless-website-analytics.com`. |
| <code><a href="#serverless-website-analytics.Domain.property.certificate">certificate</a></code> | <code>aws-cdk-lib.aws_certificatemanager.ICertificate</code> | The certificate to use for the domain. |
| <code><a href="#serverless-website-analytics.Domain.property.hostedZone">hostedZone</a></code> | <code>aws-cdk-lib.aws_route53.IHostedZone</code> | Optional, if not specified then no DNS records will be created. |
| <code><a href="#serverless-website-analytics.Domain.property.trackOwnDomain">trackOwnDomain</a></code> | <code>boolean</code> | Optional, if specified, it adds tracking to the dashboard. |
| <code><a href="#serverless-website-analytics.Domain.property.usEast1Certificate">usEast1Certificate</a></code> | <code>aws-cdk-lib.aws_certificatemanager.ICertificate</code> | The certificate to use for the domain. |

---

##### `name`<sup>Required</sup> <a name="name" id="serverless-website-analytics.Domain.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

Name of the domain to use for the site, example: `serverless-website-analytics.com`.

---

##### ~~`certificate`~~<sup>Optional</sup> <a name="certificate" id="serverless-website-analytics.Domain.property.certificate"></a>

- *Deprecated:* Use `usEast1Certificate` instead.

```typescript
public readonly certificate: ICertificate;
```

- *Type:* aws-cdk-lib.aws_certificatemanager.ICertificate

The certificate to use for the domain.

This certificate must be in the `us-east-1` region. It must be for the
domain specified in `domain.name` and {auth.cognito.loginSubDomain}.{domain.name}`

---

##### `hostedZone`<sup>Optional</sup> <a name="hostedZone" id="serverless-website-analytics.Domain.property.hostedZone"></a>

```typescript
public readonly hostedZone: IHostedZone;
```

- *Type:* aws-cdk-lib.aws_route53.IHostedZone

Optional, if not specified then no DNS records will be created.

You will have to create the DNS records yourself.

The Route53 hosted zone to add DNS records for CloudFront and Cognito. Cognito will be added as a subdomain of
the domain, for example: `{auth.cognito.loginSubDomain}.{domain.name}`.

---

##### `trackOwnDomain`<sup>Optional</sup> <a name="trackOwnDomain" id="serverless-website-analytics.Domain.property.trackOwnDomain"></a>

```typescript
public readonly trackOwnDomain: boolean;
```

- *Type:* boolean

Optional, if specified, it adds tracking to the dashboard.

This is useful if you want to see the usage of
the serverless-website-analytics dashboard page.

---

##### `usEast1Certificate`<sup>Optional</sup> <a name="usEast1Certificate" id="serverless-website-analytics.Domain.property.usEast1Certificate"></a>

```typescript
public readonly usEast1Certificate: ICertificate;
```

- *Type:* aws-cdk-lib.aws_certificatemanager.ICertificate

The certificate to use for the domain.

This certificate must be in the `us-east-1` region. It must be for the
domain specified in `domain.name` and {auth.cognito.loginSubDomain}.{domain.name}`

Required when specifying Domain.

---

### Observability <a name="Observability" id="serverless-website-analytics.Observability"></a>

#### Initializer <a name="Initializer" id="serverless-website-analytics.Observability.Initializer"></a>

```typescript
import { Observability } from 'serverless-website-analytics'

const observability: Observability = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.Observability.property.alarms">alarms</a></code> | <code><a href="#serverless-website-analytics.AlarmProps">AlarmProps</a></code> | Adds CloudWatch Alarms to the resources created by this construct. |
| <code><a href="#serverless-website-analytics.Observability.property.dashboard">dashboard</a></code> | <code>boolean</code> | Adds a CloudWatch dashboard with metrics for the resources created by this construct. |
| <code><a href="#serverless-website-analytics.Observability.property.loglevel">loglevel</a></code> | <code>string</code> | Sets the log level, defaults to `AUDIT`. |

---

##### `alarms`<sup>Optional</sup> <a name="alarms" id="serverless-website-analytics.Observability.property.alarms"></a>

```typescript
public readonly alarms: AlarmProps;
```

- *Type:* <a href="#serverless-website-analytics.AlarmProps">AlarmProps</a>

Adds CloudWatch Alarms to the resources created by this construct.

---

##### `dashboard`<sup>Optional</sup> <a name="dashboard" id="serverless-website-analytics.Observability.property.dashboard"></a>

```typescript
public readonly dashboard: boolean;
```

- *Type:* boolean

Adds a CloudWatch dashboard with metrics for the resources created by this construct.

---

##### `loglevel`<sup>Optional</sup> <a name="loglevel" id="serverless-website-analytics.Observability.property.loglevel"></a>

```typescript
public readonly loglevel: string;
```

- *Type:* string

Sets the log level, defaults to `AUDIT`.

Available options: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `AUDIT`.

---

### RateLimitProps <a name="RateLimitProps" id="serverless-website-analytics.RateLimitProps"></a>

#### Initializer <a name="Initializer" id="serverless-website-analytics.RateLimitProps.Initializer"></a>

```typescript
import { RateLimitProps } from 'serverless-website-analytics'

const rateLimitProps: RateLimitProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.RateLimitProps.property.frontLambdaConcurrency">frontLambdaConcurrency</a></code> | <code>number</code> | The number of concurrent requests to allow on the Front/Dashboard API. |
| <code><a href="#serverless-website-analytics.RateLimitProps.property.ingestLambdaConcurrency">ingestLambdaConcurrency</a></code> | <code>number</code> | The number of concurrent requests to allow on the Ingest API. |

---

##### `frontLambdaConcurrency`<sup>Required</sup> <a name="frontLambdaConcurrency" id="serverless-website-analytics.RateLimitProps.property.frontLambdaConcurrency"></a>

```typescript
public readonly frontLambdaConcurrency: number;
```

- *Type:* number

The number of concurrent requests to allow on the Front/Dashboard API.

---

##### `ingestLambdaConcurrency`<sup>Required</sup> <a name="ingestLambdaConcurrency" id="serverless-website-analytics.RateLimitProps.property.ingestLambdaConcurrency"></a>

```typescript
public readonly ingestLambdaConcurrency: number;
```

- *Type:* number

The number of concurrent requests to allow on the Ingest API.

---

### SwaAuth <a name="SwaAuth" id="serverless-website-analytics.SwaAuth"></a>

The auth configuration which defaults to none.

If you want to enable auth, you can specify either basic auth or
cognito auth but not both.

#### Initializer <a name="Initializer" id="serverless-website-analytics.SwaAuth.Initializer"></a>

```typescript
import { SwaAuth } from 'serverless-website-analytics'

const swaAuth: SwaAuth = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.SwaAuth.property.basicAuth">basicAuth</a></code> | <code><a href="#serverless-website-analytics.SwaAuthBasicAuth">SwaAuthBasicAuth</a></code> | Uses a CloudFront function to validate the Basic Auth credentials. |
| <code><a href="#serverless-website-analytics.SwaAuth.property.cognito">cognito</a></code> | <code><a href="#serverless-website-analytics.SwaAuthCognito">SwaAuthCognito</a></code> | Uses an AWS Cognito user pool. |

---

##### `basicAuth`<sup>Optional</sup> <a name="basicAuth" id="serverless-website-analytics.SwaAuth.property.basicAuth"></a>

```typescript
public readonly basicAuth: SwaAuthBasicAuth;
```

- *Type:* <a href="#serverless-website-analytics.SwaAuthBasicAuth">SwaAuthBasicAuth</a>

Uses a CloudFront function to validate the Basic Auth credentials.

The credentials are hard coded in
the Lambda function. This is not the recommended for production, it also only secures the HTML page, the API is still
accessible without auth.

---

##### `cognito`<sup>Optional</sup> <a name="cognito" id="serverless-website-analytics.SwaAuth.property.cognito"></a>

```typescript
public readonly cognito: SwaAuthCognito;
```

- *Type:* <a href="#serverless-website-analytics.SwaAuthCognito">SwaAuthCognito</a>

Uses an AWS Cognito user pool.

Users will get a temporary password via email after deployment. They will
then be prompted to change their password on first login. This is the recommended option for production as it uses
JWT tokens to secure the API as well.

---

### SwaAuthBasicAuth <a name="SwaAuthBasicAuth" id="serverless-website-analytics.SwaAuthBasicAuth"></a>

#### Initializer <a name="Initializer" id="serverless-website-analytics.SwaAuthBasicAuth.Initializer"></a>

```typescript
import { SwaAuthBasicAuth } from 'serverless-website-analytics'

const swaAuthBasicAuth: SwaAuthBasicAuth = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.SwaAuthBasicAuth.property.password">password</a></code> | <code>string</code> | The password to use for basic auth. |
| <code><a href="#serverless-website-analytics.SwaAuthBasicAuth.property.username">username</a></code> | <code>string</code> | The username to use for basic auth. |

---

##### `password`<sup>Required</sup> <a name="password" id="serverless-website-analytics.SwaAuthBasicAuth.property.password"></a>

```typescript
public readonly password: string;
```

- *Type:* string

The password to use for basic auth.

---

##### `username`<sup>Required</sup> <a name="username" id="serverless-website-analytics.SwaAuthBasicAuth.property.username"></a>

```typescript
public readonly username: string;
```

- *Type:* string

The username to use for basic auth.

---

### SwaAuthCognito <a name="SwaAuthCognito" id="serverless-website-analytics.SwaAuthCognito"></a>

#### Initializer <a name="Initializer" id="serverless-website-analytics.SwaAuthCognito.Initializer"></a>

```typescript
import { SwaAuthCognito } from 'serverless-website-analytics'

const swaAuthCognito: SwaAuthCognito = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.SwaAuthCognito.property.loginSubDomain">loginSubDomain</a></code> | <code>string</code> | The unique domain prefix for the Cognito Hosted UI login page. |
| <code><a href="#serverless-website-analytics.SwaAuthCognito.property.users">users</a></code> | <code><a href="#serverless-website-analytics.SwaAuthCognitoUser">SwaAuthCognitoUser</a>[]</code> | An array of users that are allowed to login. |

---

##### `loginSubDomain`<sup>Required</sup> <a name="loginSubDomain" id="serverless-website-analytics.SwaAuthCognito.property.loginSubDomain"></a>

```typescript
public readonly loginSubDomain: string;
```

- *Type:* string

The unique domain prefix for the Cognito Hosted UI login page.

If no `domain` is specified, this will be used to
prefix the AWS provided domain for Cognito Hosted UI login. If `domain` is specified, then it will create the
Cognito Hosted UI login page at `{loginSubDomain}.${domain}`.

---

##### `users`<sup>Required</sup> <a name="users" id="serverless-website-analytics.SwaAuthCognito.property.users"></a>

```typescript
public readonly users: SwaAuthCognitoUser[];
```

- *Type:* <a href="#serverless-website-analytics.SwaAuthCognitoUser">SwaAuthCognitoUser</a>[]

An array of users that are allowed to login.

---

### SwaAuthCognitoUser <a name="SwaAuthCognitoUser" id="serverless-website-analytics.SwaAuthCognitoUser"></a>

#### Initializer <a name="Initializer" id="serverless-website-analytics.SwaAuthCognitoUser.Initializer"></a>

```typescript
import { SwaAuthCognitoUser } from 'serverless-website-analytics'

const swaAuthCognitoUser: SwaAuthCognitoUser = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.SwaAuthCognitoUser.property.email">email</a></code> | <code>string</code> | The email of the user used as the username. |
| <code><a href="#serverless-website-analytics.SwaAuthCognitoUser.property.name">name</a></code> | <code>string</code> | The name of the user. |

---

##### `email`<sup>Required</sup> <a name="email" id="serverless-website-analytics.SwaAuthCognitoUser.property.email"></a>

```typescript
public readonly email: string;
```

- *Type:* string

The email of the user used as the username.

They will get a temporary password via email after deployment.

---

##### `name`<sup>Required</sup> <a name="name" id="serverless-website-analytics.SwaAuthCognitoUser.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

The name of the user.

---

### SwaProps <a name="SwaProps" id="serverless-website-analytics.SwaProps"></a>

#### Initializer <a name="Initializer" id="serverless-website-analytics.SwaProps.Initializer"></a>

```typescript
import { SwaProps } from 'serverless-website-analytics'

const swaProps: SwaProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#serverless-website-analytics.SwaProps.property.allowedOrigins">allowedOrigins</a></code> | <code>string[]</code> | The origins that are allowed to make requests to the backend `api-ingest` API. |
| <code><a href="#serverless-website-analytics.SwaProps.property.awsEnv">awsEnv</a></code> | <code><a href="#serverless-website-analytics.AwsEnv">AwsEnv</a></code> | The AWS environment (account and region) to deploy to. |
| <code><a href="#serverless-website-analytics.SwaProps.property.environment">environment</a></code> | <code>string</code> | A string added as a tag to the Lambda function to appear in logs. |
| <code><a href="#serverless-website-analytics.SwaProps.property.sites">sites</a></code> | <code>string[]</code> | The list of allowed sites. |
| <code><a href="#serverless-website-analytics.SwaProps.property.auth">auth</a></code> | <code><a href="#serverless-website-analytics.SwaAuth">SwaAuth</a></code> | The auth configuration which defaults to none. |
| <code><a href="#serverless-website-analytics.SwaProps.property.domain">domain</a></code> | <code><a href="#serverless-website-analytics.Domain">Domain</a></code> | If specified, it will create the CloudFront and Cognito resources at the specified domain and optionally create the DNS records in the specified Route53 hosted zone. |
| <code><a href="#serverless-website-analytics.SwaProps.property.firehoseBufferInterval">firehoseBufferInterval</a></code> | <code>number</code> | The number in seconds for the Firehose buffer interval. |
| <code><a href="#serverless-website-analytics.SwaProps.property.isDemoPage">isDemoPage</a></code> | <code>boolean</code> | If specified, adds the banner at the top of the page linking back to the open source project. |
| <code><a href="#serverless-website-analytics.SwaProps.property.observability">observability</a></code> | <code><a href="#serverless-website-analytics.Observability">Observability</a></code> | Adds a CloudWatch Dashboard and Alarms if specified. |
| <code><a href="#serverless-website-analytics.SwaProps.property.rateLimit">rateLimit</a></code> | <code><a href="#serverless-website-analytics.RateLimitProps">RateLimitProps</a></code> | Adds a rate limit to the Ingest API and Frontend/Dashboard API. |

---

##### `allowedOrigins`<sup>Required</sup> <a name="allowedOrigins" id="serverless-website-analytics.SwaProps.property.allowedOrigins"></a>

```typescript
public readonly allowedOrigins: string[];
```

- *Type:* string[]

The origins that are allowed to make requests to the backend `api-ingest` API.

This CORS check is done as an extra
security measure to prevent other sites from making requests to your backend. It must include the protocol and
full domain. Ex: If your site is `example.com` and it can be accessed using `https://example.com` and
`https://www.example.com` then both need to be listed. A value of `*` is specifies all origins are allowed.

---

##### `awsEnv`<sup>Required</sup> <a name="awsEnv" id="serverless-website-analytics.SwaProps.property.awsEnv"></a>

```typescript
public readonly awsEnv: AwsEnv;
```

- *Type:* <a href="#serverless-website-analytics.AwsEnv">AwsEnv</a>

The AWS environment (account and region) to deploy to.

---

##### `environment`<sup>Required</sup> <a name="environment" id="serverless-website-analytics.SwaProps.property.environment"></a>

```typescript
public readonly environment: string;
```

- *Type:* string

A string added as a tag to the Lambda function to appear in logs.

Not really used for anything else.

---

##### `sites`<sup>Required</sup> <a name="sites" id="serverless-website-analytics.SwaProps.property.sites"></a>

```typescript
public readonly sites: string[];
```

- *Type:* string[]

The list of allowed sites.

This does not have to be a domain name, it can also be string. It can be anything
you want to use to identify a site. The client side script that send analytics will have to specify one of these
names. Ex: example.com

---

##### `auth`<sup>Optional</sup> <a name="auth" id="serverless-website-analytics.SwaProps.property.auth"></a>

```typescript
public readonly auth: SwaAuth;
```

- *Type:* <a href="#serverless-website-analytics.SwaAuth">SwaAuth</a>

The auth configuration which defaults to none.

If you want to enable auth, you can specify either basic auth or
cognito auth but not both.

---

##### `domain`<sup>Optional</sup> <a name="domain" id="serverless-website-analytics.SwaProps.property.domain"></a>

```typescript
public readonly domain: Domain;
```

- *Type:* <a href="#serverless-website-analytics.Domain">Domain</a>

If specified, it will create the CloudFront and Cognito resources at the specified domain and optionally create the DNS records in the specified Route53 hosted zone.

If not specified, it uses the default autogenerated CloudFront(`cloudfront.net`) and
Cognito(`auth.us-east-1.amazoncognito.com`) domains. You can read the website URL from the stack output.

---

##### `firehoseBufferInterval`<sup>Optional</sup> <a name="firehoseBufferInterval" id="serverless-website-analytics.SwaProps.property.firehoseBufferInterval"></a>

```typescript
public readonly firehoseBufferInterval: number;
```

- *Type:* number

The number in seconds for the Firehose buffer interval.

The default is 15 minutes (900 seconds), minimum is 60 and
maximum is 900.

---

##### `isDemoPage`<sup>Optional</sup> <a name="isDemoPage" id="serverless-website-analytics.SwaProps.property.isDemoPage"></a>

```typescript
public readonly isDemoPage: boolean;
```

- *Type:* boolean

If specified, adds the banner at the top of the page linking back to the open source project.

---

##### `observability`<sup>Optional</sup> <a name="observability" id="serverless-website-analytics.SwaProps.property.observability"></a>

```typescript
public readonly observability: Observability;
```

- *Type:* <a href="#serverless-website-analytics.Observability">Observability</a>

Adds a CloudWatch Dashboard and Alarms if specified.

---

##### `rateLimit`<sup>Optional</sup> <a name="rateLimit" id="serverless-website-analytics.SwaProps.property.rateLimit"></a>

```typescript
public readonly rateLimit: RateLimitProps;
```

- *Type:* <a href="#serverless-website-analytics.RateLimitProps">RateLimitProps</a>

Adds a rate limit to the Ingest API and Frontend/Dashboard API.

Defaults to 200 and 100 respectively.

---



