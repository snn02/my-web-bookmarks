export const API_BASE_PATH = '/api/v1';

export type ApiErrorCode =
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'ai_not_configured'
  | 'content_unavailable'
  | 'sync_already_running'
  | 'upstream_error';

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface HealthResponse {
  status: 'ok';
}

export function healthResponse(): HealthResponse {
  return { status: 'ok' };
}

export function createApiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  };
}
