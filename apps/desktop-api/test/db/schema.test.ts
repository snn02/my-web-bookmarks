import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createFileDatabase,
  createInMemoryDatabase,
  getDefaultDatabasePath,
  initializeDatabase
} from '../../src/db/database';
import { createItemRepository } from '../../src/domain/items/item-repository';
import { createSettingsRepository } from '../../src/domain/settings/settings-repository';

describe('database schema', () => {
  it('creates all V1 persistence tables on an empty database', () => {
    const db = createInMemoryDatabase();

    initializeDatabase(db);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all()
      .map((row) => row.name);

    expect(tables).toEqual([
      'item_tags',
      'items',
      'schema_migrations',
      'settings',
      'summaries',
      'sync_runs',
      'tags'
    ]);
  });

  it('persists app data across file database reopen', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'my-web-bookmarks-db-'));
    const dbPath = join(tempDir, 'app.db');
    try {
      const firstDb = createFileDatabase(dbPath);
      initializeDatabase(firstDb);
      const firstItems = createItemRepository(firstDb);
      const firstSettings = createSettingsRepository(firstDb);
      const item = firstItems.upsertImportedItem({
        sourceType: 'chrome_bookmark',
        title: 'Persistent article',
        url: 'https://example.com/persistent'
      });
      firstSettings.setChromeProfilePath('C:\\Chrome\\Default');
      firstDb.close();

      const secondDb = createFileDatabase(dbPath);
      initializeDatabase(secondDb);
      const secondItems = createItemRepository(secondDb);
      const secondSettings = createSettingsRepository(secondDb);

      expect(secondItems.getItem(item.id)?.title).toBe('Persistent article');
      expect(secondSettings.getChromeProfilePath()).toBe('C:\\Chrome\\Default');
      secondDb.close();
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('resolves the default durable database path under root data/sqlite', () => {
    expect(getDefaultDatabasePath()).toMatch(/data[\\/]sqlite[\\/]app\.db$/);
  });
});
