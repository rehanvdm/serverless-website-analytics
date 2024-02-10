import { z } from 'zod';

export const SchemaPage = z.object({
  site: z.string(),
  user_id: z.string(),
  session_id: z.string(),
  page_id: z.string(),
  page_url: z.string(),
  page_opened_at: z.string(),
  page_opened_at_date: z.string().optional(),
  time_on_page: z.number(),
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
export type Page = z.infer<typeof SchemaPage>;
