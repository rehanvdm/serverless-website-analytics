import { z } from 'zod';

// export const SchemaSite = z.object({
//     // id: z.string(),
//     name: z.string(),
//     // restrict_to_senders: z.array(z.string()).nullish(),
//     // rate_limit: z.number(),
// });

export const SchemaSite = z.string();
export type Site = z.infer<typeof SchemaSite>;

export const SchemaSitePartition = z.object({
  site: SchemaSite,
  year: z.number(),
  month: z.number(),
});
export const SchemaSitePartitions = z.array(SchemaSitePartition);
export type SitePartition = z.infer<typeof SchemaSitePartition>;
export type SitePartitions = z.infer<typeof SchemaSitePartitions>;
