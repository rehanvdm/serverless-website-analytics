import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { SwaProps } from './index';

export function auth(scope: Construct, name: (name: string) => string, props: SwaProps) {
  let cloudFrontBasicAuthFunction: cloudfront.Function | undefined = undefined;
  let userPool: cognito.UserPool | undefined = undefined;
  let userPoolClient: cognito.UserPoolClient | undefined = undefined;
  let userPoolClientOptions: cognito.UserPoolClientOptions | undefined = undefined;
  let userPoolDomain: string | undefined = undefined;

  if (props.auth?.basicAuth && props.auth?.cognito) {
    throw new Error('Specify only `basicAuth` or `cognito` for `auth` but not both');
  }

  if (props.auth?.basicAuth) {
    let cloudFrontBasicAuthFunctionContents = fs.readFileSync(
      path.join(__dirname, '../lib/build/backend/cloudfront/basic-auth.js'),
      { encoding: 'utf8' }
    );
    cloudFrontBasicAuthFunctionContents = cloudFrontBasicAuthFunctionContents.replace(
      '{USERNAME}',
      props.auth?.basicAuth.username
    );
    cloudFrontBasicAuthFunctionContents = cloudFrontBasicAuthFunctionContents.replace(
      '{PASSWORD}',
      props.auth?.basicAuth.password
    );
    /* Allows us to test this function locally but makes CloudFront happy because exports are not supported */
    cloudFrontBasicAuthFunctionContents = cloudFrontBasicAuthFunctionContents.replace('export function', 'function');
    cloudFrontBasicAuthFunction = new cloudfront.Function(scope, name('basic-auth-cf-func'), {
      functionName: name('basic-auth-cf-func'),
      code: cloudfront.FunctionCode.fromInline(cloudFrontBasicAuthFunctionContents),
    });

    cdk.Annotations.of(scope).addWarning('Basic auth is not recommended for production use, it only protects the html' +
      ' page, not the APIs, consider Cognito instead');
  } else if (props.auth?.cognito) {
    userPool = new cognito.UserPool(scope, name('userpool'), {
      userPoolName: name('userpool'),
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 6,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    userPoolClientOptions = {
      userPoolClientName: name('userpool-web-client'),
      accessTokenValidity: cdk.Duration.days(1),
      idTokenValidity: cdk.Duration.days(1),
      oAuth: {
        flows: {
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN,
        ],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    };
    userPoolClient = userPool.addClient(name('userpool-web-client'), userPoolClientOptions);


    if(!props.domain)
    {
      const domain = userPool.addDomain('cognito-domain', {
        cognitoDomain: {
          domainPrefix: props.auth.cognito.loginSubDomain,
        },
      });
      userPoolDomain = domain.baseUrl();
      new cdk.CfnOutput(scope, name('COGNITO_HOSTED_UI_URL'), { description: 'COGNITO_HOSTED_UI_URL', value: userPoolDomain });
    }
    else
    {
      /* Defer creating it here, wait until the Frontend CloudFront is created.
      * The domain will only be created in the Frontend stack because Cognito requires an A record for a hosted zone
      * and many people will just create a new subdomain/hosted zone with no records when running this component */
      userPoolDomain = `https://${props.auth.cognito.loginSubDomain}.${props.domain.name}`;
    }



    for (let user of props.auth?.cognito.users) {
      new cognito.CfnUserPoolUser(scope, user.email, {
        userPoolId: userPool.userPoolId,
        userAttributes: [
          {
            name: 'name',
            value: user.name,
          },
        ],
        username: user.email,
      });
    }

    new cdk.CfnOutput(scope, name('USER_POOL_ID'), { description: 'USER_POOL_ID', value: userPool.userPoolId });
    new cdk.CfnOutput(scope, name('USER_POOL_CLIENT_ID'), {
      description: 'USER_POOL_CLIENT_ID',
      value: userPoolClient.userPoolClientId,
    });

  }
  else {
    cdk.Annotations.of(scope).addWarning('No auth specified. This is not recommended for production use, specify Cognito instead.');
  }

  return {
    cloudFrontBasicAuthFunction,
    userPool,
    userPoolClient,
    userPoolClientOptions,
    userPoolDomain,
  };
}
