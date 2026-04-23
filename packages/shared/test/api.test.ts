import { describe, expect, it } from 'vitest';
import {
  API_BASE_PATH,
  createApiError,
  getDefaultSummaryModelId,
  getDefaultTagModelId,
  getSortedSummaryModelProfiles,
  getSortedTagModelProfiles,
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
    const summary = getSortedSummaryModelProfiles();
    const tags = getSortedTagModelProfiles();

    expect(summary[0].id).toBe(getDefaultSummaryModelId());
    expect(tags[0].id).toBe(getDefaultTagModelId());
    expect(summary[0].summaryRating).toBeGreaterThanOrEqual(summary[1].summaryRating);
    expect(tags[0].tagsRating).toBeGreaterThanOrEqual(tags[1].tagsRating);
  });
});
