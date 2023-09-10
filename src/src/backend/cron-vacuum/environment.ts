import { z } from 'zod';

export class LambdaEnvironment {
  static AWS_REGION: string;
  static ENVIRONMENT: string;
  static VERSION: string;
  static TIMEOUT: number;
  static LOG_LEVEL: string;
  static TRACE_ID?: string;

  static ANALYTICS_BUCKET: string;
  static ANALYTICS_BUCKET_ATHENA_PATH: string; /* Constructed from ANALYTICS_BUCKET on initialization */
  static ANALYTICS_GLUE_DB_NAME: string;
  static SITES: string[];

  static init() {
    const schema = z.object({
      AWS_REGION: z.string(),
      ENVIRONMENT: z.string(),
      VERSION: z.string(),
      TIMEOUT: z.string().transform((v) => Number(v)),
      LOG_LEVEL: z.string(),

      ANALYTICS_BUCKET: z.string(),
      ANALYTICS_GLUE_DB_NAME: z.string(),
      SITES: z.string().transform((v) => JSON.parse(v) as string[]),
    });
    const parsed = schema.safeParse(process.env);

    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error('Environment Variable Parse Error');
    }

    for (const key in parsed.data) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore we know this is safe
      this[key] = parsed.data[key];
    }

    this.ANALYTICS_BUCKET_ATHENA_PATH = 's3://' + this.ANALYTICS_BUCKET + '/athena-results';
  }
}
