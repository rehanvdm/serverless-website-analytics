import { z } from 'zod';

export class LambdaEnvironment {
  static AWS_REGION: string;
  static ENVIRONMENT: string;
  static VERSION: string;
  static TIMEOUT: number;
  static LOG_LEVEL: string;
  static TRACE_ID?: string;
  static ENRICH_RETURNED_ERRORS: boolean;

  static ANALYTICS_BUCKET: string;
  static ANALYTICS_BUCKET_ATHENA_PATH: string; /* Constructed from ANALYTICS_BUCKET on initialization */
  static ANALYTICS_GLUE_DB_NAME: string;
  static SITES: string[];

  static COGNITO_USER_POOL_ID: string | undefined;
  static COGNITO_CLIENT_ID: string | undefined;
  static COGNITO_HOSTED_UI_URL: string | undefined;

  static TRACK_OWN_DOMAIN: boolean;
  static IS_DEMO_PAGE: boolean;

  static init() {
    const schema = z.object({
      AWS_REGION: z.string(),
      ENVIRONMENT: z.string(),
      VERSION: z.string(),
      TIMEOUT: z.string().transform((v) => Number(v)),
      LOG_LEVEL: z.string(),
      ENRICH_RETURNED_ERRORS: z.string().transform((v) => Boolean(v) && v !== 'false'),

      ANALYTICS_BUCKET: z.string(),
      ANALYTICS_GLUE_DB_NAME: z.string(),
      SITES: z.string().transform((v) => JSON.parse(v) as string[]),

      COGNITO_USER_POOL_ID: z.string().optional(),
      COGNITO_CLIENT_ID: z.string().optional(),
      COGNITO_HOSTED_UI_URL: z.string().optional(),

      TRACK_OWN_DOMAIN: z
        .string()
        .optional()
        .transform((v) => Boolean(v) && v !== 'false'),
      IS_DEMO_PAGE: z
        .string()
        .optional()
        .transform((v) => Boolean(v) && v !== 'false'),
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
