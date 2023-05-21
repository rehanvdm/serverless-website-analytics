import { z } from 'zod';
import { SchemaPage, Page } from '@backend/lib/models/page';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { LambdaEnvironment } from '@backend/api-ingest/environment';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { getCleanedUpReferrer, getInfoFromIpAndUa } from '@backend/api-ingest/shared';
import { getFirehoseClient } from '@backend/lib/utils/lazy_aws';
import { TrpcInstance } from '@backend/api-ingest/server';
import { TRPCError } from '@trpc/server';
import { PutRecordCommand } from '@aws-sdk/client-firehose';

const logger = new LambdaLog();

const V1PageViewInputSchema = SchemaPage.pick({
  site: true,
  user_id: true,
  session_id: true,
  page_id: true,
  page_url: true,
  page_opened_at: true,
  time_on_page: true,
  utm_source: true,
  utm_medium: true,
  utm_campaign: true,
  utm_term: true,
  utm_content: true,
  querystring: true,
  referrer: true
});
export type V1PageViewInput = z.infer<typeof V1PageViewInputSchema>;

export function pageView (trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .meta({ openapi: { method: 'POST', path: '/v1/page/view' } })
    .input(V1PageViewInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      if (!LambdaEnvironment.SITES.includes(input.site)) { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Site does not exist' }); }

      const firehoseClient = getFirehoseClient();

      const { countryIso, countryName, cityName, deviceType, isBot } = await getInfoFromIpAndUa(ctx.request.ip, ctx.request.ua);
      const referrer = getCleanedUpReferrer(input.site, input.referrer);
      const pageOpenedAt = DateUtils.parseIso(input.page_opened_at);
      const data: Page = {
        site: input.site,
        year: pageOpenedAt.getFullYear(),
        month: (pageOpenedAt.getMonth() + 1),

        user_id: input.user_id,
        session_id: input.session_id,
        page_id: input.page_id,
        page_url: input.page_url,
        page_opened_at: input.page_opened_at,
        time_on_page: input.time_on_page,
        country_iso: countryIso,
        country_name: countryName,
        city_name: cityName,
        device_type: deviceType,
        is_bot: !!isBot,
        utm_source: input.utm_source,
        utm_medium: input.utm_medium,
        utm_campaign: input.utm_campaign,
        utm_term: input.utm_term,
        utm_content: input.utm_content,
        querystring: input.querystring,
        referrer
      };

      logger.info('data', data);

      const resp = await firehoseClient.send(new PutRecordCommand({
        DeliveryStreamName: 'swa-prod-analytic-page-views-firehose',
        Record: {
          Data: Buffer.from(JSON.stringify(data))
        }
      }));
      console.log(resp.RecordId);
    })
}
