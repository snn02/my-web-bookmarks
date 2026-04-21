import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.vue';

function ok(body: unknown) {
  return {
    ok: true,
    json: async () => body
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
      .mockResolvedValueOnce(createInitialResponses()[1])
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
      );
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Vue Guide'));

    await wrapper.get('[aria-label="Search bookmarks"]').setValue('vue');
    await wrapper.get('[aria-label="Status filter"]').setValue('new');
    await wrapper.get('[aria-label="Apply filters"]').trigger('click');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/items?q=vue&status=new&sort=importedAt%3Adesc');
    await vi.waitFor(() => expect(wrapper.text()).toContain('Vue Guide'));

    await wrapper.get('[aria-label="Mark Vue Guide as read"]').trigger('click');
    await wrapper.get('[aria-label="New tag name"]').setValue('reading');
    await wrapper.get('[aria-label="Create tag"]').trigger('click');
    await wrapper.get('[aria-label="Chrome profile path"]').setValue('C:\\Chrome\\Profile');
    await wrapper.get('[aria-label="Save Chrome profile path"]').trigger('click');
    await wrapper.get('[aria-label="Sync bookmarks"]').trigger('click');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/items/itm_1', expect.objectContaining({ method: 'PATCH' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tags', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/items/itm_1/tags', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/settings', expect.objectContaining({ method: 'PATCH' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/sync/bookmarks', expect.objectContaining({ method: 'POST' }));
  });
});
