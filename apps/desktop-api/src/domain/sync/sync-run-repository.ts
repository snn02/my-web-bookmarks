import type { AppDatabase } from '../../db/database';
import { createId } from '../ids';
import { nowIso } from '../time';

export type SyncRunStatus = 'running' | 'success' | 'failed';

export interface SyncRun {
  id: string;
  sourceType: string;
  startedAt: string;
  finishedAt: string | null;
  status: SyncRunStatus;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorMessage: string | null;
}

export interface FinishSyncRunInput {
  status: Exclude<SyncRunStatus, 'running'>;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorMessage?: string;
}

interface SyncRunRow {
  id: string;
  source_type: string;
  started_at: string;
  finished_at: string | null;
  status: SyncRunStatus;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  error_message: string | null;
}

function toSyncRun(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    sourceType: row.source_type,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    importedCount: row.imported_count,
    updatedCount: row.updated_count,
    skippedCount: row.skipped_count,
    errorMessage: row.error_message
  };
}

export function createSyncRunRepository(db: AppDatabase) {
  function getSyncRun(id: string): SyncRun | null {
    const row = db.prepare('SELECT * FROM sync_runs WHERE id = ?').get(id) as
      | SyncRunRow
      | undefined;
    return row ? toSyncRun(row) : null;
  }

  function startSyncRun(sourceType: string): SyncRun {
    const id = createId('sync');
    db.prepare(
      `
        INSERT INTO sync_runs (
          id, source_type, started_at, status, imported_count, updated_count, skipped_count
        )
        VALUES (?, ?, ?, 'running', 0, 0, 0)
      `
    ).run(id, sourceType, nowIso());
    return getSyncRun(id) as SyncRun;
  }

  function finishSyncRun(id: string, input: FinishSyncRunInput): SyncRun {
    db.prepare(
      `
        UPDATE sync_runs
        SET status = ?, finished_at = ?, imported_count = ?, updated_count = ?,
            skipped_count = ?, error_message = ?
        WHERE id = ?
      `
    ).run(
      input.status,
      nowIso(),
      input.importedCount,
      input.updatedCount,
      input.skippedCount,
      input.errorMessage ?? null,
      id
    );

    const run = getSyncRun(id);
    if (!run) {
      throw new Error(`Sync run not found: ${id}`);
    }
    return run;
  }

  function getLatestSyncRun(): SyncRun | null {
    const row = db
      .prepare('SELECT * FROM sync_runs ORDER BY started_at DESC, id DESC LIMIT 1')
      .get() as SyncRunRow | undefined;
    return row ? toSyncRun(row) : null;
  }

  return {
    finishSyncRun,
    getLatestSyncRun,
    startSyncRun
  };
}
