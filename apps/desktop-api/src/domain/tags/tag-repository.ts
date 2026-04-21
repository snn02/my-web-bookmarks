import type { AppDatabase } from '../../db/database';
import { createId } from '../ids';
import { nowIso } from '../time';

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface TagRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createTagRepository(db: AppDatabase) {
  function createTag(name: string): Tag {
    const trimmedName = name.trim();
    const normalizedName = normalizeTagName(name);
    const existing = db
      .prepare('SELECT id FROM tags WHERE normalized_name = ?')
      .get(normalizedName);

    if (existing) {
      throw new Error(`Tag already exists: ${trimmedName}`);
    }

    const timestamp = nowIso();
    const id = createId('tag');
    db.prepare(
      `
        INSERT INTO tags (id, name, normalized_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `
    ).run(id, trimmedName, normalizedName, timestamp, timestamp);

    return toTag(db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as unknown as TagRow);
  }

  function renameTag(id: string, name: string): Tag {
    const trimmedName = name.trim();
    const normalizedName = normalizeTagName(name);
    const existing = db
      .prepare('SELECT id FROM tags WHERE normalized_name = ? AND id <> ?')
      .get(normalizedName, id);

    if (existing) {
      throw new Error(`Tag already exists: ${trimmedName}`);
    }

    db.prepare('UPDATE tags SET name = ?, normalized_name = ?, updated_at = ? WHERE id = ?').run(
      trimmedName,
      normalizedName,
      nowIso(),
      id
    );

    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow | undefined;
    if (!row) {
      throw new Error(`Tag not found: ${id}`);
    }
    return toTag(row);
  }

  function deleteTag(id: string): void {
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  }

  function attachTagToItem(itemId: string, tagId: string): void {
    db.prepare(
      `
        INSERT OR IGNORE INTO item_tags (item_id, tag_id, created_at)
        VALUES (?, ?, ?)
      `
    ).run(itemId, tagId, nowIso());
  }

  function detachTagFromItem(itemId: string, tagId: string): void {
    db.prepare('DELETE FROM item_tags WHERE item_id = ? AND tag_id = ?').run(itemId, tagId);
  }

  return {
    attachTagToItem,
    createTag,
    deleteTag,
    detachTagFromItem,
    renameTag
  };
}
