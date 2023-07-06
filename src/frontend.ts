import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { FunctionEventType, OriginProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { DistributionProps } from 'aws-cdk-lib/aws-cloudfront/lib/distribution';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
  AwsSdkCall,
} from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { auth } from './auth';
import { backend } from './backend';
import { SwaProps } from './index';
import { CwCloudFront } from './lib/cloudwatch-helper';

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
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
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

  const domainProps: Partial<DistributionProps> = !props.domain
    ? {}
    : {
        domainNames: [props.domain.name],
        certificate: props.domain.certificate,
      };

  const defaultBucketOrigin = new origins.HttpOrigin(frontendBucket.bucketWebsiteDomainName, {
    protocolPolicy: OriginProtocolPolicy.HTTP_ONLY, //can not specify scope in the AWS console anymore :shrug:
    customHeaders: {
      Referer: bucketSecretReferer,
    },
  });

  const frontendDist = new cloudfront.Distribution(scope, name('web-dist'), {
    comment: name('web-dist'),
    defaultBehavior: {
      origin: defaultBucketOrigin,
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
      '/cdn/*': {
        origin: defaultBucketOrigin,
        compress: true,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
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
    defaultRootObject: 'index.html',
    ...domainProps,
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

    const awsSdkCall: AwsSdkCall = {
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
        SupportedIdentityProviders: authProps.userPoolClientOptions!.supportedIdentityProviders!.map((idp) => idp.name),
        CallbackURLs: [
          `http://localhost:5173/login_callback`,
          `https://${props.domain?.name || frontendDist.distributionDomainName}/login_callback`,
        ],
      },
      physicalResourceId: PhysicalResourceId.of(frontendDist.distributionDomainName),
    };
    /* This does a PUT not an update, need to keep in sync with the CognitoClient creation */
    const updateCognitoCallback = new AwsCustomResource(scope, name('cr-update-cognito-callbacks'), {
      onCreate: awsSdkCall,
      onUpdate: awsSdkCall,
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [authProps.userPool!.userPoolArn] }),
    });

    updateCognitoCallback.node.addDependency(frontendDist);
    updateCognitoCallback.node.addDependency(authProps.userPool!);
    updateCognitoCallback.node.addDependency(authProps.userPoolClient!);
  }

  /* Add DNS records */
  if (props.domain) {
    const manualRecords: {
      description: string;
      name: string;
      type: string;
      value: string;
    }[] = [];

    /* First CloudFront A record if we can */
    let cloudFrontRecord: route53.ARecord | undefined = undefined;
    if (props.domain.hostedZone) {
      cloudFrontRecord = new route53.ARecord(scope, 'cloudfront-record', {
        recordName: props.domain.name,
        target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(frontendDist)),
        zone: props.domain.hostedZone,
      });
    } else {
      manualRecords.push({
        description: 'CloudFront',
        name: props.domain.name,
        type: 'CNAME',
        value: frontendDist.distributionDomainName,
      });
    }

    /* Add the custom domain to the Cognito User Pool only AFTER the CloudFront creates the A record, otherwise the
     * Cognito domain will fail, this is to say we can create DNS records ourselves */
    if (props.auth?.cognito) {
      const cognitoDomain = authProps.userPool!.addDomain('custom-domain', {
        customDomain: {
          domainName: `${props.auth.cognito.loginSubDomain}.${props.domain.name}`,
          certificate: props.domain.certificate,
        },
      });
      new cdk.CfnOutput(scope, name('CognitoHostedUrl'), {
        description: 'Cognito Hosted URL',
        value: cognitoDomain.baseUrl(),
      });
      if (cloudFrontRecord) cognitoDomain.node.addDependency(cloudFrontRecord);

      /* Add the Cognito A record if we can */
      if (props.domain.hostedZone) {
        new route53.ARecord(scope, 'custom-domain-dns-record', {
          recordName: props.auth.cognito.loginSubDomain,
          target: route53.RecordTarget.fromAlias({
            bind: () => ({
              dnsName: cognitoDomain.cloudFrontDomainName,
              hostedZoneId: 'Z2FDTNDATAQYW2', // CloudFront Zone ID, fixed for everyone
            }),
          }),
          zone: props.domain.hostedZone,
        });
      } else {
        manualRecords.push({
          description: 'Cognito',
          name: cognitoDomain.domainName,
          type: 'CNAME',
          value: cognitoDomain.cloudFrontDomainName,
        });
      }
    }

    if (manualRecords.length) {
      cdk.Annotations.of(scope).addInfo('DNS records need to be created manually, see all CloudFormation Outputs');
      for (const record of manualRecords) {
        new cdk.CfnOutput(scope, name(`Dns_${record.description}`), {
          description: `DNS ${record.description}`,
          value: `Manually Create DNS Record: ${record.name} ${record.type} ${record.value}`,
        });
      }
    }
  }

  new cdk.CfnOutput(scope, name('CloudFrontId'), { description: 'CloudFront Id', value: frontendDist.distributionId });
  new cdk.CfnOutput(scope, name('FrontendUrl'), {
    description: 'Frontend Url',
    value: cdk.Fn.join('', ['https://', props.domain?.name || frontendDist.distributionDomainName]),
  });
  new cdk.CfnOutput(scope, name('ApiIngestUrl'), {
    description: 'Api Ingest Url',
    value: cdk.Fn.join('', ['https://', props.domain?.name || frontendDist.distributionDomainName, '/api-ingest']),
  });
  new cdk.CfnOutput(scope, name('ApiFrontLambdaUrl'), {
    description: 'Api Front Lambda Url',
    value: cdk.Fn.join('', ['https://', props.domain?.name || frontendDist.distributionDomainName, '/api']),
  });

  const cwCloudFronts: CwCloudFront[] = [{ distribution: frontendDist }];

  return {
    frontendDist,
    observability: {
      cwCloudFronts,
    },
  };
}
