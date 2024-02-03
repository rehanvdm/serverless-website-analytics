import { z } from 'zod';
import { assertAuthentication, TrpcInstance } from '../../server';
import { SchemaSite } from '../../../lib/models/site';
import { LambdaEnvironment } from '../../environment';

export function sites(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(z.void())
    .output(z.array(SchemaSite))
    .query(({ ctx }) => {
      assertAuthentication(ctx);

      return LambdaEnvironment.SITES;
    });
}
