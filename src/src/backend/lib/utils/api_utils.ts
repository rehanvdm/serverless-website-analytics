import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { TRPCError } from '@trpc/server';

export type TRPCHandlerError = {
  error: TRPCError;
  type: 'mutation' | 'query' | 'subscription' | 'unknown';
  path: string | undefined;
  req: APIGatewayProxyEventV2;
  input: unknown;
  ctx: object | undefined;
};

export function removeCloudFrontProxyPath(event: APIGatewayProxyEventV2, path: string) {
  if (event.rawPath.startsWith(path)) {
    event.rawPath = event.rawPath.replace(path, '');
    event.requestContext.http.path = event.requestContext.http.path.replace(path, '');
  }

  return event;
}
