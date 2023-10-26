import { z } from 'zod';

export const SchemaEvent = z.object({
  site: z.string(),
  user_id: z.string(),
  session_id: z.string(),
  event_id: z.string(),
  category: z.string().optional(),
  event: z.string(),
  tracked_at: z.string(),
  tracked_at_date: z.string().optional(),
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
