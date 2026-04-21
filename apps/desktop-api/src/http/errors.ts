import { createApiError, type ApiErrorCode } from '@my-web-bookmarks/shared';
import type { Response } from 'express';

export function sendApiError(
  response: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): Response {
  return response.status(status).json(createApiError(code, message, details));
}
