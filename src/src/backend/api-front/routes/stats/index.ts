import { z } from 'zod';
import { assertAuthentication, TrpcInstance } from '@backend/api-front/server';
import { SchemaSite } from '@backend/lib/models/site';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { AthenaPageViews } from '@backend/lib/dal/athena/page_views';

const GetTopLevelStatsSchema = z.object({
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
export type GetTopLevelStats = z.infer<typeof GetTopLevelStatsSchema>;
export function getTopLevelStats(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
      })
    )
    .output(GetTopLevelStatsSchema)
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      const athenaPageViews = new AthenaPageViews();

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);
      const { prevStartDate, prevEndDate } = DateUtils.getPreviousPeriod(fromDate, toDate);

      const [totals, totalsPrev] = await Promise.all([
        athenaPageViews.totalsForPeriod(fromDate, toDate, input.sites),
        athenaPageViews.totalsForPeriod(prevStartDate, prevEndDate, input.sites),
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

const PageViewsSchema = z.object({
  site: z.string(),
  page_url: z.string(),
  views: z.number(),
  avg_time_on_page: z.number(),
});
export type PageView = z.infer<typeof PageViewsSchema>;
export function getPageViews(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        queryExecutionId: z.string().optional(),
        nextToken: z.string().optional(),
      })
    )
    .output(
      z.object({
        queryExecutionId: z.string(),
        nextToken: z.string().optional(),
        data: z.array(PageViewsSchema),
      })
    )
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      const athenaPageViews = new AthenaPageViews();

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const pageViews = await athenaPageViews.pageViewsForPeriod(
        fromDate,
        toDate,
        input.sites,
        input.queryExecutionId,
        input.nextToken
      );
      return {
        queryExecutionId: pageViews.queryExecutionId,
        nextToken: pageViews.nextToken,
        data: pageViews.data,
      };
    });
}

const ChartViewsSchema = z.object({
  site: z.string(),
  date_key: z.string(),
  visitors: z.number(),
  views: z.number(),
});
export type ChartView = z.infer<typeof ChartViewsSchema>;
export function getChartViews(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        period: z.enum(['hour', 'day']),
        timeZone: z.string(),
      })
    )
    .output(z.array(ChartViewsSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      const athenaPageViews = new AthenaPageViews();

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
        input.timeZone
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

const PageReferrerSchema = z.object({
  referrer: z.string(),
  views: z.number(),
});
export type PageReferrer = z.infer<typeof PageReferrerSchema>;
export function getPageReferrers(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
      })
    )
    .output(z.array(PageReferrerSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      const athenaPageViews = new AthenaPageViews();

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const PageReferrers = await athenaPageViews.referrersForPeriod(fromDate, toDate, input.sites);
      return PageReferrers;
    });
}

const UsersGroupedByStatSchema = z.object({
  group: z.string(),
  visitors: z.number(),
});
export type UsersGroupedByStat = z.infer<typeof UsersGroupedByStatSchema>;
export function getUsersGroupedByStatForPeriod(trpcInstance: TrpcInstance) {
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
      })
    )
    .output(z.array(UsersGroupedByStatSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      const athenaPageViews = new AthenaPageViews();

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const data = await athenaPageViews.usersGroupedByStatForPeriod(fromDate, toDate, input.sites, input.groupBy);
      return data;
    });
}
