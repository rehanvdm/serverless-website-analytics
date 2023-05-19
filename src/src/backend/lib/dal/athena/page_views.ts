import {DateUtils} from "@backend/lib/utils/date_utils";
import {AthenaBase} from "@backend/lib/utils/athena_base";
import {getAthenaClient, getS3Client} from "@backend/lib/utils/lazy_aws";
import {LambdaEnvironment} from "@backend/api-front/environment";
import {Page} from "@backend/lib/models/page";

export class AthenaPageViews extends AthenaBase
{
  constructor()
  {
    const athenaClient = getAthenaClient();
    const s3Client = getS3Client();
    super(athenaClient, s3Client, LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
      LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH, { bigIntAsNumber: true });
  }

  /**
   * Returns the first CTEs that is repeated across all queries. Select from `cte_data_filtered` to get the data.
   * @param columns
   * @param fromDate
   * @param toDate
   * @param sites
   */
  cteFilteredDataQuery(columns: string[], fromDate: Date, toDate: Date, sites: string[])
  {
    const months = DateUtils.getMonthsBetweenDates(fromDate, toDate);
    let cteWhereClauseDates: string = months
      // +1 to the month because months are 0-indexed in JS but Athena/Firehose is 1-indexed
      .map(month => `(year = ${month.getFullYear()} AND month = ${month.getMonth()+1})`)
      .join(" OR ");
    let cteWhereClauseSites = sites
      .map(site => `site = '${site}'`)
      .join(" OR ");

    let cteWhereClause = `(${cteWhereClauseSites}) AND (${cteWhereClauseDates})`;
    let exactTimeFrom = DateUtils.stringifyFormat(fromDate, 'yyyy-MM-dd HH:mm:ss.SSS');
    let exactTimeTo = DateUtils.stringifyFormat(toDate, 'yyyy-MM-dd HH:mm:ss.SSS');

    return `
          cte_data AS (
              SELECT ${columns.join(', ')}, page_opened_at,
                     ROW_NUMBER() OVER (PARTITION BY page_id ORDER BY time_on_page DESC) rn
              FROM page_views
              WHERE ${cteWhereClause} AND page_opened_at BETWEEN parse_datetime('${exactTimeFrom}','yyyy-MM-dd HH:mm:ss.SSS')
                    AND parse_datetime('${exactTimeTo}','yyyy-MM-dd HH:mm:ss.SSS')
          ),
          cte_data_filtered AS (
              SELECT *
              FROM cte_data
              WHERE rn = 1
          )`;
  }

  async totalsForPeriod(fromDate: Date, toDate: Date, sites: string[])
  {
    const query = `
          WITH ${this.cteFilteredDataQuery(["user_id", "session_id", "page_id", "time_on_page"], fromDate, toDate, sites)},
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
      users: number,
      sessions: number,
      unique_sessions: number,
      views: number,
      avg_time_on_page?: number,
      latest_page_opened_at?: Date,
      bounce_rate?: number,
    };
  }

  async pageViewsForPeriod(fromDate: Date, toDate: Date, sites: string[],
                                    queryExecutionId?: string, nextToken?: string, limit: number = 1000)
  {
    if(queryExecutionId && !nextToken)
      throw new Error("Cannot paginate results without a nextToken");

    const query = `
          WITH ${this.cteFilteredDataQuery(["site", "page_url", "time_on_page"], fromDate, toDate, sites)},
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
        site: string,
        page_url: string,
        views: number,
        avg_time_on_page: number
      }[]
    }
  }

  async chartViewsForPeriod(fromDate: Date, toDate: Date, sites: string[], period: "hour" | "day",
                                     timeZone: string)
  {
    const query = `
          WITH ${this.cteFilteredDataQuery(["site", "user_id", "page_id"], fromDate, toDate, sites)}
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
      site: string,
      date_key: Date,
      visitors: number,
      views: number
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

  async referrersForPeriod(fromDate: Date, toDate: Date, sites: string[])
  {
    const query = `
          WITH ${this.cteFilteredDataQuery(["referrer"], fromDate, toDate, sites)}
          SELECT
            COALESCE(referrer, 'No Referrer') AS referrer,
            COUNT(*) as "views"
          FROM cte_data_filtered
          GROUP BY referrer
          ORDER BY views DESC`;

    const resp = await this.query(query);

    return resp.data as {
      referrer: string,
      views: number
    }[];
  }

  async usersGroupedByStatForPeriod(fromDate: Date, toDate: Date, sites: string[], stat: keyof Page)
  {
    //Alternative query for getting country names grouped by visitors
    //TODO: Can be optimized to this. Scans half the amount of data then, will rework all of them later
    //SELECT
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
          WITH ${this.cteFilteredDataQuery(["user_id", stat], fromDate, toDate, sites)},
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
      group: string,
      visitors: number
    }[];
  }

}

