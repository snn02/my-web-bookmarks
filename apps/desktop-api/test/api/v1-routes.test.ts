import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { createInMemoryDatabase, initializeDatabase } from '../../src/db/database';
import { createItemRepository } from '../../src/domain/items/item-repository';
import { createSettingsRepository } from '../../src/domain/settings/settings-repository';
import { createSummaryRepository } from '../../src/domain/summaries/summary-repository';
import { createTagRepository } from '../../src/domain/tags/tag-repository';

function createOpenRouterFetchMock(content: string, status = 200) {
  return vi.fn(async () => {
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

function createApiTestContext(openRouterFetch?: typeof fetch) {
  const db = createInMemoryDatabase();
  initializeDatabase(db);

  return {
    app: createApp({ db, openRouterFetch }),
    db,
    items: createItemRepository(db),
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
    const { app, items, settings, summaries } = createApiTestContext(openRouterFetch);
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
    expect(JSON.stringify(openRouterFetchCalls[0][1])).toContain('AI summary article');
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
  });

  it('maps OpenRouter failures to upstream_error', async () => {
    const openRouterFetch = createOpenRouterFetchMock('bad gateway', 502);
    const { app, items, settings } = createApiTestContext(openRouterFetch);
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
  });
});

describe('settings API', () => {
  it('patches OpenRouter settings and never returns the raw API key', async () => {
    const { app, settings } = createApiTestContext();

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
