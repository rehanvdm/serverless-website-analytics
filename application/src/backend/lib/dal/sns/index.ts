import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { getSnsClient } from '@backend/lib/utils/lazy_aws';
import { PublishCommandInput } from '@aws-sdk/client-sns/dist-types/commands/PublishCommand';

export class Sns {
  private snsClient: SNSClient;
  private topicArn: string;

  constructor(topicArn: string) {
    this.snsClient = getSnsClient();
    this.topicArn = topicArn;
  }

  public async publishCommand(input: Omit<PublishCommandInput, 'TopicArn'>) {
    await this.snsClient.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        ...input,
      })
    );
  }
}
