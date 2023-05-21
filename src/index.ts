import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * A sample class which creates a Lambda function.
 */
export class NewLambda extends Construct {
  /**
   * Description of the constructor.
   * @param scope Okay Okay
   * @param id
   */
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(path.join(__dirname, 'build/backend/api')),
      handler: 'index.handler', // defaults to 'handler'
    });
  }
}

export class Hello {
  public sayHello() {
    return 'hello, world!';
  }
}
