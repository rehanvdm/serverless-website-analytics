import { z } from 'zod';

export class LambdaEnvironment {
  static AWS_REGION: string;
  static ENVIRONMENT: string;
  static VERSION : string;
  static TIMEOUT: number;
  static LOG_LEVEL: string;
  static TRACE_ID?: string;
  static ENRICH_RETURNED_ERRORS: boolean;

  static ANALYTICS_BUCKET: string;
  static GEOLITE2_CITY_PATH: string;

  static SITES: string[];
  static ALLOWED_ORIGINS: string;

  static init () {
    const schema = z.object({
      AWS_REGION: z.string(),
      ENVIRONMENT: z.string(),
      VERSION: z.string(),
      TIMEOUT: z.string(),
      LOG_LEVEL: z.string(),
      ENRICH_RETURNED_ERRORS: z.string(),

      ANALYTICS_BUCKET: z.string(),
      GEOLITE2_CITY_PATH: z.string(),

      SITES: z.string(),
      ALLOWED_ORIGINS: z.string()
    });

    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      console.error(parsed.error);
      throw new Error('Environment Variable Parse Error');
    }

    for (const key in parsed.data) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore we know this is safe
      this[key] = process.env[key];
    }

    this.TIMEOUT = Number(this.TIMEOUT);
    this.ENRICH_RETURNED_ERRORS = Boolean(this.ENRICH_RETURNED_ERRORS);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.SITES = JSON.parse(process.env.SITES!) as string[];
  }
}
