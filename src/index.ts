import * as cert from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { auth } from './auth';
import { backend } from './backend';
import { backendAnalytics } from './backendAnalytics';
import { frontend } from './frontend';
import { observability } from './observability';
import * as cdk from "aws-cdk-lib";
import * as _ from "lodash";

export interface SwaAuthBasicAuth {
  /**
   * The username to use for basic auth.
   */
  readonly username: string;
  /**
   * The password to use for basic auth.
   */
  readonly password: string;
}

export interface SwaAuthCognitoUser {
  /**
   * The name of the user.
   */
  readonly name: string;
  /**
   * The email of the user used as the username. They will get a temporary password via email after deployment.
   */
  readonly email: string;
}
export interface SwaAuthCognito {
  /**
   * The unique domain prefix for the Cognito Hosted UI login page. If no `domain` is specified, this will be used to
   * prefix the AWS provided domain for Cognito Hosted UI login. If `domain` is specified, then it will create the
   * Cognito Hosted UI login page at `{loginSubDomain}.${domain}`.
   */
  readonly loginSubDomain: string;
  /**
   * An array of users that are allowed to login.
   */
  readonly users: SwaAuthCognitoUser[];
}

/**
 * The auth configuration which defaults to none. If you want to enable auth, you can specify either basic auth or
 * cognito auth but not both.
 */
export interface SwaAuth {
  /**
   * Uses a CloudFront function to validate the Basic Auth credentials. The credentials are hard coded in
   * the Lambda function. This is not the recommended for production, it also only secures the HTML page, the API is still
   * accessible without auth.
   */
  readonly basicAuth?: SwaAuthBasicAuth;
  /**
   * Uses an AWS Cognito user pool. Users will get a temporary password via email after deployment. They will
   * then be prompted to change their password on first login. This is the recommended option for production as it uses
   * JWT tokens to secure the API as well.
   */
  readonly cognito?: SwaAuthCognito;
}

/**
 * The AWS environment (account and region) to deploy to.
 */
export interface AwsEnv {
  readonly account: string;
  readonly region: string;
}

/**
 * Info about the domain to use for the site. Defaults to an autogenerated `cloudfront.net` domain. You can read the
 * website URL from the stack output.
 */
export interface Domain {
  /**
   * Name of the domain to use for the site, example: `serverless-website-analytics.com`
   */
  readonly name: string;
  /**
   * The certificate to use for the domain. This certificate must be in the `us-east-1` region. It must be for the
   * domain specified in `domain.name` and {auth.cognito.loginSubDomain}.{domain.name}`
   * @deprecated Use `usEast1Certificate` instead.
   */
  readonly certificate?: cert.ICertificate;

  /**
   * The certificate to use for the domain. This certificate must be in the `us-east-1` region. It must be for the
   * domain specified in `domain.name` and {auth.cognito.loginSubDomain}.{domain.name}`
   *
   * Required when specifying Domain.
   */
  readonly usEast1Certificate?: cert.ICertificate;

  /**
   * Optional, if not specified then no DNS records will be created. You will have to create the DNS records yourself.
   *
   * The Route53 hosted zone to add DNS records for CloudFront and Cognito. Cognito will be added as a subdomain of
   * the domain, for example: `{auth.cognito.loginSubDomain}.{domain.name}`.
   */
  readonly hostedZone?: route53.IHostedZone;

  /**
   * Optional, if specified, it adds tracking to the dashboard. This is useful if you want to see the usage of
   * the serverless-website-analytics dashboard page.
   */
  readonly trackOwnDomain?: boolean;
}

export interface AlarmTypes {
  /**
   * Adds a hard and soft alarm to both Lambda functions;
   */
  readonly lambda: boolean;
  /**
   * Adds a throttle and s3 delivery failure alarms for both Firehoses.
   */
  readonly firehose: boolean;
}

export const AllAlarmTypes: AlarmTypes = {
  lambda: true,
  firehose: true,
} as const;

export interface AlarmProps {
  /**
   * The SNS topic to send alarms to.
   */
  readonly alarmTopic: sns.Topic;

  /**
   * Specify which alarms you want.
   */
  readonly alarmTypes: AlarmTypes;
}

export interface Observability {
  /**
   * Adds CloudWatch Alarms to the resources created by this construct.
   */
  readonly alarms?: AlarmProps;

  /**
   * Adds a CloudWatch dashboard with metrics for the resources created by this construct.
   */
  readonly dashboard?: boolean;

  /**
   * Sets the log level, defaults to `AUDIT`. Available options: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `AUDIT`.
   * @default AUDIT
   */
  readonly loglevel?: string;
}

export interface RateLimitProps {
  /**
   * The number of concurrent requests to allow on the Ingest API.
   */
  readonly ingestLambdaConcurrency: number;

  /**
   * The number of concurrent requests to allow on the Front/Dashboard API.
   */
  readonly frontLambdaConcurrency: number;
}

export interface AnomalyDetectionProps {
  /**
   * The number of consecutive breaches before the window enters alarm state.
   * @default 2
   */
  readonly evaluationWindow?: number;

  /**
   * The multiplier used on the predicted value to determine the breaching threshold.
   * @default 2
   */
  readonly predictedBreachingMultiplier?: number;
}

export interface AnomalyAlertProps {
  /**
   * The SNS Topic to send alarms to.
   */
  readonly topic: sns.Topic;

  /**
   * Send an alarm when the anomaly is detected.
   * @default true
   */
  readonly onAlarm?: boolean;

  /**
   * Send an alarm when the anomaly is complete.
   * @default true
   */
  readonly onOk?: boolean;

  // /**
  //  * Send insights with the alarm.
  //  */
  // readonly includeInsights: { ... }
}
export interface AnomalyProps {
  /**
   * Optional, if specified overrides the default properties
   * @default ```{
   *   evaluationWindow: 2,
   *   predictedBreachingMultiplier: 2
   * }```
   */
  readonly detection?: AnomalyDetectionProps,

  /**
   * Optional, if  specified sends anomaly alarms to the specified SNS Topic as per `alert.topic`.
   * @default ```{
   *   onAlarm: true,
   *   onOk: true
   * }```
   */
  readonly alert?: AnomalyAlertProps,

}

export interface SwaProps {
  /**
   * The AWS environment (account and region) to deploy to.
   */
  readonly awsEnv: AwsEnv;

  /**
   * The list of allowed sites. This does not have to be a domain name, it can also be string. It can be anything
   * you want to use to identify a site. The client side script that send analytics will have to specify one of these
   * names. Ex: example.com
   */
  readonly sites: string[];

  /**
   * The number in seconds for the Firehose buffer interval. The default is 15 minutes (900 seconds), minimum is 60 and
   * maximum is 900.
   */
  readonly firehoseBufferInterval?: number;

  /**
   * The origins that are allowed to make requests to the backend `api-ingest` API. This CORS check is done as an extra
   * security measure to prevent other sites from making requests to your backend. It must include the protocol and
   * full domain. Ex: If your site is `example.com` and it can be accessed using `https://example.com` and
   * `https://www.example.com` then both need to be listed. A value of `*` is specifies all origins are allowed.
   */
  readonly allowedOrigins: string[];

  /**
   * The auth configuration which defaults to none. If you want to enable auth, you can specify either basic auth or
   * cognito auth but not both.
   */
  readonly auth?: SwaAuth;

  /**
   * A string added as a tag to the Lambda function to appear in logs. Not really used for anything else.
   */
  readonly environment: string;

  /**
   * If specified, it will create the CloudFront and Cognito resources at the specified domain and optionally
   * create the DNS records in the specified Route53 hosted zone.
   * If not specified, it uses the default autogenerated CloudFront(`cloudfront.net`) and
   * Cognito(`auth.us-east-1.amazoncognito.com`) domains. You can read the website URL from the stack output.
   */
  readonly domain?: Domain;

  /**
   * If specified, adds the banner at the top of the page linking back to the open source project.
   */
  readonly isDemoPage?: boolean;

  /**
   * Adds a CloudWatch Dashboard and Alarms if specified.
   */
  readonly observability?: Observability;

  /**
   * Adds a rate limit to the Ingest API and Frontend/Dashboard API. Defaults to 200 and 100 respectively.
   */
  readonly rateLimit?: RateLimitProps;

  /**
   * Adds anomaly detection to the backend.
   */
  readonly anomaly?: AnomalyProps;
}

type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export class Swa extends Construct {
  constructor(scope: Construct, id: string, props: SwaProps) {
    super(scope, id);

    function name(resourceId: string): string {
      return id + '-' + resourceId;
    }

    /* Other pre-CloudFormation checks here */

    if (props.firehoseBufferInterval && (props.firehoseBufferInterval < 60 || props.firehoseBufferInterval > 900)) {
      cdk.Annotations.of(scope).addWarning(
        'It is highly recommended to specify `firehoseBufferInterval` between 60 and 900 seconds to reduce costs.'
      );
    }

    if (props?.domain?.trackOwnDomain) {
      props.sites.push(props.domain.name);
      props.allowedOrigins.push(`https://${props.domain.name}`);
    }

    /* Remapping `domain.certificate` to `domain.usEast1Certificate` */
    if (props.domain) {
      if (!props.domain?.usEast1Certificate && !props.domain?.certificate)
        throw new Error('`domain.usEast1Certificate` must be specified');

      if (props.domain?.certificate) {
        props = {
          ...props,
          domain: {
            ...props.domain,
            usEast1Certificate: props.domain.certificate,
            certificate: undefined,
          },
        };
      }
    }

    /* Set defaults it not defined */

    const defaultProps: DeepPartial<SwaProps> = {
      observability: {
        loglevel: 'AUDIT',
      },
      anomaly: {
        detection: {
          evaluationWindow: 2,
          predictedBreachingMultiplier: 2,
        },
        alert: {
          onAlarm: true,
          onOk: true,
        }
      }
    }

    props = _.merge(defaultProps, props);


    const authProps = auth(scope, name, props);
    const backendAnalyticsProps = backendAnalytics(scope, name, props);
    const backendProps = backend(scope, name, props, authProps, backendAnalyticsProps);
    const frontendProps = frontend(scope, name, props, authProps, backendProps);

    if (props.observability)
      observability(
        scope,
        name,
        props.awsEnv.account,
        props.awsEnv.region,
        props.observability,
        backendAnalyticsProps,
        backendProps,
        frontendProps
      );
  }
}

export default Swa;
