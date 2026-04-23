import { describe, expect, it } from 'vitest';
import {
  API_BASE_PATH,
  createApiError,
  getDefaultModelId,
  getSortedModelProfiles,
  healthResponse
} from '../src';

describe('shared API contracts', () => {
  it('defines the V1 API base path', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
  });

  it('creates a health response DTO', () => {
    expect(healthResponse()).toEqual({ status: 'ok' });
  });

  it('creates the standard API error shape', () => {
    expect(
      createApiError('validation_error', 'Status value is not supported.', {
        field: 'status'
      })
    ).toEqual({
      error: {
        code: 'validation_error',
        message: 'Status value is not supported.',
        details: {
          field: 'status'
        }
      }
    });
  });

  it('provides deterministic OpenRouter model defaults and sorted lists', () => {
    const models = getSortedModelProfiles();

    expect(models[0].id).toBe(getDefaultModelId());
    expect(models[0].rating).toBeGreaterThanOrEqual(models[1].rating);
  });
});
