import { DateUtils } from '../../utils/date_utils';
import { AthenaBase } from '../../utils/athena_base';
import { getAthenaClient, getS3Client, getEventBridgeClient } from '../../utils/lazy_aws';
import { Page } from '../../models/page';
import { EventFilter } from '../../models/event_filter';
import { v4 as uuidv4 } from 'uuid';

export class AthenaEvents extends AthenaBase {
  constructor(glueDbName: string, athenaStorageBucket: string) {
    const athenaClient = getAthenaClient();
    const s3Client = getS3Client();

    super(athenaClient, s3Client, glueDbName, athenaStorageBucket, {
      bigIntAsNumber: true,
      falselyAs: 'null',
    });
  }

  /**
   * Returns the first CTEs that is repeated across all queries. Select from `cte_data_filtered` to get the data.
   * @param columns
   * @param fromDate
   * @param toDate
   * @param sites
   * @param filter
   */
  cteFilteredDataQuery(columns: string[], fromDate: Date, toDate: Date, sites: string[], filter?: EventFilter) {
    const cteSiteWhereClauseSites = sites.map((site) => `site = '${site}'`).join(' OR ');

    /* Partition dates are UTC and not TZ aware, we narrow them later. Here we add 1 day to the end date so that
     * it is inclusive of the end date */
    const datesToQuery: Date[] = [];
    const inclusiveEndDate = DateUtils.addDays(toDate, 1);
    let currentDate = fromDate;
    while (currentDate <= inclusiveEndDate) {
      datesToQuery.push(currentDate);
      currentDate = DateUtils.addDays(currentDate, 1);
    }
    const cteDateWhereClauseDates: string = datesToQuery
      .map((dt) => `tracked_at_date = '${DateUtils.stringifyFormat(dt, 'yyyy-MM-dd')}'`)
      .join(' OR ');

    let cteWhereAndClauseExtra = '';
    if (filter) {
      const cteWhereClauseFilter = Object.entries(filter)
        .map(([key, value]) => {
          if (value === null) return `${key} IS NULL`;
          else return `${key} = '${value}'`;
        })
        .join(' AND ');
      cteWhereAndClauseExtra += ` AND (${cteWhereClauseFilter})`;
    }

    const exactTimeFrom = DateUtils.stringifyFormat(fromDate, 'yyyy-MM-dd HH:mm:ss.SSS');
    const exactTimeTo = DateUtils.stringifyFormat(toDate, 'yyyy-MM-dd HH:mm:ss.SSS');

    return `
          cte_data AS (
              SELECT ${columns.join(', ')}, tracked_at,
                     ROW_NUMBER() OVER (PARTITION BY event_id) rn
              FROM events
              WHERE (${cteSiteWhereClauseSites}) AND (${cteDateWhereClauseDates}) ${cteWhereAndClauseExtra}
          ),
          cte_data_filtered AS (
              SELECT *
              FROM cte_data
              WHERE rn = 1 AND tracked_at BETWEEN parse_datetime('${exactTimeFrom}','yyyy-MM-dd HH:mm:ss.SSS')
                    AND parse_datetime('${exactTimeTo}','yyyy-MM-dd HH:mm:ss.SSS')
          )`;
  }

  async totalsForPeriod(fromDate: Date, toDate: Date, sites: string[], filter?: EventFilter) {
    const query = `
          WITH ${this.cteFilteredDataQuery(
            ['site', 'category', 'event', 'data', 'user_id'],
            fromDate,
            toDate,
            sites,
            filter
          )},
          cte_data_by_event AS (
           SELECT
             COUNT(DISTINCT user_id) as "users",
             COUNT(data) as "count",
             ROUND(AVG(data),2) as "avg",
             MIN(data) as "min",
             MAX(data) as "max",
             SUM(data) as "sum"
           FROM cte_data_filtered
          )
          SELECT *
          FROM cte_data_by_event`;

    const res = await this.query(query);
    return res.data[0] as {
      users: number;
      count: number;
      avg: number;
      min: number;
      max: number;
      sum: number;
    };
  }

  async eventsForPeriod(
    fromDate: Date,
    toDate: Date,
    sites: string[],
    queryExecutionId?: string,
    nextToken?: string,
    filter?: EventFilter,
    limit = 1000
  ) {
    if (queryExecutionId && !nextToken) {
      throw new Error('Cannot paginate results without a nextToken');
    }

    const query = `
          WITH ${this.cteFilteredDataQuery(['site', 'category', 'event', 'data'], fromDate, toDate, sites, filter)},
          cte_data_by_event AS (
           SELECT
             site,
             category,
             event,
             COUNT(data) as "count",
             ROUND(AVG(data),2) as "avg",
             MIN(data) as "min",
             MAX(data) as "max",
             SUM(data) as "sum"
           FROM cte_data_filtered
           GROUP BY site, category, event
          )
          SELECT *
          FROM cte_data_by_event
          ORDER BY count DESC, category ASC, event ASC`;

    const resp = await this.query(query, limit, queryExecutionId, nextToken);
    return {
      nextToken: resp.nextToken,
      queryExecutionId: resp.queryExecutionId,
      data: resp.data as {
        site: string;
        category: string;
        event: string;
        count: number;
        avg: number;
        min: number;
        max: number;
        sum: number;
      }[],
    };
  }

  async chartViewsForPeriod(
    groupBy: 'site' | 'category' | 'event',
    fromDate: Date,
    toDate: Date,
    sites: string[],
    period: 'hour' | 'day',
    timeZone: string,
    filter?: EventFilter
  ) {
    const query = `
          WITH ${this.cteFilteredDataQuery([groupBy, 'user_id', 'data'], fromDate, toDate, sites, filter)}
          SELECT
              ${groupBy} as "groupedBy",
              CAST(DATE_TRUNC('${period}', tracked_at AT TIME ZONE '${timeZone}') AS TIMESTAMP) as "date_key",
              COUNT(DISTINCT user_id) as "visitors",
              COUNT(data) as "count",
              ROUND(AVG(data),2) as "avg",
              MIN(data) as "min",
              MAX(data) as "max",
              SUM(data) as "sum"
          FROM cte_data_filtered
          GROUP BY 1, 2
          ORDER BY 1, 2`;

    const resp = await this.query(query);

    return resp.data as {
      groupedBy: 'site' | 'category' | 'event';
      date_key: Date;
      visitors: number;
      count: number;
      avg: number;
      min: number;
      max: number;
      sum: number;
    }[];
  }

  async referrersForPeriod(fromDate: Date, toDate: Date, sites: string[], filter?: EventFilter) {
    const query = `
          WITH ${this.cteFilteredDataQuery(['referrer', 'data'], fromDate, toDate, sites, filter)}
          SELECT
            COALESCE(referrer, 'No Referrer') AS referrer,
            SUM(data) as "sum"
          FROM cte_data_filtered
          GROUP BY referrer
          ORDER BY sum DESC`;

    const resp = await this.query(query);

    return resp.data as {
      referrer: string;
      sum: number;
    }[];
  }

  async usersGroupedByStatForPeriod(
    fromDate: Date,
    toDate: Date,
    sites: string[],
    stat: keyof Page,
    filter?: EventFilter
  ) {
    // TODO: possible query optimization see same function in page view

    const query = `
          WITH ${this.cteFilteredDataQuery(['user_id', stat], fromDate, toDate, sites, filter)},
          user_distinct_stat AS (
            SELECT
              user_id, ${stat},
              COUNT(*) as "visitors"
            FROM cte_data_filtered
            WHERE ${stat} IS NOT NULL
            GROUP BY 1, 2
            ORDER BY 3 DESC
          )
          SELECT
            ${stat}  as "group",
            COUNT(*) as "visitors"
          FROM user_distinct_stat
          GROUP BY ${stat}
          ORDER BY visitors DESC`;

    const resp = await this.query(query);

    return resp.data as {
      group: string;
      visitors: number;
    }[];
  }

  //
  async rollupEvents(eventsBucketName: string, site: string, date: string) {
    const tempTableName = `rollup_temp_${uuidv4().replaceAll('-', '_')}`;
    const queryCTAS = `
      CREATE TABLE ${tempTableName}
      WITH (
        format = 'PARQUET',
        partitioned_by=array['site','tracked_at_date'],
        external_location = 's3://${eventsBucketName}/events/'
      ) AS
      WITH cte AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id) rn
        FROM events
        WHERE site = '${site}' AND tracked_at_date = '${date}'
      )
      SELECT
        user_id,
        session_id,
        event_id,
        category,
        event,
        tracked_at,
        data,
        country_iso,
        country_name,
        city_name,
        device_type,
        is_bot,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        querystring,
        referrer,
        site,
        tracked_at_date
      FROM cte as a
      WHERE rn = 1 `;

    await this.query(queryCTAS);
    await this.query(`DROP TABLE ${tempTableName}`);
    return true;
  }
}
