import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createInMemoryDatabase, initializeDatabase } from '../../../src/db/database';
import { createItemRepository } from '../../../src/domain/items/item-repository';
import { createSettingsRepository } from '../../../src/domain/settings/settings-repository';
import { createSummaryRepository } from '../../../src/domain/summaries/summary-repository';
import { createBookmarkSyncService } from '../../../src/domain/sync/bookmark-sync-service';
import { createSyncRunRepository } from '../../../src/domain/sync/sync-run-repository';
import { createTagRepository } from '../../../src/domain/tags/tag-repository';

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureProfilePath = join(testDir, '..', '..', 'fixtures', 'chrome-profile');

function createSyncTestContext() {
  const db = createInMemoryDatabase();
  initializeDatabase(db);
  const items = createItemRepository(db);
  const settings = createSettingsRepository(db);
  const summaries = createSummaryRepository(db);
  const syncRuns = createSyncRunRepository(db);
  const tags = createTagRepository(db);

  return {
    items,
    service: createBookmarkSyncService({ items, settings, syncRuns }),
    settings,
    summaries,
    syncRuns,
    tags
  };
}

describe('bookmark sync service', () => {
  it('imports bookmarks, skips invalid URLs, and deduplicates by normalized URL', () => {
    const { items, service, settings } = createSyncTestContext();
    settings.setChromeProfilePath(fixtureProfilePath);

    const result = service.syncBookmarks();

    expect(result.status).toBe('success');
    expect(result.importedCount).toBe(2);
    expect(result.updatedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(items.listItems({ limit: 10, offset: 0 }).total).toBe(2);
  });

  it('preserves user metadata when an existing item is refreshed', () => {
    const { items, service, settings, summaries, tags } = createSyncTestContext();
    settings.setChromeProfilePath(fixtureProfilePath);
    const existing = items.upsertImportedItem({
      sourceType: 'chrome_bookmark',
      title: 'Old Vue',
      url: 'https://example.com/vue'
    });
    const tag = tags.createTag('frontend');
    items.updateStatus(existing.id, 'read');
    tags.attachTagToItem(existing.id, tag.id);
    summaries.upsertSummary(existing.id, 'Keep this summary', 'openai/gpt-5-mini', 'openrouter', 'ai');

    service.syncBookmarks();

    const refreshed = items.getItem(existing.id);
    expect(refreshed?.title).toBe('Vue Guide Duplicate');
    expect(refreshed?.status).toBe('read');
    expect(refreshed?.tags).toEqual([{ id: tag.id, name: 'frontend' }]);
    expect(refreshed?.summary?.content).toBe('Keep this summary');
  });

  it('records a failed sync when the Chrome profile path is missing', () => {
    const { service, settings, syncRuns } = createSyncTestContext();
    settings.setChromeProfilePath('C:\\missing\\profile');

    const result = service.syncBookmarks();

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('Bookmarks');
    expect(syncRuns.getLatestSyncRun()?.status).toBe('failed');
  });

  it('records a failed sync when the Chrome profile path is not configured', () => {
    const { service, syncRuns } = createSyncTestContext();

    const result = service.syncBookmarks();

    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('Chrome profile path is not configured.');
    expect(syncRuns.getLatestSyncRun()?.status).toBe('failed');
  });
});
