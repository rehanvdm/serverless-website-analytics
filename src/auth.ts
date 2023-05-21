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
    throw new Error('Specify only one auth type');
  }

  if (props.auth?.basicAuth) {
    /* =========================================== */
    /* ============ Cloud Front Related ========== */
    /* =========================================== */
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
        // fullname: { //name is already a standard attribute
        //   required: true,
        //   mutable: true,
        // },
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

    const domain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: 'swa-test-1', //TODO: How to randomize this? Think let them pass in a prefix
      },
    });

    //TODO:
    // const certificateArn = 'arn:aws:acm:us-east-1:123456789012:certificate/11-3336f1-44483d-adc7-9cd375c5169d';
    //
    // const domainCert = certificatemanager.Certificate.fromCertificateArn(this, 'domainCert', certificateArn);
    // pool.addDomain('CustomDomain', {
    //   customDomain: {
    //     domainName: 'user.myapp.com',
    //     certificate: domainCert,
    //   },
    // });

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

    userPoolDomain = domain.baseUrl();

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
    new cdk.CfnOutput(scope, name('USER_POOL_BASE_URL'), { description: 'USER_POOL_BASE_URL', value: userPoolDomain });
  }

  return {
    cloudFrontBasicAuthFunction,
    userPool,
    userPoolClient,
    userPoolClientOptions,
    userPoolDomain,
  };
}
