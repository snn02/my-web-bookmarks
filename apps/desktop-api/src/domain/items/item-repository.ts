import type { AppDatabase } from '../../db/database';
import { createId } from '../ids';
import { nowIso } from '../time';
import { domainFromUrl, normalizeUrl } from './normalize-url';

export type ItemStatus = 'new' | 'read' | 'archived';
export type ItemSort = 'importedAt:desc' | 'importedAt:asc' | 'updatedAt:desc' | 'updatedAt:asc';

export interface TagPreview {
  id: string;
  name: string;
}

export interface SummaryPreview {
  content: string;
  updatedAt: string;
  updatedBy: 'ai' | 'user';
}

export interface Item {
  id: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  status: ItemStatus;
  importedAt: string;
  updatedAt: string;
  lastSeenAt: string;
  readAt: string | null;
  archivedAt: string | null;
  tags: TagPreview[];
  summary: SummaryPreview | null;
}

export interface ImportedItemInput {
  sourceType: string;
  sourceId?: string;
  title: string;
  url: string;
}

export interface ListItemsOptions {
  limit: number;
  offset: number;
  q?: string;
  sort?: ItemSort;
  status?: ItemStatus;
  tagIds?: string[];
}

export interface ListItemsResult {
  items: Item[];
  total: number;
  limit: number;
  offset: number;
}

interface ItemRow {
  id: string;
  source_type: string;
  source_id: string | null;
  title: string;
  url: string;
  normalized_url: string;
  domain: string;
  status: ItemStatus;
  imported_at: string;
  updated_at: string;
  last_seen_at: string;
  read_at: string | null;
  archived_at: string | null;
}

export function createItemRepository(db: AppDatabase) {
  function hydrate(row: ItemRow): Item {
    const tags = db
      .prepare(
        `
          SELECT tags.id, tags.name
          FROM tags
          JOIN item_tags ON item_tags.tag_id = tags.id
          WHERE item_tags.item_id = ?
          ORDER BY tags.name ASC
        `
      )
      .all(row.id) as unknown as TagPreview[];
    const summary = db
      .prepare(
        `
          SELECT summary_text, updated_at, updated_by
          FROM summaries
          WHERE item_id = ?
        `
      )
      .get(row.id) as
      | { summary_text: string; updated_at: string; updated_by: 'ai' | 'user' }
      | undefined;

    return {
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      title: row.title,
      url: row.url,
      normalizedUrl: row.normalized_url,
      domain: row.domain,
      status: row.status,
      importedAt: row.imported_at,
      updatedAt: row.updated_at,
      lastSeenAt: row.last_seen_at,
      readAt: row.read_at,
      archivedAt: row.archived_at,
      tags,
      summary: summary
        ? {
            content: summary.summary_text,
            updatedAt: summary.updated_at,
            updatedBy: summary.updated_by
          }
        : null
    };
  }

  function getItem(id: string): Item | null {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined;
    return row ? hydrate(row) : null;
  }

  function upsertImportedItem(input: ImportedItemInput): Item {
    const normalizedUrl = normalizeUrl(input.url);
    const existing = db
      .prepare('SELECT * FROM items WHERE normalized_url = ?')
      .get(normalizedUrl) as ItemRow | undefined;
    const timestamp = nowIso();
    const trimmedUrl = input.url.trim();
    const domain = domainFromUrl(normalizedUrl);

    if (existing) {
      db.prepare(
        `
          UPDATE items
          SET source_type = ?, source_id = ?, title = ?, url = ?, domain = ?,
              updated_at = ?, last_seen_at = ?
          WHERE id = ?
        `
      ).run(
        input.sourceType,
        input.sourceId ?? null,
        input.title,
        trimmedUrl,
        domain,
        timestamp,
        timestamp,
        existing.id
      );
      return getItem(existing.id) as Item;
    }

    const id = createId('itm');
    db.prepare(
      `
        INSERT INTO items (
          id, source_type, source_id, title, url, normalized_url, domain, status,
          imported_at, updated_at, last_seen_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
      `
    ).run(
      id,
      input.sourceType,
      input.sourceId ?? null,
      input.title,
      trimmedUrl,
      normalizedUrl,
      domain,
      timestamp,
      timestamp,
      timestamp
    );

    return getItem(id) as Item;
  }

  function updateStatus(id: string, status: ItemStatus): Item {
    const timestamp = nowIso();
    db.prepare(
      `
        UPDATE items
        SET status = ?,
            updated_at = ?,
            read_at = CASE WHEN ? = 'read' THEN ? ELSE read_at END,
            archived_at = CASE WHEN ? = 'archived' THEN ? ELSE archived_at END
        WHERE id = ?
      `
    ).run(status, timestamp, status, timestamp, status, timestamp, id);

    const item = getItem(id);
    if (!item) {
      throw new Error(`Item not found: ${id}`);
    }
    return item;
  }

  function listItems(options: ListItemsOptions): ListItemsResult {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (options.status) {
      where.push('items.status = ?');
      params.push(options.status);
    }

    if (options.q?.trim()) {
      const query = `%${options.q.trim()}%`;
      where.push(
        `(
          items.title LIKE ?
          OR items.url LIKE ?
          OR items.domain LIKE ?
          OR EXISTS (
            SELECT 1 FROM summaries
            WHERE summaries.item_id = items.id AND summaries.summary_text LIKE ?
          )
        )`
      );
      params.push(query, query, query, query);
    }

    if (options.tagIds?.length) {
      const placeholders = options.tagIds.map(() => '?').join(', ');
      where.push(
        `items.id IN (
          SELECT item_id
          FROM item_tags
          WHERE tag_id IN (${placeholders})
          GROUP BY item_id
          HAVING COUNT(DISTINCT tag_id) = ?
        )`
      );
      params.push(...options.tagIds, options.tagIds.length);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderBy = toOrderBy(options.sort ?? 'importedAt:desc');
    const rows = db
      .prepare(
        `
          SELECT items.*
          FROM items
          ${whereSql}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `
      )
      .all(...params, options.limit, options.offset) as unknown as ItemRow[];
    const totalRow = db
      .prepare(`SELECT COUNT(*) AS total FROM items ${whereSql}`)
      .get(...params) as { total: number };

    return {
      items: rows.map(hydrate),
      total: totalRow.total,
      limit: options.limit,
      offset: options.offset
    };
  }

  return {
    getItem,
    listItems,
    updateStatus,
    upsertImportedItem
  };
}

function toOrderBy(sort: ItemSort): string {
  switch (sort) {
    case 'importedAt:asc':
      return 'imported_at ASC';
    case 'updatedAt:desc':
      return 'updated_at DESC';
    case 'updatedAt:asc':
      return 'updated_at ASC';
    case 'importedAt:desc':
      return 'imported_at DESC';
  }
}
