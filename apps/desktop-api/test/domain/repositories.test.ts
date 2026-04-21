import { describe, expect, it } from 'vitest';
import { createInMemoryDatabase, initializeDatabase } from '../../src/db/database';
import { createItemRepository } from '../../src/domain/items/item-repository';
import { createSettingsRepository } from '../../src/domain/settings/settings-repository';
import { createSummaryRepository } from '../../src/domain/summaries/summary-repository';
import { createSyncRunRepository } from '../../src/domain/sync/sync-run-repository';
import { createTagRepository } from '../../src/domain/tags/tag-repository';

function createRepositories() {
  const db = createInMemoryDatabase();
  initializeDatabase(db);

  return {
    items: createItemRepository(db),
    settings: createSettingsRepository(db),
    summaries: createSummaryRepository(db),
    syncRuns: createSyncRunRepository(db),
    tags: createTagRepository(db)
  };
}

describe('item repository', () => {
  it('upserts imported bookmarks by normalized URL and preserves user metadata', () => {
    const { items, summaries, tags } = createRepositories();
    const first = items.upsertImportedItem({
      sourceId: 'mobile/articles/1',
      sourceType: 'chrome_bookmark',
      title: 'Original title',
      url: 'https://example.com/article?utm_source=android'
    });
    const tag = tags.createTag('Frontend');

    items.updateStatus(first.id, 'read');
    tags.attachTagToItem(first.id, tag.id);
    summaries.upsertSummary(first.id, 'Saved summary', 'openai/gpt-5-mini', 'openrouter', 'ai');

    const second = items.upsertImportedItem({
      sourceId: 'mobile/articles/1-renamed',
      sourceType: 'chrome_bookmark',
      title: 'Updated title',
      url: ' https://EXAMPLE.com/article#later '
    });
    const hydrated = items.getItem(second.id);

    expect(second.id).toBe(first.id);
    expect(hydrated?.title).toBe('Updated title');
    expect(hydrated?.status).toBe('read');
    expect(hydrated?.tags).toEqual([{ id: tag.id, name: 'Frontend' }]);
    expect(hydrated?.summary?.content).toBe('Saved summary');
  });

  it('lists items with status, tag, and text filters', () => {
    const { items, tags } = createRepositories();
    const frontend = tags.createTag('frontend');
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Vue article',
      url: 'https://example.com/vue'
    });
    items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Archived database note',
      url: 'https://db.example.com/sqlite'
    });
    tags.attachTagToItem(item.id, frontend.id);

    expect(
      items.listItems({ q: 'vue', status: 'new', tagIds: [frontend.id], limit: 10, offset: 0 })
        .items.map((listed) => listed.id)
    ).toEqual([item.id]);
  });
});

describe('tag repository', () => {
  it('enforces case-insensitive tag uniqueness and preserves relations on rename', () => {
    const { items, tags } = createRepositories();
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Tagged article',
      url: 'https://example.com/tagged'
    });
    const tag = tags.createTag(' Frontend ');

    tags.attachTagToItem(item.id, tag.id);

    expect(() => tags.createTag('frontend')).toThrow(/already exists/i);

    const renamed = tags.renameTag(tag.id, 'Web Frontend');
    expect(renamed.name).toBe('Web Frontend');
    expect(items.getItem(item.id)?.tags).toEqual([{ id: tag.id, name: 'Web Frontend' }]);

    tags.deleteTag(tag.id);
    expect(items.getItem(item.id)?.tags).toEqual([]);
  });
});

describe('summary repository', () => {
  it('stores one current summary per item and supports manual edits', () => {
    const { items, summaries } = createRepositories();
    const item = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Summary article',
      url: 'https://example.com/summary'
    });

    summaries.upsertSummary(item.id, 'AI summary', 'openai/gpt-5-mini', 'openrouter', 'ai');
    const edited = summaries.updateSummaryManually(item.id, 'Edited summary');

    expect(edited).toMatchObject({
      content: 'Edited summary',
      itemId: item.id,
      updatedBy: 'user'
    });
    expect(summaries.getSummary(item.id)?.content).toBe('Edited summary');
  });
});

describe('settings repository', () => {
  it('stores settings and redacts OpenRouter API key in public settings', () => {
    const { settings } = createRepositories();

    settings.updateOpenRouterSettings({ apiKey: 'or-v1-secret', model: 'openai/gpt-5-mini' });

    expect(settings.getOpenRouterApiKey()).toBe('or-v1-secret');
    expect(settings.getPublicSettings()).toEqual({
      chromeProfilePath: null,
      openRouter: {
        apiKeyConfigured: true,
        model: 'openai/gpt-5-mini'
      }
    });

    settings.updateOpenRouterSettings({ apiKey: '', model: 'openai/gpt-5-mini' });
    expect(settings.getPublicSettings().openRouter.apiKeyConfigured).toBe(false);
  });

  it('stores and clears the configured Chrome profile path', () => {
    const { settings } = createRepositories();

    settings.setChromeProfilePath('C:\\Users\\me\\AppData\\Local\\Google\\Chrome\\User Data\\Default');
    expect(settings.getChromeProfilePath()).toBe(
      'C:\\Users\\me\\AppData\\Local\\Google\\Chrome\\User Data\\Default'
    );

    settings.setChromeProfilePath('');
    expect(settings.getChromeProfilePath()).toBeNull();
  });
});

describe('sync run repository', () => {
  it('tracks the latest sync run status and counts', () => {
    const { syncRuns } = createRepositories();

    const running = syncRuns.startSyncRun('chrome_bookmark');
    const finished = syncRuns.finishSyncRun(running.id, {
      importedCount: 2,
      skippedCount: 5,
      status: 'success',
      updatedCount: 1
    });

    expect(finished.status).toBe('success');
    expect(syncRuns.getLatestSyncRun()).toMatchObject({
      id: running.id,
      importedCount: 2,
      skippedCount: 5,
      updatedCount: 1
    });
  });
});
