import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { AllAlarmTypes, Swa, SwaProps } from '../src';

test('Local build and debug', () => {
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
