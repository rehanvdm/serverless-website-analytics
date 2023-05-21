import { z } from 'zod';

export const SchemaEvent = z.object({
  site: z.string(),
  year: z.number(),
  month: z.number(),
  user_id: z.string(),
  session_id: z.string(),
  event: z.string(),
  tracked_at: z.string(),
  data: z.number(),
  country_iso: z.string().optional(),
  country_name: z.string().optional(),
  city_name: z.string().optional(),
  device_type: z.string().optional(),
  is_bot: z.boolean(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  querystring: z.string().optional(),
  referrer: z.string().optional(),
});
export type Event = z.infer<typeof SchemaEvent>;
