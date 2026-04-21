import { describe, expect, it } from 'vitest';
import { createInMemoryDatabase, initializeDatabase } from '../../src/db/database';

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
});
