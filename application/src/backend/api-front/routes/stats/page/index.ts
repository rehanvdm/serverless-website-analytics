import { z } from 'zod';
import { assertAuthentication, TrpcInstance } from '../../../server';
import { SchemaSite } from '../../../../lib/models/site';
import { DateUtils } from '../../../../lib/utils/date_utils';
import { AthenaPageViews } from '../../../../lib/dal/athena/page_views';
import { PageFilterSchema } from '../../../../lib/models/page_filter';
import { LambdaEnvironment } from '../../../environment';

const GetPageTopLevelStatsSchema = z.object({
  visitors: z.number(),
  page_views: z.number(),
  avg_time_on_page: z.number(),
  bounce_rate: z.number(),
  latest_page_opened_at: z.string().datetime().optional(),
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  previous: z.object({
    visitors: z.number(),
    page_views: z.number(),
    avg_time_on_page: z.number(),
    bounce_rate: z.number(),
    period: z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    }),
  }),
});
export type GetPageTopLevelStats = z.infer<typeof GetPageTopLevelStatsSchema>;
export function getPageTopLevelStats(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        filter: PageFilterSchema.optional(),
      })
    )
    .output(GetPageTopLevelStatsSchema)
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaPageViews = new AthenaPageViews(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);
      const { prevStartDate, prevEndDate } = DateUtils.getPreviousPeriod(fromDate, toDate);

      const [totals, totalsPrev] = await Promise.all([
        athenaPageViews.totalsForPeriod(fromDate, toDate, input.sites, input.filter),
        athenaPageViews.totalsForPeriod(prevStartDate, prevEndDate, input.sites, input.filter),
      ]);

      return {
        visitors: totals.users,
        page_views: totals.views,
        avg_time_on_page: totals.avg_time_on_page || 0,
        bounce_rate: totals.bounce_rate || 0,
        latest_page_opened_at: totals.latest_page_opened_at
          ? DateUtils.stringifyIso(totals.latest_page_opened_at)
          : undefined,
        period: {
          from: DateUtils.stringifyIso(fromDate),
          to: DateUtils.stringifyIso(toDate),
        },
        previous: {
          visitors: totalsPrev.users,
          page_views: totalsPrev.views,
          avg_time_on_page: totalsPrev.avg_time_on_page || 0,
          bounce_rate: totalsPrev.bounce_rate || 0,
          period: {
            from: DateUtils.stringifyIso(prevStartDate),
            to: DateUtils.stringifyIso(prevEndDate),
          },
        },
      };
    });
}

const GetPageViewsSchema = z.object({
  site: z.string(),
  page_url: z.string(),
  views: z.number(),
  avg_time_on_page: z.number(),
});
export type GetPageView = z.infer<typeof GetPageViewsSchema>;
export function getPageViews(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        queryExecutionId: z.string().optional(),
        nextToken: z.string().optional(),
        filter: PageFilterSchema.optional(),
      })
    )
    .output(
      z.object({
        queryExecutionId: z.string(),
        nextToken: z.string().optional(),
        data: z.array(GetPageViewsSchema),
      })
    )
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaPageViews = new AthenaPageViews(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const pageViews = await athenaPageViews.pageViewsForPeriod(
        fromDate,
        toDate,
        input.sites,
        input.queryExecutionId,
        input.nextToken,
        input.filter
      );
      return {
        queryExecutionId: pageViews.queryExecutionId,
        nextToken: pageViews.nextToken,
        data: pageViews.data,
      };
    });
}

const GetPageChartViewsSchema = z.object({
  site: z.string(),
  date_key: z.string(),
  visitors: z.number(),
  views: z.number(),
});
export type GetPageChartViews = z.infer<typeof GetPageChartViewsSchema>;
export function getPageChartViews(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        period: z.enum(['hour', 'day']),
        timeZone: z.string(),
        filter: PageFilterSchema.optional(),
      })
    )
    .output(z.array(GetPageChartViewsSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaPageViews = new AthenaPageViews(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const isValidTz = DateUtils.isValidTimeZone(input.timeZone);
      if (!isValidTz) {
        throw new Error(`Invalid time zone: ${input.timeZone}`);
      }

      const chartViews = await athenaPageViews.chartViewsForPeriod(
        fromDate,
        toDate,
        input.sites,
        input.period,
        input.timeZone,
        input.filter
      );
      return chartViews.map((row) => ({ ...row, date_key: DateUtils.stringifyIso(row.date_key) }));
    });
}

// const ChartLocationSchema = z.object({
//   country_name: z.string(),
//   visitors: z.number(),
// });
// export type ChartLocation = z.infer<typeof ChartLocationSchema>;
// export function getChartLocations(trpcInstance: TrpcInstance)
// {
//   return trpcInstance.procedure
//     .input(z.object({
//       from: z.string().datetime(),
//       to: z.string().datetime(),
//       sites: z.array(SchemaSite),
//     }))
//     .output(z.array(ChartLocationSchema)
//     )
//     .query(async ({input}) =>
//     {
//       const athenaPageViews = new AthenaPageViews();
//
//       const fromDate = DateUtils.parseIso(input.from);
//       const toDate = DateUtils.parseIso(input.to);
//
//       const chartLocations = await athenaPageViews.usersGroupedByStatForPeriod(fromDate, toDate, input.sites, "country_name");
//       return chartLocations as ChartLocation[];
//     });
// }

const GetPageReferrerSchema = z.object({
  referrer: z.string(),
  views: z.number(),
});
export type GetPageReferrer = z.infer<typeof GetPageReferrerSchema>;
export function getPageReferrers(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        filter: PageFilterSchema.optional(),
      })
    )
    .output(z.array(GetPageReferrerSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaPageViews = new AthenaPageViews(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const PageReferrers = await athenaPageViews.referrersForPeriod(fromDate, toDate, input.sites, input.filter);
      return PageReferrers;
    });
}

const GetPageUsersGroupedByStatSchema = z.object({
  group: z.string(),
  visitors: z.number(),
});
export type GetPageUsersGroupedByStat = z.infer<typeof GetPageUsersGroupedByStatSchema>;
export function getPageUsersGroupedByStatForPeriod(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        groupBy: z.enum([
          'country_name',
          'device_type',
          'utm_source',
          'utm_medium',
          'utm_campaign',
          'utm_term',
          'utm_content',
        ]), // TODO: Later: "browser", "os"
        filter: PageFilterSchema.optional(),
      })
    )
    .output(z.array(GetPageUsersGroupedByStatSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaPageViews = new AthenaPageViews(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const data = await athenaPageViews.usersGroupedByStatForPeriod(
        fromDate,
        toDate,
        input.sites,
        input.groupBy,
        input.filter
      );
      return data;
    });
}
