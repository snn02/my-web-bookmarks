import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { createInMemoryDatabase, initializeDatabase } from '../../src/db/database';
import { createItemRepository } from '../../src/domain/items/item-repository';
import { createSettingsRepository } from '../../src/domain/settings/settings-repository';
import { createSummaryRepository } from '../../src/domain/summaries/summary-repository';
import { createTagRepository } from '../../src/domain/tags/tag-repository';
import type { AppLogger } from '../../src/logging/app-logger';
import type { HostnameResolver } from '../../src/domain/ai/ai-service';

function createOpenRouterFetchMock(content: string, status = 200) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url !== 'https://openrouter.ai/api/v1/chat/completions') {
      return new Response(
        '<html><body><article><p>Default extracted content for tests.</p></article></body></html>',
        {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 200
        }
      );
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content
            }
          }
        ]
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status
      }
    );
  });
}

function createHybridFetchMock(options: {
  pageHtml?: string;
  pageStatus?: number;
  openRouterContent: string;
  openRouterStatus?: number;
}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === 'https://openrouter.ai/api/v1/chat/completions') {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: options.openRouterContent
              }
            }
          ]
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: options.openRouterStatus ?? 200
        }
      );
    }

    return new Response(options.pageHtml ?? '', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: options.pageStatus ?? 200
    });
  });
}

function createApiTestContext(
  openRouterFetch?: typeof fetch,
  resolveHostname: HostnameResolver = async () => ['93.184.216.34']
) {
  const db = createInMemoryDatabase();
  initializeDatabase(db);
  const logs: Array<{ event: string; metadata?: Record<string, unknown> }> = [];
  const logger: AppLogger = {
    error: (event, metadata) => logs.push({ event, metadata }),
    info: (event, metadata) => logs.push({ event, metadata }),
    warn: (event, metadata) => logs.push({ event, metadata })
  };

  return {
    app: createApp({ db, logger, openRouterFetch, resolveHostname }),
    db,
    items: createItemRepository(db),
    logs,
    settings: createSettingsRepository(db),
    summaries: createSummaryRepository(db),
    tags: createTagRepository(db)
  };
}

describe('items API', () => {
  it('lists items with filters and returns item detail', async () => {
    const { app, items, summaries, tags } = createApiTestContext();
    const frontend = tags.createTag('frontend');
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Vue Guide',
      url: 'https://example.com/vue'
    });
    items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Other article',
      url: 'https://example.com/other'
    });
    tags.attachTagToItem(item.id, frontend.id);
    summaries.upsertSummary(item.id, 'Useful Vue summary', 'openai/gpt-5-mini', 'openrouter', 'ai');

    const listResponse = await request(app)
      .get('/api/v1/items')
      .query({ q: 'vue', status: 'new', tagIds: frontend.id });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.items[0]).toMatchObject({
      id: item.id,
      normalizedUrl: 'https://example.com/vue',
      status: 'new',
      tags: [{ id: frontend.id, name: 'frontend' }],
      summary: {
        content: 'Useful Vue summary',
        updatedBy: 'ai'
      }
    });
    expect(listResponse.body.total).toBe(1);

    const detailResponse = await request(app).get(`/api/v1/items/${item.id}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.id).toBe(item.id);
  });

  it('updates item status and rejects unsupported item fields', async () => {
    const { app, items } = createApiTestContext();
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Status article',
      url: 'https://example.com/status'
    });

    const okResponse = await request(app).patch(`/api/v1/items/${item.id}`).send({ status: 'read' });
    expect(okResponse.status).toBe(200);
    expect(okResponse.body.status).toBe('read');

    const badResponse = await request(app)
      .patch(`/api/v1/items/${item.id}`)
      .send({ title: 'Nope' });
    expect(badResponse.status).toBe(400);
    expect(badResponse.body).toEqual({
      error: {
        code: 'validation_error',
        message: 'Only status can be updated through this endpoint.',
        details: { field: 'status' }
      }
    });
  });

  it('sorts item lists by supported V1 sort parameters', async () => {
    const { app, db, items } = createApiTestContext();
    const older = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Older article',
      url: 'https://example.com/older'
    });
    const newer = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Newer article',
      url: 'https://example.com/newer'
    });

    db.prepare(
      "UPDATE items SET imported_at = '2026-04-08T10:00:00Z', updated_at = '2026-04-08T10:00:00Z' WHERE id = ?"
    ).run(older.id);
    db.prepare(
      "UPDATE items SET imported_at = '2026-04-08T11:00:00Z', updated_at = '2026-04-08T12:00:00Z' WHERE id = ?"
    ).run(newer.id);

    const importedAsc = await request(app).get('/api/v1/items').query({ sort: 'importedAt:asc' });
    expect(importedAsc.body.items.map((item: { id: string }) => item.id)).toEqual([
      older.id,
      newer.id
    ]);

    const updatedDesc = await request(app).get('/api/v1/items').query({ sort: 'updatedAt:desc' });
    expect(updatedDesc.body.items.map((item: { id: string }) => item.id)).toEqual([
      newer.id,
      older.id
    ]);

    const invalidSort = await request(app).get('/api/v1/items').query({ sort: 'title:asc' });
    expect(invalidSort.status).toBe(400);
    expect(invalidSort.body.error).toMatchObject({
      code: 'validation_error',
      details: { field: 'sort' }
    });
  });

  it('returns not_found for missing item detail', async () => {
    const { app } = createApiTestContext();

    const response = await request(app).get('/api/v1/items/itm_missing');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });
});

describe('tags API', () => {
  it('creates, lists, renames, attaches, detaches, and deletes tags', async () => {
    const { app, items } = createApiTestContext();
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Tagged article',
      url: 'https://example.com/tagged'
    });

    const createResponse = await request(app).post('/api/v1/tags').send({ name: ' frontend ' });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe('frontend');

    const tagId = createResponse.body.id;
    const listResponse = await request(app).get('/api/v1/tags');
    expect(listResponse.body.tags).toEqual([expect.objectContaining({ id: tagId, name: 'frontend' })]);

    const renameResponse = await request(app).patch(`/api/v1/tags/${tagId}`).send({
      name: 'web-frontend'
    });
    expect(renameResponse.status).toBe(200);
    expect(renameResponse.body.name).toBe('web-frontend');

    const attachResponse = await request(app).post(`/api/v1/items/${item.id}/tags`).send({ tagId });
    expect(attachResponse.status).toBe(200);
    expect(attachResponse.body.tags).toEqual([{ id: tagId, name: 'web-frontend' }]);

    const detachResponse = await request(app).delete(`/api/v1/items/${item.id}/tags/${tagId}`);
    expect(detachResponse.status).toBe(204);

    const deleteResponse = await request(app).delete(`/api/v1/tags/${tagId}`);
    expect(deleteResponse.status).toBe(204);
  });

  it('returns conflict for duplicate tag names', async () => {
    const { app } = createApiTestContext();

    await request(app).post('/api/v1/tags').send({ name: 'frontend' });
    const response = await request(app).post('/api/v1/tags').send({ name: 'Frontend' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('conflict');
  });
});

describe('summaries API', () => {
  it('returns and manually updates the current summary', async () => {
    const { app, items, summaries } = createApiTestContext();
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Summary article',
      url: 'https://example.com/summary'
    });
    summaries.upsertSummary(item.id, 'Initial summary', 'openai/gpt-5-mini', 'openrouter', 'ai');

    const getResponse = await request(app).get(`/api/v1/items/${item.id}/summary`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toMatchObject({
      itemId: item.id,
      content: 'Initial summary',
      updatedBy: 'ai'
    });

    const patchResponse = await request(app)
      .patch(`/api/v1/items/${item.id}/summary`)
      .send({ content: 'Edited summary' });
    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body).toMatchObject({
      itemId: item.id,
      content: 'Edited summary',
      updatedBy: 'user'
    });
  });

  it('returns ai_not_configured for AI summary and tag suggestion placeholders', async () => {
    const { app, items } = createApiTestContext();
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'AI article',
      url: 'https://example.com/ai'
    });

    const summaryResponse = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});
    expect(summaryResponse.status).toBe(409);
    expect(summaryResponse.body.error.code).toBe('ai_not_configured');

    const tagSuggestionsResponse = await request(app)
      .post(`/api/v1/items/${item.id}/tag-suggestions`)
      .send({});
    expect(tagSuggestionsResponse.status).toBe(409);
    expect(tagSuggestionsResponse.body.error.code).toBe('ai_not_configured');
  });

  it('generates and stores an AI summary with configured OpenRouter settings', async () => {
    const openRouterFetch = createOpenRouterFetchMock('Generated summary from OpenRouter.');
    const { app, items, logs, settings, summaries } = createApiTestContext(openRouterFetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'AI summary article',
      url: 'https://example.com/ai-summary'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      itemId: item.id,
      content: 'Generated summary from OpenRouter.',
      updatedBy: 'ai'
    });
    expect(summaries.getSummary(item.id)?.content).toBe('Generated summary from OpenRouter.');
    expect(openRouterFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer or-v1-secret',
          'Content-Type': 'application/json'
        })
      })
    );
    const openRouterFetchCalls = openRouterFetch.mock.calls as unknown as [string, RequestInit][];
    const openRouterCall = openRouterFetchCalls.find(
      ([url]) => url === 'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(JSON.stringify(openRouterCall?.[1])).toContain('AI summary article');
    expect(JSON.stringify(openRouterCall?.[1])).toContain('Russian');
    expect(logs.some((entry) => entry.event === 'ai.summary.generated')).toBe(true);
  });

  it('replaces the current summary on AI regeneration', async () => {
    const openRouterFetch = createOpenRouterFetchMock('Replacement summary.');
    const { app, items, settings, summaries } = createApiTestContext(openRouterFetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Regeneration article',
      url: 'https://example.com/regenerate'
    });
    summaries.upsertSummary(item.id, 'Old summary.', 'openai/gpt-5-mini', 'openrouter', 'ai');

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(200);
    expect(response.body.content).toBe('Replacement summary.');
    expect(summaries.getSummary(item.id)?.content).toBe('Replacement summary.');
  });

  it('returns AI tag suggestions without persisting tags', async () => {
    const openRouterFetch = createOpenRouterFetchMock('["frontend","research"]');
    const { app, items, settings, tags } = createApiTestContext(openRouterFetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Taggable article',
      url: 'https://example.com/tags'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/tag-suggestions`).send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suggestions: [
        { name: 'frontend' },
        { name: 'research' }
      ]
    });
    expect(tags.listTags()).toEqual([]);
    const openRouterFetchCalls = openRouterFetch.mock.calls as unknown as [string, RequestInit][];
    const openRouterCall = openRouterFetchCalls.find(
      ([url]) => url === 'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(JSON.stringify(openRouterCall?.[1])).toContain('one tag per line');
    expect(JSON.stringify(openRouterCall?.[1])).not.toContain('JSON array');
  });

  it('builds tag suggestion prompt from stored summary without page extraction call', async () => {
    const fetchMock = createHybridFetchMock({
      pageHtml: '<html><body><article><p>Page extraction should be skipped.</p></article></body></html>',
      openRouterContent: '["summary-driven"]'
    });
    const { app, items, settings, summaries } = createApiTestContext(fetchMock as unknown as typeof fetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Summary-first tags',
      url: 'https://example.com/summary-first'
    });
    summaries.upsertSummary(item.id, 'Stored summary context.', 'openai/gpt-5-mini', 'openrouter', 'ai');

    const response = await request(app).post(`/api/v1/items/${item.id}/tag-suggestions`).send({});

    expect(response.status).toBe(200);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const pageCalls = calls.filter(([url]) => url === item.url);
    expect(pageCalls).toHaveLength(0);
    const openRouterCall = calls.find(
      ([url]) => url === 'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(JSON.stringify(openRouterCall?.[1])).toContain('Stored summary context.');
  });

  it('uses extracted page content for tag suggestions when summary is missing and does not persist summary', async () => {
    const fetchMock = createHybridFetchMock({
      pageHtml:
        '<html><body><article><h1>Tags from content</h1><p>Extracted fallback text for tags.</p></article></body></html>',
      openRouterContent: '["fallback-context"]'
    });
    const { app, items, settings, summaries } = createApiTestContext(fetchMock as unknown as typeof fetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'No summary tags',
      url: 'https://example.com/no-summary-tags'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/tag-suggestions`).send({});

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toEqual([{ name: 'fallback-context' }]);
    expect(summaries.getSummary(item.id)).toBeNull();
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const openRouterCall = calls.find(
      ([url]) => url === 'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(JSON.stringify(openRouterCall?.[1])).toContain('Extracted fallback text for tags.');
  });

  it('maps OpenRouter failures to upstream_error', async () => {
    const openRouterFetch = createOpenRouterFetchMock('bad gateway', 502);
    const { app, items, logs, settings } = createApiTestContext(openRouterFetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Failure article',
      url: 'https://example.com/failure'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('upstream_error');
    expect(response.body.error.message).toBe('OpenRouter request failed.');
    expect(logs.some((entry) => entry.event === 'ai.summary.failed')).toBe(true);
    expect(logs.find((entry) => entry.event === 'ai.summary.failed')?.metadata).toMatchObject({
      upstreamContentType: 'application/json',
      upstreamStatus: 502
    });
  });

  it('maps OpenRouter rate limits to a specific upstream message', async () => {
    const openRouterFetch = createOpenRouterFetchMock('rate limited', 429);
    const { app, items, settings } = createApiTestContext(openRouterFetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'google/gemma-4-31b-it:free'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Rate limited article',
      url: 'https://example.com/rate-limited'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('upstream_error');
    expect(response.body.error.message).toBe(
      'OpenRouter rate limit reached. Wait and retry, or choose another model.'
    );
  });

  it('maps OpenRouter network errors to upstream_error', async () => {
    const openRouterFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://openrouter.ai/api/v1/chat/completions') {
        throw new TypeError('network failure');
      }

      return new Response('<html><body><article><p>Reachable page.</p></article></body></html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 200
      });
    });
    const { app, items, settings } = createApiTestContext(openRouterFetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Network failure article',
      url: 'https://example.com/network-failure'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('upstream_error');
  });

  it('builds summary prompt from extracted page content', async () => {
    const fetchMock = createHybridFetchMock({
      pageHtml:
        '<html><body><article><h1>Grounded title</h1><p>Grounded content for summary extraction.</p></article></body></html>',
      openRouterContent: 'Grounded summary output.'
    });
    const { app, items, settings } = createApiTestContext(fetchMock as unknown as typeof fetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Grounding article',
      url: 'https://example.com/grounding'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(200);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const openRouterCall = calls.find(
      ([url]) => url === 'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(openRouterCall).toBeDefined();
    expect(JSON.stringify(openRouterCall?.[1])).toContain('Grounded content for summary extraction.');
  });

  it('returns content_unavailable when extracted page content cannot be obtained', async () => {
    const fetchMock = createHybridFetchMock({
      pageHtml: 'forbidden',
      pageStatus: 403,
      openRouterContent: 'Should not be used.'
    });
    const { app, items, settings } = createApiTestContext(fetchMock as unknown as typeof fetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Blocked article',
      url: 'https://example.com/blocked'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('content_unavailable');
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.some(([url]) => url === 'https://openrouter.ai/api/v1/chat/completions')).toBe(false);
  });

  it('returns content_unavailable when extraction exceeds redirect cap', async () => {
    const redirectingFetch = vi.fn(async (_input: RequestInfo | URL) => {
      return new Response('', {
        headers: { Location: 'https://example.com/next-hop' },
        status: 302
      });
    });
    const { app, items, settings } = createApiTestContext(redirectingFetch as unknown as typeof fetch);
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Redirect loop article',
      url: 'https://example.com/redirect-loop'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('content_unavailable');
    const calls = redirectingFetch.mock.calls as unknown as [string, RequestInit][];
    expect(calls.length).toBeGreaterThan(5);
  });

  it('returns content_unavailable when hostname resolves to private IP range', async () => {
    const fetchMock = createHybridFetchMock({
      pageHtml: '<html><body><article><p>Should never be fetched.</p></article></body></html>',
      openRouterContent: 'Should not be used.'
    });
    const privateResolver: HostnameResolver = async () => ['192.168.1.12'];
    const { app, items, settings } = createApiTestContext(
      fetchMock as unknown as typeof fetch,
      privateResolver
    );
    settings.updateOpenRouterSettings({
      apiKey: 'or-v1-secret',
      model: 'openai/gpt-5-mini'
    });
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Private host article',
      url: 'https://example.com/private-host'
    });

    const response = await request(app).post(`/api/v1/items/${item.id}/summary`).send({});

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('content_unavailable');
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls).toHaveLength(0);
  });
});

describe('settings API', () => {
  it('patches OpenRouter settings and never returns the raw API key', async () => {
    const { app, logs, settings } = createApiTestContext();

    const patchResponse = await request(app).patch('/api/v1/settings').send({
      openRouter: {
        apiKey: 'or-v1-secret',
        model: 'openai/gpt-5-mini'
      }
    });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body).toEqual({
      chromeProfilePath: null,
      openRouter: {
        apiKeyConfigured: true,
        model: 'openai/gpt-5-mini'
      }
    });
    expect(JSON.stringify(patchResponse.body)).not.toContain('or-v1-secret');
    expect(settings.getOpenRouterApiKey()).toBe('or-v1-secret');
    expect(JSON.stringify(logs)).not.toContain('or-v1-secret');
    expect(logs.some((entry) => entry.event === 'settings.openrouter.updated')).toBe(true);

    const getResponse = await request(app).get('/api/v1/settings');
    expect(getResponse.status).toBe(200);
    expect(JSON.stringify(getResponse.body)).not.toContain('or-v1-secret');
  });

  it('patches and returns saved Chrome profile path without default detection', async () => {
    const { app } = createApiTestContext();

    const patchResponse = await request(app).patch('/api/v1/settings').send({
      chromeProfilePath: 'C:\\Chrome\\Default'
    });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.chromeProfilePath).toBe('C:\\Chrome\\Default');

    const clearResponse = await request(app).patch('/api/v1/settings').send({
      chromeProfilePath: ''
    });
    expect(clearResponse.body.chromeProfilePath).toBeNull();
  });
});
