/**
 * status_code: Only for API Lambda - 200
 * status_description: Success || Validation Error || Handled Error
 * origin: <project/lambda>
 * origin_path: Arguments/flow of that lambda, if API specify as: GET /v1/session
 * meta: Anything that is a string
 */
export type AuditLog = {
  audit_log_id: string;
  trace_id: string;

  user_id?: number;

  success: boolean;
  status_description?: string;
  status_code?: number;

  origin: string;
  origin_path?: string;
  origin_method?: string;
  type: 'api' | 'cron';
  meta: string;
  created_at: string;
  run_time: number;

  environment: string;
  app_version: string;
};
