import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Swa, SwaProps } from '../src';

describe('Auth', () => {
  const partialSwaProps: Omit<SwaProps, 'auth'> = {
    environment: 'dev',
    awsEnv: {
      account: '123456789012',
      region: 'us-east-1',
    },
    sites: ['https://example.com'],
    allowedOrigins: ['https://example.com'],
  };

  test('No Auth', () => {
    const app = new App();
    const stack = new Stack(app, 'testing-stack');
    new Swa(stack, 'testing-swa', {
      ...partialSwaProps,
    });

    const assert = Template.fromStack(stack);
    assert.resourceCountIs('AWS::CloudFront::Function', 0);
    assert.resourceCountIs('AWS::Cognito::UserPool', 0);
    assert.resourceCountIs('AWS::Cognito::UserPoolUser', 0);
  });

  test('Basic auth has Lambda', () => {
    const app = new App();
    const stack = new Stack(app, 'testing-stack');
    new Swa(stack, 'testing-swa', {
      ...partialSwaProps,
      auth: {
        basicAuth: {
          username: 'test',
          password: 'test',
        },
      },
    });

    const assert = Template.fromStack(stack);
    assert.hasResourceProperties('AWS::CloudFront::Function', {
      Name: 'testing-swa-basic-auth-cf-func',
    });
  });

  test('Cognito auth has pool', () => {
    const app = new App();
    const stack = new Stack(app, 'testing-stack');
    new Swa(stack, 'testing-swa', {
      ...partialSwaProps,
      auth: {
        cognito: {
          users: [
            {
              name: 'test',
              email: 'test@gmail.com',
            },
          ],
        },
      },
    });

    const assert = Template.fromStack(stack);
    assert.resourceCountIs('AWS::Cognito::UserPool', 1);
    assert.resourceCountIs('AWS::Cognito::UserPoolUser', 1);
  });

  test('Only 1 auth type allowed', () => {
    try {
      const app = new App();
      const stack = new Stack(app, 'testing-stack');
      new Swa(stack, 'testing-swa', {
        ...partialSwaProps,
        auth: {
          basicAuth: {
            username: 'test',
            password: 'test',
          },
          cognito: {
            users: [
              {
                name: 'test',
                email: 'test@gmail.com',
              },
            ],
          },
        },
      });
      const assert = Template.fromStack(stack);
    } catch (e) {
      expect(e.message).toBe('Specify only `basicAuth` or `cognito` for `auth` but not both');
    }
  });
});
