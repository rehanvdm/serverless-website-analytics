import { initTRPC, TRPCError } from '@trpc/server';
import { getFrontendEnvironment } from '@backend/api-front/routes/env';
import { sites, sitesGetPartitions, sitesUpdatePartition } from '@backend/api-front/routes/sites';
import {
  getTopLevelStats,
  getPageViews,
  getChartViews,
  getPageReferrers,
  getUsersGroupedByStatForPeriod,
} from '@backend/api-front/routes/stats';
import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';

export type Context = {
  requiresAuth: boolean;
  user: CognitoIdTokenPayload | undefined;
};

export function assertAuthentication(context: Context) {
  if (context.requiresAuth && !context.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return context.user!;
}

const trpcInstance = initTRPC.context<Context>().create({ isDev: true });

export type TrpcInstance = typeof trpcInstance;

export const appRouter = trpcInstance.router({
  getFrontendEnvironment: getFrontendEnvironment(trpcInstance),
  sites: sites(trpcInstance),
  sitesGetPartitions: sitesGetPartitions(trpcInstance),
  sitesUpdatePartition: sitesUpdatePartition(trpcInstance),
  getTopLevelStats: getTopLevelStats(trpcInstance),
  getPageViews: getPageViews(trpcInstance),
  getChartViews: getChartViews(trpcInstance),
  getPageReferrers: getPageReferrers(trpcInstance),
  getUsersGroupedByStatForPeriod: getUsersGroupedByStatForPeriod(trpcInstance),
});

export type AppRouter = typeof appRouter;
