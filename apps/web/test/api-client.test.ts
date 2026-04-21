import { describe, expect, it, vi } from 'vitest';
import {
  attachTagToItem,
  createTag,
  fetchItems,
  fetchSettings,
  fetchTags,
  generateSummary,
  removeTagFromItem,
  saveChromeProfilePath,
  saveOpenRouterSettings,
  suggestTags,
  startBookmarkSync,
  updateItemStatus,
  updateSummary
} from '../src/api/client';

describe('api client', () => {
  it('maps item list filters to the V1 query string', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], total: 0, limit: 50, offset: 0 })
      })
    );

    await fetchItems({ q: 'vue', status: 'new', tagIds: ['tag_1'], sort: 'updatedAt:desc' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/items?q=vue&status=new&tagIds=tag_1&sort=updatedAt%3Adesc'
    );
  });

  it('calls write endpoints with JSON bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true })
      })
    );

    await updateItemStatus('itm_1', 'read');
    await createTag('frontend');
    await attachTagToItem('itm_1', 'tag_1');
    await removeTagFromItem('itm_1', 'tag_1');
    await updateSummary('itm_1', 'Edited summary');
    await saveChromeProfilePath('C:\\Chrome\\Default');
    await saveOpenRouterSettings({ apiKey: 'or-v1-secret', model: 'openai/gpt-5-mini' });
    await generateSummary('itm_1');
    await suggestTags('itm_1');
    await startBookmarkSync();
    await fetchSettings();
    await fetchTags();

    expect(fetch).toHaveBeenCalledWith('/api/v1/items/itm_1', {
      body: JSON.stringify({ status: 'read' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH'
    });
    expect(fetch).toHaveBeenCalledWith('/api/v1/tags', {
      body: JSON.stringify({ name: 'frontend' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });
    expect(fetch).toHaveBeenCalledWith('/api/v1/items/itm_1/tags/tag_1', { method: 'DELETE' });
    expect(fetch).toHaveBeenCalledWith('/api/v1/settings', {
      body: JSON.stringify({ chromeProfilePath: 'C:\\Chrome\\Default' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH'
    });
    expect(fetch).toHaveBeenCalledWith('/api/v1/settings', {
      body: JSON.stringify({
        openRouter: {
          apiKey: 'or-v1-secret',
          model: 'openai/gpt-5-mini'
        }
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH'
    });
    expect(fetch).toHaveBeenCalledWith('/api/v1/items/itm_1/summary', {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });
    expect(fetch).toHaveBeenCalledWith('/api/v1/items/itm_1/tag-suggestions', {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });
    expect(fetch).toHaveBeenCalledWith('/api/v1/sync/bookmarks', {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST'
    });
  });

  it('turns API error payloads into user-readable errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () =>
          JSON.stringify({
            error: {
              code: 'upstream_error',
              message: 'OpenRouter request failed.'
            }
          })
      })
    );

    await expect(suggestTags('itm_1')).rejects.toThrow(
      'OpenRouter request failed. Check API key, model name, network access, or provider availability.'
    );
  });
});
