import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as cert from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as sns from 'aws-cdk-lib/aws-sns';
import { AllAlarmTypes, Swa } from '@infra/src';

describe('Build', () => {
  it('Local build and debug', async function () {
    const app = new App();
    const stack = new Stack(app, 'test-build');

    const alarmTopic = new sns.Topic(stack, 'alarm-topic');
    new Swa(stack, 'testing-swa', {
      environment: 'dev',
      awsEnv: {
        account: '123456789012',
        region: 'us-east-1',
      },
      sites: ['https://example.com'],
      allowedOrigins: ['https://example.com'],
      auth: {
        // basicAuth: {
        //   username: 'test',
        //   password: 'test',
        // },
        cognito: {
          loginSubDomain: 'login',
          users: [
            {
              name: 'test',
              email: 'test@gmail.com',
            },
          ],
        },
      },
      observability: {
        alarms: {
          alarmTypes: AllAlarmTypes,
          alarmTopic,
        },
        dashboard: true,
      },
    });
    Template.fromStack(stack);
  });

  it('Cert separate stack - Old prop', async function () {
    const app = new App();
    const stack = new Stack(app, 'test-build');

    const wildCardCertUsEast1 = cert.Certificate.fromCertificateArn(
      stack,
      'CertUsEast1',
      'arn:aws:acm:us-east-1:123456789:certificate/123456789'
    );

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, 'HostedZone', {
      hostedZoneId: '123456789',
      zoneName: 'test.com',
    });

    const alarmTopic = new sns.Topic(stack, 'alarm-topic');
    new Swa(stack, 'testing-swa', {
      environment: 'dev',
      awsEnv: {
        account: '123456789012',
        region: 'us-east-1',
      },
      sites: ['https://example.com'],
      allowedOrigins: ['https://example.com'],
      auth: {
        cognito: {
          loginSubDomain: 'login',
          users: [
            {
              name: 'test',
              email: 'test@gmail.com',
            },
          ],
        },
      },
      domain: {
        name: 'test.com',
        certificate: wildCardCertUsEast1,
        hostedZone,
        // trackOwnDomain: true,
      },

      observability: {
        alarms: {
          alarmTypes: AllAlarmTypes,
          alarmTopic,
        },
        dashboard: true,
      },
    });
    Template.fromStack(stack);
  });

  it('Cert separate stack - New prop', async function () {
    const app = new App();
    const stack = new Stack(app, 'test-build');

    const wildCardCertUsEast1 = cert.Certificate.fromCertificateArn(
      stack,
      'CertUsEast1',
      'arn:aws:acm:us-east-1:123456789:certificate/123456789'
    );

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, 'HostedZone', {
      hostedZoneId: '123456789',
      zoneName: 'test.com',
    });

    const alarmTopic = new sns.Topic(stack, 'alarm-topic');
    new Swa(stack, 'testing-swa', {
      environment: 'dev',
      awsEnv: {
        account: '123456789012',
        region: 'us-east-1',
      },
      sites: ['https://example.com'],
      allowedOrigins: ['https://example.com'],

      domain: {
        name: 'test.com',
        usEast1Certificate: wildCardCertUsEast1,
        hostedZone,
        // trackOwnDomain: true,
      },

      observability: {
        alarms: {
          alarmTypes: AllAlarmTypes,
          alarmTopic,
        },
        dashboard: true,
      },
    });
    Template.fromStack(stack);
  });

  it('Cert same stack', async function () {
    const app = new App();
    const stack = new Stack(app, 'test-build');

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, 'HostedZone', {
      hostedZoneId: '123456789',
      zoneName: 'test.com',
    });
    const wildCardCertUsEast1 = new cert.Certificate(stack, 'Certificate', {
      domainName: 'analytics.test.com',
      subjectAlternativeNames: ['*.analytics.test.com'],
      validation: cert.CertificateValidation.fromDns(hostedZone),
    });

    const alarmTopic = new sns.Topic(stack, 'alarm-topic');
    new Swa(stack, 'testing-swa', {
      environment: 'dev',
      awsEnv: {
        account: '123456789012',
        region: 'us-east-1',
      },
      sites: ['https://example.com'],
      allowedOrigins: ['https://example.com'],

      domain: {
        name: 'test.com',
        usEast1Certificate: wildCardCertUsEast1,
        hostedZone,
        // trackOwnDomain: true,
      },

      observability: {
        alarms: {
          alarmTypes: AllAlarmTypes,
          alarmTopic,
        },
        dashboard: true,
      },
    });
    Template.fromStack(stack);
  });

  it('Default Lambda Log Level', async function () {
    const app = new App();
    const stack = new Stack(app, 'test-build');

    new Swa(stack, 'testing-swa', {
      environment: 'dev',
      awsEnv: {
        account: '123456789012',
        region: 'us-east-1',
      },
      sites: ['https://example.com'],
      allowedOrigins: ['https://example.com'],
      auth: {
        // basicAuth: {
        //   username: 'test',
        //   password: 'test',
        // },
        cognito: {
          loginSubDomain: 'login',
          users: [
            {
              name: 'test',
              email: 'test@gmail.com',
            },
          ],
        },
      },
      // observability: { }
    });
    const template = Template.fromStack(stack);

    template.hasResource('AWS::Lambda::Function', {
      Properties: { Environment: { Variables: { LOG_LEVEL: 'AUDIT' } } },
    });
  });

  it('Defined Lambda Log Level', async function () {
    const app = new App();
    const stack = new Stack(app, 'test-build');

    new Swa(stack, 'testing-swa', {
      environment: 'dev',
      awsEnv: {
        account: '123456789012',
        region: 'us-east-1',
      },
      sites: ['https://example.com'],
      allowedOrigins: ['https://example.com'],
      auth: {
        // basicAuth: {
        //   username: 'test',
        //   password: 'test',
        // },
        cognito: {
          loginSubDomain: 'login',
          users: [
            {
              name: 'test',
              email: 'test@gmail.com',
            },
          ],
        },
      },
      observability: {
        loglevel: 'WARN',
      },
    });
    const template = Template.fromStack(stack);

    template.hasResource('AWS::Lambda::Function', {
      Properties: { Environment: { Variables: { LOG_LEVEL: 'WARN' } } },
    });
  });
});
