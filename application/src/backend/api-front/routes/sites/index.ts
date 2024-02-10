import { z } from 'zod';
import { assertAuthentication, TrpcInstance } from '@backend/api-front/server';
import { SchemaSite } from '@backend/lib/models/site';
import { LambdaEnvironment } from '@backend/api-front/environment';

export function sites(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(z.void())
    .output(z.array(SchemaSite))
    .query(({ ctx }) => {
      assertAuthentication(ctx);

      return LambdaEnvironment.SITES;
    });
}
