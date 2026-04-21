import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChromeBookmarksFile } from '../../../src/integrations/chrome/bookmarks-parser';

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureProfilePath = join(testDir, '..', '..', 'fixtures', 'chrome-profile');

describe('parseChromeBookmarksFile', () => {
  it('recursively extracts URL bookmarks from a Chrome profile Bookmarks file', () => {
    const result = parseChromeBookmarksFile(fixtureProfilePath);

    expect(result.bookmarks.map((bookmark) => bookmark.title)).toEqual([
      'Vue Guide',
      'SQLite Notes',
      'Invalid URL',
      'Vue Guide Duplicate'
    ]);
    expect(result.bookmarks[1]).toMatchObject({
      sourceId: 'bookmark_bar/Reading/guid-sqlite',
      sourceType: 'chrome_bookmark',
      title: 'SQLite Notes',
      url: 'https://db.example.com/sqlite/'
    });
  });
});
