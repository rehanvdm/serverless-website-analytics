import { z } from 'zod';

export const EventFilterSchema = z.object({
  category: z.string().optional().nullable(),
  event: z.string().optional(),

  referrer: z.string().optional().nullable(),
  country_name: z.string().optional(),
  device_type: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
});

export type EventFilter = z.infer<typeof EventFilterSchema>;
