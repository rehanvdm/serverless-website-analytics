import { z } from 'zod';
import { SchemaEvent, Event } from '@backend/lib/models/event';
import { DateUtils } from '@backend/lib/utils/date_utils';
import { LambdaEnvironment } from '@backend/api-ingest/environment';
import { LambdaLog } from '@backend/lib/utils/lambda_logger';
import { getCleanedUpReferrer, getInfoFromIpAndUa } from '@backend/api-ingest/shared';
import { getFirehoseClient } from '@backend/lib/utils/lazy_aws';
import { TrpcInstance } from '@backend/api-ingest/server';
import { TRPCError } from '@trpc/server';
import { PutRecordCommand } from '@aws-sdk/client-firehose';

const logger = new LambdaLog();

const V1PageEventInputSchema = SchemaEvent.pick({
  site: true,
  user_id: true,
  session_id: true,
  category: true,
  event: true,
  tracked_at: true,
  data: true,
  utm_source: true,
  utm_medium: true,
  utm_campaign: true,
  utm_term: true,
  utm_content: true,
  querystring: true,
  referrer: true,
}).partial({
  category: true,
  data: true,
});
export type V1PageEventInput = z.infer<typeof V1PageEventInputSchema>;

export function eventTrack(trpcInstance: TrpcInstance) {
  return trpcInstance.procedure
    .meta({ openapi: { method: 'POST', path: '/v1/event/track' } })
    .input(V1PageEventInputSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      if (!LambdaEnvironment.SITES.includes(input.site)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Site does not exist' });
      }

      // TODO: Also whitelist the events that are allowed ?

      const firehoseClient = getFirehoseClient();

      const { countryIso, countryName, cityName, deviceType, isBot } = await getInfoFromIpAndUa(
        ctx.request.ip,
        ctx.request.ua
      );
      const referrer = getCleanedUpReferrer(input.site, input.referrer);
      let data = input.data;
      if (!data) {
        data = 1;
      }

      const trackedAt = DateUtils.parseIso(input.tracked_at);
      const trackedAtDate = DateUtils.stringifyFormat(trackedAt, 'yyyy-MM-dd');
      const event: Event = {
        site: input.site,
        tracked_at_date: trackedAtDate,
        user_id: input.user_id,
        session_id: input.session_id,
        category: input.category,
        event: input.event,
        data,
        tracked_at: input.tracked_at,
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
        referrer,
      };

      logger.info('event', event);

      const resp = await firehoseClient.send(
        new PutRecordCommand({
          DeliveryStreamName: LambdaEnvironment.FIREHOSE_EVENTS_NAME,
          Record: {
            Data: Buffer.from(JSON.stringify(event)),
          },
        })
      );
      console.log(resp.RecordId);
    });
}
