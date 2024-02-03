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

  static EVALUATION_WINDOW: number;

  static ALERT_TOPIC_ARN: string;
  static ALERT_ON_ALARM: boolean;
  static ALERT_ON_OK: boolean;

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

      EVALUATION_WINDOW: z.string().transform((v) => Number(v)),

      ALERT_TOPIC_ARN: z.string(),
      ALERT_ON_ALARM: z.string().transform((v) => Boolean(v)),
      ALERT_ON_OK: z.string().transform((v) => Boolean(v)),
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
