import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS } from './migrations';

export type AppDatabase = DatabaseSync;

export function createInMemoryDatabase(): AppDatabase {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function createFileDatabase(path: string): AppDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function getDefaultDatabasePath(): string {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
  return process.env.DATABASE_PATH ?? join(repoRoot, 'data', 'sqlite', 'app.db');
}

export function initializeDatabase(db: AppDatabase): void {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => String(row.id))
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }

    db.exec(migration.sql);
    db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
      migration.id,
      new Date().toISOString()
    );
  }
}
