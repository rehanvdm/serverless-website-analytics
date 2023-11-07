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
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';

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
        event_id: uuidv4(), // Different from how page does it, here we don't want the caller to specify and overwrite. Only used for dedupe during rollup
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
    });
}

const V1EventTrackBeaconGifInputSchema = SchemaEvent.pick({
  site: true,
  user_id: true,
  session_id: true,
  category: true,
  event: true,
  data: true,
  utm_source: true,
  utm_medium: true,
  utm_campaign: true,
  utm_term: true,
  utm_content: true,
}).partial({
  user_id: true,
  session_id: true,
  category: true,
  data: true,
  utm_source: true,
  utm_medium: true,
  utm_campaign: true,
  utm_term: true,
  utm_content: true,
});
export type V1EventTrackBeaconGifInput = z.infer<typeof V1EventTrackBeaconGifInputSchema>;
export async function v1EventTrackBeaconGif(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResult> {
  const preParsedQuery: Record<string, any> = event.queryStringParameters || {};
  if (preParsedQuery.data) preParsedQuery.data = Number(preParsedQuery.data);

  const query = V1EventTrackBeaconGifInputSchema.safeParse(preParsedQuery);
  if (!query.success) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ errors: query.error.issues }),
    };
  }
  const input = query.data;

  const firehoseClient = getFirehoseClient();
  const { countryIso, countryName, cityName, deviceType, isBot } = await getInfoFromIpAndUa(
    event.headers['x-forwarded-for'] || '',
    event.requestContext.http.userAgent
  );
  const referrer = undefined;
  let data = input.data;
  if (!data) {
    data = 1;
  }

  const trackedAt = DateUtils.now();
  const trackedAtDate = DateUtils.stringifyFormat(trackedAt, 'yyyy-MM-dd');
  const eventRecord: Event = {
    site: input.site,
    tracked_at_date: trackedAtDate,
    user_id: input.user_id || uuidv4(),
    session_id: input.session_id || uuidv4(),
    event_id: uuidv4(),
    category: input.category,
    event: input.event,
    data,
    tracked_at: DateUtils.stringifyIso(trackedAt),
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
    referrer,
  };

  logger.info('event beacon', eventRecord);
  const resp = await firehoseClient.send(
    new PutRecordCommand({
      DeliveryStreamName: LambdaEnvironment.FIREHOSE_EVENTS_NAME,
      Record: {
        Data: Buffer.from(JSON.stringify(eventRecord)),
      },
    })
  );

  return {
    isBase64Encoded: true,
    statusCode: 200,
    headers: {
      'Content-Type': 'image/gif',
    },
    body: 'R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAI=',
  };
}
