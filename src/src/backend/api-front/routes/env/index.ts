import { z } from 'zod';
import { TrpcInstance } from '@backend/api-front/server';
import { LambdaEnvironment } from '@backend/api-front/environment';

const FrontendEnvironmentSchema = z.object({
  cognitoLoginUrl: z.string().optional()
});
export type FrontendEnvironment = z.infer<typeof FrontendEnvironmentSchema>;

export function getFrontendEnvironment (trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(z.void())
    .output(FrontendEnvironmentSchema)
    .query(() => {
      let cognitoLoginUrl: string | undefined;
      if (LambdaEnvironment.COGNITO_HOSTED_UI_URL && LambdaEnvironment.COGNITO_CLIENT_ID) {
        cognitoLoginUrl = `${LambdaEnvironment.COGNITO_HOSTED_UI_URL}/login?client_id=${LambdaEnvironment.COGNITO_CLIENT_ID}&` +
        'response_type=token&scope=aws.cognito.signin.user.admin+email+openid+profile'; // &redirect_uri= Caller can add and decide
      }
      return {
        cognitoLoginUrl
      };
    });
}
