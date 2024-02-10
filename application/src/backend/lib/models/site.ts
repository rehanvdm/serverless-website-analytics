import { z } from 'zod';

// export const SchemaSite = z.object({
//     // id: z.string(),
//     name: z.string(),
//     // restrict_to_senders: z.array(z.string()).nullish(),
//     // rate_limit: z.number(),
// });

export const SchemaSite = z.string();
export type Site = z.infer<typeof SchemaSite>;
