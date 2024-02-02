// https://stackoverflow.com/questions/51729775/node-programmatically-set-process-environment-variables-not-available-to-importe
// This is the only way to hoist ENV variables to be set BEFORE the other imports happen
// Does not work for AWS SDK V2, have to read the ENV variables and re-initialize the SDK clients

import { setAWSSDKCreds, TEST_TYPE } from '@tests/helpers';
import { TestConfig } from '../../../test-config';
process.env.TESTING_LOCAL = 'true';
process.env.TESTING_LOCAL_RE_INIT = 'true';
/* So that can be set externally */
if (!process.env.TEST_TYPE) {
  process.env.TEST_TYPE = TEST_TYPE.UNIT;
}
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';
setAWSSDKCreds(TestConfig.awsProfile, TestConfig.awsRegion, true);
