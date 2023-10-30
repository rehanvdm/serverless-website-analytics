import { z } from 'zod';
import { assertAuthentication, TrpcInstance } from '@backend/api-front/server';
import { SchemaSite } from '@backend/lib/models/site';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { AthenaEvents } from '@backend/lib/dal/athena/events';
import { EventFilter, EventFilterSchema } from '@backend/lib/models/event_filter';
import { LambdaEnvironment } from '@backend/api-front/environment';

const GetEventTopLevelStatsSchema = z.object({
  visitors: z.number(),
  count: z.number(),
  avg: z.number(),
  min: z.number(),
  max: z.number(),
  sum: z.number(),
  period: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  previous: z.object({
    visitors: z.number(),
    count: z.number(),
    avg: z.number(),
    min: z.number(),
    max: z.number(),
    sum: z.number(),
    period: z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    }),
  }),
});
export type GetEventTopLevelStats = z.infer<typeof GetEventTopLevelStatsSchema>;
export function getEventTopLevelStats(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        filter: EventFilterSchema.optional(),
      })
    )
    .output(GetEventTopLevelStatsSchema)
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaEvents = new AthenaEvents(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);
      const { prevStartDate, prevEndDate } = DateUtils.getPreviousPeriod(fromDate, toDate);

      const [totals, totalsPrev] = await Promise.all([
        athenaEvents.totalsForPeriod(fromDate, toDate, input.sites, input.filter),
        athenaEvents.totalsForPeriod(prevStartDate, prevEndDate, input.sites, input.filter),
      ]);

      return {
        visitors: totals.users,
        count: totals.count,
        avg: totals.avg || 0,
        min: totals.min || 0,
        max: totals.max || 0,
        sum: totals.sum || 0,
        period: {
          from: DateUtils.stringifyIso(fromDate),
          to: DateUtils.stringifyIso(toDate),
        },
        previous: {
          visitors: totals.users,
          count: totals.count,
          avg: totals.avg || 0,
          min: totals.min || 0,
          max: totals.max || 0,
          sum: totals.sum || 0,
          period: {
            from: DateUtils.stringifyIso(prevStartDate),
            to: DateUtils.stringifyIso(prevEndDate),
          },
        },
      };
    });
}

const GetEventOutputSchema = z.object({
  site: z.string(),
  category: z.string().nullable(),
  event: z.string(),
  count: z.number(),
  avg: z.number(),
  min: z.number(),
  max: z.number(),
  sum: z.number(),
});
export type GetEventOutput = z.infer<typeof GetEventOutputSchema>;
export function getEvents(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        queryExecutionId: z.string().optional(),
        nextToken: z.string().optional(),
        filter: EventFilterSchema.optional(),
      })
    )
    .output(
      z.object({
        queryExecutionId: z.string(),
        nextToken: z.string().optional(),
        data: z.array(GetEventOutputSchema),
      })
    )
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaEvents = new AthenaEvents(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const events = await athenaEvents.eventsForPeriod(
        fromDate,
        toDate,
        input.sites,
        input.queryExecutionId,
        input.nextToken,
        input.filter
      );
      return {
        queryExecutionId: events.queryExecutionId,
        nextToken: events.nextToken,
        data: events.data,
      };
    });
}

const GetEventChartSchema = z.object({
  groupedBy: z.string(), // The value of the groupBy field in the input, so either the name of the site, category or event
  date_key: z.string(),
  visitors: z.number(),
  count: z.number(),
  avg: z.number(),
  min: z.number(),
  max: z.number(),
  sum: z.number(),
});
export type GetEventChart = z.infer<typeof GetEventChartSchema>;
export function getEventChart(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        groupBy: z.enum(['site', 'category', 'event']),
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        period: z.enum(['hour', 'day']),
        timeZone: z.string(),
        filter: EventFilterSchema.optional(),
      })
    )
    .output(z.array(GetEventChartSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaEvents = new AthenaEvents(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const isValidTz = DateUtils.isValidTimeZone(input.timeZone);
      if (!isValidTz) {
        throw new Error(`Invalid time zone: ${input.timeZone}`);
      }

      const chartEvents = await athenaEvents.chartViewsForPeriod(
        input.groupBy,
        fromDate,
        toDate,
        input.sites,
        input.period,
        input.timeZone,
        input.filter
      );
      return chartEvents.map((row) => ({ ...row, date_key: DateUtils.stringifyIso(row.date_key) }));
    });
}

const GetEventReferrerSchema = z.object({
  referrer: z.string(),
  sum: z.number(),
});
export type GetEventReferrer = z.infer<typeof GetEventReferrerSchema>;
export function getEventReferrers(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        sites: z.array(SchemaSite),
        filter: EventFilterSchema.optional(),
      })
    )
    .output(z.array(GetEventReferrerSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaEvents = new AthenaEvents(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const EventReferrers = await athenaEvents.referrersForPeriod(fromDate, toDate, input.sites, input.filter);
      return EventReferrers;
    });
}

const GetEventUsersGroupedByStatSchema = z.object({
  group: z.string(),
  visitors: z.number(),
});
export type GetEventUsersGroupedByStat = z.infer<typeof GetEventUsersGroupedByStatSchema>;
export function getEventUsersGroupedByStatForPeriod(trpcInstance: TrpcInstance) {
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
        filter: EventFilterSchema.optional(),
      })
    )
    .output(z.array(GetEventUsersGroupedByStatSchema))
    .query(async ({ input, ctx }) => {
      assertAuthentication(ctx);

      if (input.filter && Object.keys(input.filter).length === 0) input.filter = undefined;

      const athenaEvents = new AthenaEvents(
        LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH
      );

      const fromDate = DateUtils.parseIso(input.from);
      const toDate = DateUtils.parseIso(input.to);

      const data = await athenaEvents.usersGroupedByStatForPeriod(
        fromDate,
        toDate,
        input.sites,
        input.groupBy,
        input.filter
      );
      return data;
    });
}
