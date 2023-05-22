import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { FunctionEventType, OriginProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { auth } from './auth';
import { backend } from './backend';
import { SwaProps } from './index';
import * as path from "path";

//eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export function frontend(
  scope: Construct,
  name: (name: string) => string,
  props: SwaProps,
  authProps: ReturnType<typeof auth>,
  backendProps: ReturnType<typeof backend>
) {
  let bucketSecretReferer = '8fd78848-437d-435a-b37c-fe5ff1967cdd';
  const frontendBucket = new s3.Bucket(scope, name('web-bucket'), {
    bucketName: name('web-bucket'),
    autoDeleteObjects: true,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    websiteIndexDocument: 'index.html',
    websiteErrorDocument: 'index.html',
  });
  frontendBucket.policy!.document.addStatements(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.StarPrincipal()],
      actions: ['s3:GetObject'],
      resources: [frontendBucket.bucketArn + '/*'],
      conditions: {
        StringEquals: {
          'aws:Referer': bucketSecretReferer,
        },
      },
    })
  );

  const apiProxyCachePolicy = new cloudfront.CachePolicy(scope, name('api-proxy-policy'), {
    cachePolicyName: name('api-proxy-policy'),
    /* Max has to be higher than min else caching is disabled and we can not whitelist the Auth header to be
         forwarded to the origin. Max is not used unless a cache-control header is specified, which we don't so
         it won't do anything, it is basically a clamp value for when we do. The default is used when we don't
         specify a cache-control value. */
    maxTtl: cdk.Duration.seconds(60),
    //https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html#request-custom-traffic-spikes
    //Don't want request collapsing at all, set mint ttl to 0 AND Also need to set the returned cache controll header
    //from lambda to private (Cache-Control: private)
    minTtl: cdk.Duration.seconds(0),
    defaultTtl: cdk.Duration.seconds(0),
    queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    headerBehavior: cloudfront.CacheHeaderBehavior.allowList('user-agent', 'authorization'),
  });

  const frontendDist = new cloudfront.Distribution(scope, name('web-dist'), {
    comment: name('web-dist'),
    defaultBehavior: {
      origin: new origins.HttpOrigin(frontendBucket.bucketWebsiteDomainName, {
        protocolPolicy: OriginProtocolPolicy.HTTP_ONLY, //can not specify scope in the AWS console anymore :shrug:
        customHeaders: {
          Referer: bucketSecretReferer,
        },
      }),
      compress: true,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      functionAssociations:
        props.auth?.basicAuth && authProps.cloudFrontBasicAuthFunction
          ? [
              {
                function: authProps.cloudFrontBasicAuthFunction,
                eventType: FunctionEventType.VIEWER_REQUEST,
              },
            ]
          : undefined,
    },
    additionalBehaviors: {
      '/api-ingest/*': {
        origin: new origins.HttpOrigin(backendProps.apiIngestOrigin, {}),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        compress: false,
        cachePolicy: apiProxyCachePolicy,
      },
      '/api/*': {
        origin: new origins.HttpOrigin(backendProps.apiFrontOrigin, {
          readTimeout: cdk.Duration.seconds(60),
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        compress: false,
        cachePolicy: apiProxyCachePolicy,
      },
    },
    //TODO:
    // domainNames: [buildProps.Params.DomainName],
    // certificate: cert.Certificate.fromCertificateArn( scope, name("web-dist-cert"), buildProps.Params.WildCardCert),
    defaultRootObject: 'index.html',
  });


  new s3deploy.BucketDeployment(scope, name('deploy-with-invalidation'), {
    sources: [s3deploy.Source.asset(path.join(__dirname, '../lib/build/frontend'))],
    destinationBucket: frontendBucket,
    distribution: frontendDist,
    distributionPaths: ['/*'],
  });

  /* Update the Cognito Client callback id with the CloudFront domain. This has to be done if we are using an
       auto generated domain returned from CloudFront after it has been created. It is unknown before that. */
  if (props.auth?.cognito) {
    const codeGrants = [];
    if (authProps.userPoolClientOptions!.oAuth!.flows!.implicitCodeGrant) codeGrants.push('implicit');

    /* This does a PUT not an update, need to keep in sync with the CognitoClient creation */
    const updateCognitoCallback = new AwsCustomResource(scope, name('cr-update-cognito-callbacks'), {
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'updateUserPoolClient',
        parameters: {
          UserPoolId: authProps.userPool!.userPoolId,
          ClientId: authProps.userPoolClient!.userPoolClientId,
          AccessTokenValidity: authProps.userPoolClientOptions!.accessTokenValidity!.toDays(),
          IdTokenValidity: authProps.userPoolClientOptions!.idTokenValidity!.toDays(),
          TokenValidityUnits: {
            AccessToken: 'days',
            IdToken: 'days',
          },
          AllowedOAuthFlowsUserPoolClient: true,
          AllowedOAuthFlows: codeGrants,
          AllowedOAuthScopes: authProps.userPoolClientOptions!.oAuth!.scopes!.map((authScope) => authScope.scopeName),
          SupportedIdentityProviders: authProps.userPoolClientOptions!.supportedIdentityProviders!.map(
            (idp) => idp.name
          ),
          CallbackURLs: [
            `http://localhost:5173/login_callback`,
            `https://${frontendDist.distributionDomainName}/login_callback`,
          ],
        },
        physicalResourceId: PhysicalResourceId.of(frontendDist.distributionDomainName),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [authProps.userPool!.userPoolArn] }),
    });

    updateCognitoCallback.node.addDependency(frontendDist);
    updateCognitoCallback.node.addDependency(authProps.userPool!);
    updateCognitoCallback.node.addDependency(authProps.userPoolClient!);
  }

  new cdk.CfnOutput(scope, name('CFD_ID'), { description: 'CFD_ID', value: frontendDist.distributionId });
  new cdk.CfnOutput(scope, name('FRONTEND_URL'), {
    description: 'FRONTEND_URL',
    value: frontendDist.distributionDomainName,
  });

  return {
    frontendDist,
  };
}
