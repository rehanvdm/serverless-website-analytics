import { z } from 'zod';

export class LambdaEnvironment {
  static AWS_REGION: string;
  static ENVIRONMENT: string;
  static VERSION: string;
  static TIMEOUT: number;
  static LOG_LEVEL: string;
  static TRACE_ID?: string;

  static TIMESTREAM_ANALYTICS_BUCKET: string;
  static TIMESTREAM_DATABASE_NAME: string;
  static TIMESTREAM_TABLE_NAME: string;

  static init() {
    const schema = z.object({
      AWS_REGION: z.string(),
      ENVIRONMENT: z.string(),
      VERSION: z.string(),
      TIMEOUT: z.string().transform((v) => Number(v)),
      LOG_LEVEL: z.string(),

      TIMESTREAM_ANALYTICS_BUCKET: z.string(),
      TIMESTREAM_DATABASE_NAME: z.string(),
      TIMESTREAM_TABLE_NAME: z.string(),
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
  }
}
