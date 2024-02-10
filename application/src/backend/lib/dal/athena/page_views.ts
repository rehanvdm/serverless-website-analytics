import { DateUtils } from '@backend/lib/utils/date_utils';
import { AthenaBase } from '@backend/lib/utils/athena_base';
import { getAthenaClient, getS3Client } from '@backend/lib/utils/lazy_aws';
import { Page } from '@backend/lib/models/page';
import { PageFilter } from '@backend/lib/models/page_filter';
import { v4 as uuidv4 } from 'uuid';

export class AthenaPageViews extends AthenaBase {
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
  cteFilteredDataQuery(columns: string[], fromDate: Date, toDate: Date, sites: string[], filter?: PageFilter) {
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
      .map((dt) => `page_opened_at_date = '${DateUtils.stringifyFormat(dt, 'yyyy-MM-dd')}'`)
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
              SELECT ${columns.join(', ')}, page_opened_at,
                     ROW_NUMBER() OVER (PARTITION BY page_id ORDER BY time_on_page DESC) rn
              FROM page_views
              WHERE (${cteSiteWhereClauseSites}) AND (${cteDateWhereClauseDates}) ${cteWhereAndClauseExtra}
          ),
          cte_data_filtered AS (
              SELECT *
              FROM cte_data
              WHERE rn = 1 AND page_opened_at BETWEEN parse_datetime('${exactTimeFrom}','yyyy-MM-dd HH:mm:ss.SSS')
                    AND parse_datetime('${exactTimeTo}','yyyy-MM-dd HH:mm:ss.SSS')
          )`;
  }

  async totalsForPeriod(fromDate: Date, toDate: Date, sites: string[], filter?: PageFilter) {
    const query = `
          WITH ${this.cteFilteredDataQuery(
            ['user_id', 'session_id', 'page_id', 'time_on_page'],
            fromDate,
            toDate,
            sites,
            filter
          )},
          totals_basic AS (
              SELECT
                  COUNT(DISTINCT a.user_id) as "users",
                  COUNT(a.session_id) as "sessions",
                  COUNT(DISTINCT a.session_id) as "unique_sessions",
                  COUNT(a.page_id) as "views",
                  ROUND(AVG(a.time_on_page),2) as "avg_time_on_page",
                  MAX(page_opened_at) as "latest_page_opened_at"
              FROM cte_data_filtered as a
          ),
          cte_data_by_session AS (
              SELECT
                  user_id,
                  session_id,
                  COUNT(*) as "page_count",
                  MAX(time_on_page) as "time_on_page"
              FROM cte_data_filtered
              GROUP BY user_id, session_id
          ),
          totals_bounce_rate AS (
              SELECT ROUND( (CAST( COUNT(CASE WHEN page_count = 1 AND time_on_page < 15 THEN session_id END) AS DOUBLE)
                                 / COUNT(DISTINCT session_id)) * 100, 2) as "bounce_rate"
              FROM cte_data_by_session
          )
          SELECT *
          FROM totals_basic, totals_bounce_rate`;

    const res = await this.query(query);
    return res.data[0] as {
      users: number;
      sessions: number;
      unique_sessions: number;
      views: number;
      avg_time_on_page?: number;
      latest_page_opened_at?: Date;
      bounce_rate?: number;
    };
  }

  async pageViewsForPeriod(
    fromDate: Date,
    toDate: Date,
    sites: string[],
    queryExecutionId?: string,
    nextToken?: string,
    filter?: PageFilter,
    limit = 1000
  ) {
    if (queryExecutionId && !nextToken) {
      throw new Error('Cannot paginate results without a nextToken');
    }

    const query = `
          WITH ${this.cteFilteredDataQuery(['site', 'page_url', 'time_on_page'], fromDate, toDate, sites, filter)},
          cte_data_by_page_view AS (
           SELECT
             site,
             page_url,
             COUNT(*) as "views",
             ROUND(AVG(time_on_page),2) as "avg_time_on_page"
           FROM cte_data_filtered
           GROUP BY site, page_url
          )
          SELECT *
          FROM cte_data_by_page_view
          ORDER BY views DESC, page_url ASC`;

    const resp = await this.query(query, limit, queryExecutionId, nextToken);
    return {
      nextToken: resp.nextToken,
      queryExecutionId: resp.queryExecutionId,
      data: resp.data as {
        site: string;
        page_url: string;
        views: number;
        avg_time_on_page: number;
      }[],
    };
  }

  async chartViewsForPeriod(
    fromDate: Date,
    toDate: Date,
    sites: string[],
    period: 'hour' | 'day',
    timeZone: string,
    filter?: PageFilter
  ) {
    const query = `
          WITH ${this.cteFilteredDataQuery(['site', 'user_id', 'page_id'], fromDate, toDate, sites, filter)}
          SELECT
              site,
              CAST(DATE_TRUNC('${period}', page_opened_at AT TIME ZONE '${timeZone}') AS TIMESTAMP) as "date_key",
              COUNT(DISTINCT user_id) as "visitors",
              COUNT(*) as "views"
          FROM cte_data_filtered
          GROUP BY 1, 2
          ORDER BY 1, 2`;

    const resp = await this.query(query);

    return resp.data as {
      site: string;
      date_key: Date;
      visitors: number;
      views: number;
    }[];
  }

  // async chartLocationsForPeriod(fromDate: Date, toDate: Date, sites: string[])
  // {
  //
  //
  //   const query = `
  //         WITH ${this.cteFilteredDataQuery(["user_id", "country_name"], fromDate, toDate, sites)},
  //         user_distinct_country AS (
  //           SELECT
  //             user_id, country_name,
  //             COUNT(*) as "visitors"
  //           FROM cte_data_filtered
  //           GROUP BY 1, 2
  //           ORDER BY 3 DESC
  //         )
  //         SELECT
  //           country_name,
  //           COUNT(*) as "visitors"
  //         FROM user_distinct_country
  //         GROUP BY country_name
  //         ORDER BY visitors DESC`;
  //
  //   const resp = await this.query(query);
  //
  //   return resp.data as {
  //     country_name: string,
  //     visitors: number
  //   }[];
  // }

  async referrersForPeriod(fromDate: Date, toDate: Date, sites: string[], filter?: PageFilter) {
    const query = `
          WITH ${this.cteFilteredDataQuery(['referrer'], fromDate, toDate, sites, filter)}
          SELECT
            COALESCE(referrer, 'No Referrer') AS referrer,
            COUNT(*) as "views"
          FROM cte_data_filtered
          GROUP BY referrer
          ORDER BY views DESC`;

    const resp = await this.query(query);

    return resp.data as {
      referrer: string;
      views: number;
    }[];
  }

  async usersGroupedByStatForPeriod(
    fromDate: Date,
    toDate: Date,
    sites: string[],
    stat: keyof Page,
    filter?: PageFilter
  ) {
    // Alternative query for getting country names grouped by visitors
    // TODO: Can be optimized to this. Scans half the amount of data then, will rework all of them later
    // SELECT
    //     country_name,
    //     COUNT(DISTINCT user_id) AS visitors
    // FROM (
    //     SELECT
    //         user_id,
    //         country_name,
    //         page_id,
    //         time_on_page,
    //         page_opened_at
    //     FROM (
    //         SELECT
    //             user_id,
    //             country_name,
    //             page_id,
    //             time_on_page,
    //             page_opened_at,
    //             ROW_NUMBER() OVER (PARTITION BY page_id ORDER BY time_on_page DESC) AS rn
    //         FROM page_views
    //         WHERE
    //             site = 'tests'
    //             AND year = 2023
    //             AND month IN (2, 3, 4)
    //             AND page_opened_at BETWEEN TIMESTAMP '2023-03-31 22:00:00' AND TIMESTAMP '2023-04-22 21:59:59'
    //     ) t
    //     WHERE rn = 1
    // ) t2
    // GROUP BY
    //     country_name
    // ORDER BY
    //     visitors DESC

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

  async rollupPageViews(pageViewBucketName: string, site: string, date: string) {
    const tempTableName = `rollup_temp_${uuidv4().replaceAll('-', '_')}`;
    const queryCTAS = `
      CREATE TABLE ${tempTableName}
      WITH (
        format = 'PARQUET',
        partitioned_by=array['site','page_opened_at_date'],
        external_location = 's3://${pageViewBucketName}/page_views/'
      ) AS
      WITH cte AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY page_id ORDER BY time_on_page DESC) rn
        FROM page_views
        WHERE site = '${site}' AND page_opened_at_date = '${date}'
      )
      SELECT
        user_id,
        session_id,
        page_id,
        page_url,
        page_opened_at,
        time_on_page,
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
        page_opened_at_date
      FROM cte as a
      WHERE rn = 1 `;

    await this.query(queryCTAS);
    await this.query(`DROP TABLE ${tempTableName}`);
    return true;
  }

  async totalViewsPerHour(fromDate: Date, toDate: Date, sites: string[]) {
    const toDateWithLatestHour = new Date(toDate);
    toDateWithLatestHour.setMinutes(59, 59, 999);
    const query = `
          WITH ${this.cteFilteredDataQuery(['site', 'user_id', 'page_id'], fromDate, toDateWithLatestHour, sites)}
          SELECT
              CAST(DATE_TRUNC('hour', page_opened_at) AS TIMESTAMP) as "date_key",
              COUNT(*) as "views"
          FROM cte_data_filtered
          GROUP BY 1
          ORDER BY 1`;

    const resp = await this.query(query);

    return resp.data as {
      date_key: Date;
      views: number;
    }[];
  }
}
