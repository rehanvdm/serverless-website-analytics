import '@tests/environment-hoist';
import { handler } from '@backend/cloudfront/basic-auth.js';
import { expect } from 'chai';

describe('Basic Auth', function () {
  before(async function () {
    /* Monkey patch CF Custom Functions
       https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-javascript-runtime-features.html
    */
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    String.bytesFrom = (base64) => {
      return Buffer.from(base64, 'base64').toString();
    };
  });

  it('Matches', async function () {
    const event = {
      request: {
        headers: {
          authorization: {
            value: 'Basic ' + Buffer.from('{USERNAME}:{PASSWORD}').toString('base64')
          }
        }
      }
    }
    const resp = handler(event);
    expect(resp).to.equal(event.request);
  });

  it('401', async function () {
    const event = {
      request: {
        headers: {
          authorization: {
            value: 'Basic ' + Buffer.from('{USERNAME}:nope').toString('base64')
          }
        }
      }
    }
    const resp = handler(event);
    expect(resp.statusCode).to.equal(401);
  });
});
