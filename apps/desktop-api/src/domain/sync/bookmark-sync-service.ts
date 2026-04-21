import type { createItemRepository } from '../items/item-repository';
import type { createSettingsRepository } from '../settings/settings-repository';
import type { createSyncRunRepository, SyncRun } from './sync-run-repository';
import { parseChromeBookmarksFile } from '../../integrations/chrome/bookmarks-parser';
import { normalizeUrl } from '../items/normalize-url';

export interface BookmarkSyncServiceDependencies {
  items: ReturnType<typeof createItemRepository>;
  settings: ReturnType<typeof createSettingsRepository>;
  syncRuns: ReturnType<typeof createSyncRunRepository>;
}

export function createBookmarkSyncService({
  items,
  settings,
  syncRuns
}: BookmarkSyncServiceDependencies) {
  function syncBookmarks(): SyncRun {
    const run = syncRuns.startSyncRun('chrome_bookmark');
    return performSync(run);
  }

  function startBookmarkSync(): SyncRun {
    const run = syncRuns.startSyncRun('chrome_bookmark');
    setTimeout(() => {
      performSync(run);
    }, 0);
    return run;
  }

  function performSync(run: SyncRun): SyncRun {
    try {
      const profilePath = settings.getChromeProfilePath();
      if (!profilePath) {
        throw new Error('Chrome profile path is not configured.');
      }

      const parsed = parseChromeBookmarksFile(profilePath);
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const bookmark of parsed.bookmarks) {
        try {
          const existing = items.getItemByNormalizedUrl(normalizeUrl(bookmark.url));
          items.upsertImportedItem(bookmark);
          if (existing) {
            updatedCount += 1;
          } else {
            importedCount += 1;
          }
        } catch {
          skippedCount += 1;
        }
      }

      return syncRuns.finishSyncRun(run.id, {
        importedCount,
        skippedCount,
        status: 'success',
        updatedCount
      });
    } catch (error) {
      return syncRuns.finishSyncRun(run.id, {
        errorMessage: error instanceof Error ? error.message : 'Bookmark sync failed.',
        importedCount: 0,
        skippedCount: 0,
        status: 'failed',
        updatedCount: 0
      });
    }
  }

  return {
    startBookmarkSync,
    syncBookmarks
  };
}
