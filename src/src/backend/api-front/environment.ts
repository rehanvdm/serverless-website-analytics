import {z} from "zod";

export class LambdaEnvironment
{
  static AWS_REGION: string;
  static ENVIRONMENT: string;
  static VERSION : string;
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

  static init()
  {
    const schema = z.object({
      AWS_REGION: z.string(),
      ENVIRONMENT: z.string(),
      VERSION: z.string(),
      TIMEOUT: z.string(),
      LOG_LEVEL: z.string(),
      ENRICH_RETURNED_ERRORS: z.string(),

      ANALYTICS_BUCKET: z.string(),
      ANALYTICS_GLUE_DB_NAME: z.string(),
      SITES: z.string(),

      COGNITO_USER_POOL_ID: z.string().optional(),
      COGNITO_CLIENT_ID: z.string().optional(),
      COGNITO_HOSTED_UI_URL: z.string().optional(),
    });

    const parsed = schema.safeParse(process.env);
    if(!parsed.success)
    {
      console.error(parsed.error);
      throw new Error("Environment Variable Parse Error");
    }

    for(let key in parsed.data)
    {
      //@ts-ignore we know this is safe
      this[key] = process.env[key];
    }

    this.TIMEOUT = Number(this.TIMEOUT);
    this.ANALYTICS_BUCKET_ATHENA_PATH = "s3://"+this.ANALYTICS_BUCKET+"/athena-results";
    this.ENRICH_RETURNED_ERRORS = Boolean(this.ENRICH_RETURNED_ERRORS);
    this.SITES = JSON.parse(process.env.SITES!) as string[];
  }
}
