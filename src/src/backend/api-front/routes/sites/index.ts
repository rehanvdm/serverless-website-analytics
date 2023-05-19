import {z} from 'zod';
import {assertAuthentication, TrpcInstance} from "@backend/api-front/server";
import {SchemaSite, SchemaSitePartitions, SitePartitions} from "@backend/lib/models/site";
import {LambdaEnvironment} from "@backend/api-front/environment";
import {getAthenaClient, getS3Client} from "@backend/lib/utils/lazy_aws";
import {orderBy} from "lodash";
import {DateUtils} from "@backend/lib/utils/date_utils";
import {AthenaBase} from "@backend/lib/utils/athena_base";

export function sites(trpcInstance: TrpcInstance)
{
  return trpcInstance.procedure
    .input(z.void())
    .output(z.array(SchemaSite))
    .query(({input, ctx}) =>
    {
      assertAuthentication(ctx);

      return LambdaEnvironment.SITES;
    });
}

export function sitesGetPartitions(trpcInstance: TrpcInstance)
{
  return trpcInstance.procedure
    .input(z.undefined())
    .output(SchemaSitePartitions)
    .query(async ({input, ctx}) =>
    {
      assertAuthentication(ctx);

      const athenaClient = getAthenaClient();
      const s3Client = getS3Client();
      const athenaWrapper = new AthenaBase(athenaClient, s3Client, LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH);

      const res = await athenaWrapper.query(`SELECT * FROM "page_views$partitions" ORDER BY site, year, month`);
      return res.data as SitePartitions;
    });
}

async function getPartitions(athenaClient: AthenaBase)
{
  return (await athenaClient.query(
    `SELECT * FROM "page_views$partitions" ORDER BY site, year, month`
  )).data as SitePartitions;
}
export function sitesUpdatePartition(trpcInstance: TrpcInstance)
{
  return trpcInstance.procedure
    .input(z.object({forceRepair: z.boolean()}))
    .output(SchemaSitePartitions)
    .mutation(async({input, ctx}) =>
    {
      assertAuthentication(ctx);

      const athenaClient = getAthenaClient();
      const s3Client = getS3Client();
      const athenaWrapper = new AthenaBase(athenaClient, s3Client, LambdaEnvironment.ANALYTICS_GLUE_DB_NAME,
        LambdaEnvironment.ANALYTICS_BUCKET_ATHENA_PATH);

      let partitions = await getPartitions(athenaWrapper);
      if(!partitions.length || input.forceRepair)
      {
        /* Auto discover/repair all indexes aka partitions */
        await athenaWrapper.query(`MSCK REPAIR TABLE page_views`);
        partitions = await getPartitions(athenaWrapper);
      }

      if(input.forceRepair)
        return partitions;
      if(!partitions.length)
        return [];

      const earliestPartition = orderBy(partitions, ['year', 'month'], ['asc', 'asc'])[0];

      /* Get a list of date partitions between the first partition and now */
      const earliestPartitionDate = new Date(Date.UTC(earliestPartition.year, (earliestPartition.month-1)));
      const now = DateUtils.now();
      const months = DateUtils.getMonthsBetweenDates(earliestPartitionDate, now);

      let partitionsAdded = false;
      for(let site of LambdaEnvironment.SITES)
      {
        let partitionsToAdd = [];
        for (let month of months)
        {
          const hasPartition = partitions.find(row => row.site === site && row.year === month.getFullYear() && row.month === (month.getMonth() + 1));
          if (hasPartition)
            continue;

          partitionsToAdd.push(`PARTITION (site = '${site}', year = ${month.getFullYear()}, month = ${month.getMonth()+1} )`);
        }

        if(partitionsToAdd.length > 0)
        {
          partitionsAdded = true;
          // console.log(`ALTER TABLE page_views ADD IF NOT EXISTS ${partitionsToAdd.join("\n")};`)
          await athenaWrapper.query(`ALTER TABLE page_views ADD IF NOT EXISTS ${partitionsToAdd.join("\n")};` );
        }
      }

      if(partitionsAdded)
        partitions = await getPartitions(athenaWrapper);

      return partitions;
    });
}
