import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.vue';

function ok(body: unknown) {
  return {
    ok: true,
    json: async () => body
  };
}

function fail(message: string, status = 502) {
  return {
    ok: false,
    status,
    text: async () => message
  };
}

function createInitialResponses() {
  return [
    ok({ status: 'ok' }),
    ok({
      items: [
        {
          id: 'itm_1',
          url: 'https://example.com/vue',
          normalizedUrl: 'https://example.com/vue',
          title: 'Vue Guide',
          domain: 'example.com',
          status: 'new',
          importedAt: '2026-04-08T18:00:00Z',
          updatedAt: '2026-04-08T18:10:00Z',
          tags: [{ id: 'tag_1', name: 'frontend' }],
          summary: {
            content: 'Useful summary',
            updatedAt: '2026-04-08T18:10:00Z',
            updatedBy: 'ai'
          }
        }
      ],
      total: 1,
      limit: 50,
      offset: 0
    }),
    ok({ tags: [{ id: 'tag_1', name: 'frontend' }] }),
    ok({
      openRouter: { apiKeyConfigured: false, model: null },
      chromeProfilePath: 'C:\\Chrome\\Default'
    }),
    ok({
      status: 'idle',
      startedAt: null,
      finishedAt: null,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: null
    })
  ];
}

function syncedItemList() {
  return ok({
    items: [
      {
        id: 'itm_2',
        url: 'https://example.com/synced',
        normalizedUrl: 'https://example.com/synced',
        title: 'Synced Bookmark',
        domain: 'example.com',
        status: 'new',
        importedAt: '2026-04-08T18:30:00Z',
        updatedAt: '2026-04-08T18:30:00Z',
        tags: [],
        summary: null
      }
    ],
    total: 1,
    limit: 50,
    offset: 0
  });
}

describe('App', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows backend availability when health check succeeds', async () => {
    const fetchMock = vi.fn();
    for (const response of createInitialResponses()) {
      fetchMock.mockResolvedValueOnce(response);
    }
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Backend: available'));

    expect(fetch).toHaveBeenCalledWith('/api/v1/health');
    expect(wrapper.text()).toContain('Vue Guide');
    expect(wrapper.text()).toContain('Useful summary');
    expect(wrapper.text()).toContain('frontend');
  });

  it('shows backend unavailable state when health check fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Backend: unavailable'));
  });

  it('filters, updates status, manages tags, saves settings, and starts sync', async () => {
    const fetchMock = vi.fn();
    for (const response of createInitialResponses()) {
      fetchMock.mockResolvedValueOnce(response);
    }
    fetchMock
      .mockResolvedValueOnce(createInitialResponses()[1])
      .mockResolvedValueOnce(
        ok({
          id: 'itm_1',
          url: 'https://example.com/vue',
          normalizedUrl: 'https://example.com/vue',
          title: 'Vue Guide',
          domain: 'example.com',
          status: 'read',
          importedAt: '2026-04-08T18:00:00Z',
          updatedAt: '2026-04-08T18:12:00Z',
          tags: [{ id: 'tag_1', name: 'frontend' }],
          summary: {
            content: 'Useful summary',
            updatedAt: '2026-04-08T18:10:00Z',
            updatedBy: 'ai'
          }
        })
      )
      .mockResolvedValueOnce(ok({ id: 'tag_2', name: 'reading' }))
      .mockResolvedValueOnce(ok({ id: 'itm_1', tags: [{ id: 'tag_2', name: 'reading' }] }))
      .mockResolvedValueOnce(ok({ chromeProfilePath: 'C:\\Chrome\\Profile' }))
      .mockResolvedValueOnce(
        ok({
          status: 'running',
          startedAt: '2026-04-08T18:20:00Z',
          finishedAt: null,
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          error: null
        })
      )
      .mockResolvedValueOnce(
        ok({
          status: 'succeeded',
          startedAt: '2026-04-08T18:20:00Z',
          finishedAt: '2026-04-08T18:20:01Z',
          importedCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          error: null
        })
      )
      .mockResolvedValueOnce(syncedItemList());
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Vue Guide'));

    await wrapper.get('[aria-label="Search bookmarks"]').setValue('vue');
    await wrapper.get('[aria-label="Status filter"]').setValue('new');
    await wrapper.get('[aria-label="Apply filters"]').trigger('click');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/items?q=vue&status=new&sort=importedAt%3Adesc');
    await vi.waitFor(() => expect(wrapper.text()).toContain('Vue Guide'));

    await wrapper.get('[aria-label="Mark Vue Guide as read"]').trigger('click');
    await flushPromises();
    await wrapper.get('[aria-label="New tag name"]').setValue('reading');
    await wrapper.get('[aria-label="Create tag"]').trigger('click');
    await flushPromises();
    await wrapper.get('[aria-label="Chrome profile path"]').setValue('C:\\Chrome\\Profile');
    await wrapper.get('[aria-label="Sync bookmarks"]').trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.text()).toContain('Synced Bookmark'));

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/items/itm_1', expect.objectContaining({ method: 'PATCH' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tags', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/items/itm_1/tags', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/settings', expect.objectContaining({ method: 'PATCH' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/sync/bookmarks', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/sync/status');
    expect(wrapper.text()).toContain('Sync: succeeded | +1 / ~0 / skipped 0');
  });

  it('shows sync errors returned after a sync attempt', async () => {
    const fetchMock = vi.fn();
    for (const response of createInitialResponses()) {
      fetchMock.mockResolvedValueOnce(response);
    }
    fetchMock
      .mockResolvedValueOnce(ok({ chromeProfilePath: 'C:\\Chrome\\Default' }))
      .mockResolvedValueOnce(
        ok({
          status: 'running',
          startedAt: '2026-04-08T18:20:00Z',
          finishedAt: null,
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          error: null
        })
      )
      .mockResolvedValueOnce(
        ok({
          status: 'failed',
          startedAt: '2026-04-08T18:20:00Z',
          finishedAt: '2026-04-08T18:20:01Z',
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          error: 'Chrome Bookmarks file was not found at C:\\missing\\Bookmarks'
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Vue Guide'));

    await wrapper.get('[aria-label="Sync bookmarks"]').trigger('click');
    await flushPromises();

    await vi.waitFor(() => expect(wrapper.text()).toContain('Chrome Bookmarks file was not found'));
  });

  it('generates summaries and confirms AI tag suggestions with visible outcomes', async () => {
    const fetchMock = vi.fn();
    for (const response of createInitialResponses()) {
      fetchMock.mockResolvedValueOnce(response);
    }
    fetchMock
      .mockResolvedValueOnce(
        ok({
          openRouter: { apiKeyConfigured: true, model: 'openai/gpt-5-mini' },
          chromeProfilePath: 'C:\\Chrome\\Default'
        })
      )
      .mockResolvedValueOnce(
        ok({
          itemId: 'itm_1',
          content: 'Generated AI summary',
          updatedAt: '2026-04-08T18:40:00Z',
          updatedBy: 'ai'
        })
      )
      .mockResolvedValueOnce(
        ok({
          openRouter: { apiKeyConfigured: true, model: 'openai/gpt-5-mini' },
          chromeProfilePath: 'C:\\Chrome\\Default'
        })
      )
      .mockResolvedValueOnce(ok({ suggestions: [{ name: 'research' }] }))
      .mockResolvedValueOnce(ok({ id: 'tag_2', name: 'research' }))
      .mockResolvedValueOnce(
        ok({
          id: 'itm_1',
          tags: [
            { id: 'tag_1', name: 'frontend' },
            { id: 'tag_2', name: 'research' }
          ]
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Vue Guide'));

    await wrapper.get('[aria-label="OpenRouter API key"]').setValue('or-v1-secret');
    await wrapper.get('[aria-label="OpenRouter model"]').setValue('openai/gpt-5-mini');
    await wrapper.get('[aria-label="Generate summary for Vue Guide"]').trigger('click');
    await flushPromises();

    await vi.waitFor(() => expect(wrapper.text()).toContain('Generated AI summary'));
    expect(wrapper.text()).not.toContain('or-v1-secret');

    await wrapper.get('[aria-label="Suggest tags for Vue Guide"]').trigger('click');
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.text()).toContain('research'));

    await wrapper.get('[aria-label="Apply suggested tag research to Vue Guide"]').trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/settings', expect.objectContaining({ method: 'PATCH' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/items/itm_1/summary',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/items/itm_1/tag-suggestions',
      expect.objectContaining({ method: 'POST' })
    );
    await vi.waitFor(() => expect(wrapper.text()).toContain('research x'));
  });

  it('shows AI generation errors as a visible final state', async () => {
    const fetchMock = vi.fn();
    for (const response of createInitialResponses()) {
      fetchMock.mockResolvedValueOnce(response);
    }
    fetchMock
      .mockResolvedValueOnce(
        ok({
          openRouter: { apiKeyConfigured: false, model: null },
          chromeProfilePath: 'C:\\Chrome\\Default'
        })
      )
      .mockResolvedValueOnce(fail('OpenRouter request failed.'));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Vue Guide'));

    await wrapper.get('[aria-label="Generate summary for Vue Guide"]').trigger('click');
    await flushPromises();

    await vi.waitFor(() => expect(wrapper.text()).toContain('OpenRouter request failed.'));
  });
});
