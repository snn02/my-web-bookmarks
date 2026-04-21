import type { AppDatabase } from '../../db/database';
import { createId } from '../ids';
import { nowIso } from '../time';

export type SummaryUpdatedBy = 'ai' | 'user';

export interface Summary {
  itemId: string;
  content: string;
  updatedAt: string;
  updatedBy: SummaryUpdatedBy;
}

interface SummaryRow {
  item_id: string;
  summary_text: string;
  updated_at: string;
  updated_by: SummaryUpdatedBy;
}

function toSummary(row: SummaryRow): Summary {
  return {
    itemId: row.item_id,
    content: row.summary_text,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  };
}

export function createSummaryRepository(db: AppDatabase) {
  function getSummary(itemId: string): Summary | null {
    const row = db
      .prepare('SELECT item_id, summary_text, updated_at, updated_by FROM summaries WHERE item_id = ?')
      .get(itemId) as SummaryRow | undefined;
    return row ? toSummary(row) : null;
  }

  function upsertSummary(
    itemId: string,
    content: string,
    model: string,
    provider: string,
    updatedBy: SummaryUpdatedBy
  ): Summary {
    const existing = getSummary(itemId);
    const timestamp = nowIso();

    if (existing) {
      db.prepare(
        `
          UPDATE summaries
          SET summary_text = ?, model = ?, provider = ?, updated_by = ?, updated_at = ?
          WHERE item_id = ?
        `
      ).run(content, model, provider, updatedBy, timestamp, itemId);
    } else {
      db.prepare(
        `
          INSERT INTO summaries (
            id, item_id, summary_text, model, provider, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(createId('sum'), itemId, content, model, provider, updatedBy, timestamp, timestamp);
    }

    return getSummary(itemId) as Summary;
  }

  function updateSummaryManually(itemId: string, content: string): Summary {
    const current = getSummary(itemId);
    if (!current) {
      throw new Error(`Summary not found for item: ${itemId}`);
    }

    db.prepare(
      `
        UPDATE summaries
        SET summary_text = ?, updated_by = 'user', updated_at = ?
        WHERE item_id = ?
      `
    ).run(content, nowIso(), itemId);

    return getSummary(itemId) as Summary;
  }

  return {
    getSummary,
    updateSummaryManually,
    upsertSummary
  };
}
