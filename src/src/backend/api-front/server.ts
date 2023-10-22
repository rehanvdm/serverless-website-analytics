import { initTRPC, TRPCError } from '@trpc/server';
import { getFrontendEnvironment } from '@backend/api-front/routes/env';
import { sites } from '@backend/api-front/routes/sites';
import {
  getPageTopLevelStats,
  getPageViews,
  getPageChartViews,
  getPageReferrers,
  getPageUsersGroupedByStatForPeriod,
} from '@backend/api-front/routes/stats/page';
import {
  getEventChart,
  getEvents,
  getEventTopLevelStats,
  getEventReferrers,
  getEventUsersGroupedByStatForPeriod
} from "@backend/api-front/routes/stats/event";
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

  getPageTopLevelStats: getPageTopLevelStats(trpcInstance),
  getPageViews: getPageViews(trpcInstance),
  getPageChartViews: getPageChartViews(trpcInstance),
  getPageReferrers: getPageReferrers(trpcInstance),
  getPageUsersGroupedByStatForPeriod: getPageUsersGroupedByStatForPeriod(trpcInstance),

  getEventTopLevelStats: getEventTopLevelStats(trpcInstance),
  getEvents: getEvents(trpcInstance),
  getEventChart: getEventChart(trpcInstance),
  getEventReferrers: getEventReferrers(trpcInstance),
  getEventUsersGroupedByStatForPeriod: getEventUsersGroupedByStatForPeriod(trpcInstance),
});

export type AppRouter = typeof appRouter;
