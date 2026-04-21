import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ParsedChromeBookmark {
  sourceId: string;
  sourceType: 'chrome_bookmark';
  title: string;
  url: string;
}

export interface ParsedChromeBookmarks {
  bookmarks: ParsedChromeBookmark[];
}

interface ChromeBookmarkNode {
  children?: ChromeBookmarkNode[];
  guid?: string;
  id?: string;
  name?: string;
  type?: string;
  url?: string;
}

interface ChromeBookmarksFile {
  roots?: Record<string, ChromeBookmarkNode>;
}

export function parseChromeBookmarksFile(profilePath: string): ParsedChromeBookmarks {
  const bookmarksPath = join(profilePath, 'Bookmarks');
  if (!existsSync(bookmarksPath)) {
    throw new Error(`Chrome Bookmarks file was not found at ${bookmarksPath}`);
  }

  const parsed = JSON.parse(readFileSync(bookmarksPath, 'utf8')) as ChromeBookmarksFile;
  const bookmarks: ParsedChromeBookmark[] = [];

  for (const [rootName, root] of Object.entries(parsed.roots ?? {})) {
    visitNode(root, [rootName], bookmarks, false);
  }

  return { bookmarks };
}

function visitNode(
  node: ChromeBookmarkNode,
  pathParts: string[],
  bookmarks: ParsedChromeBookmark[],
  includeCurrentFolder = true
): void {
  if (node.type === 'url' && node.url) {
    bookmarks.push({
      sourceId: [...pathParts, node.guid ?? node.id ?? node.name ?? node.url].join('/'),
      sourceType: 'chrome_bookmark',
      title: node.name ?? node.url,
      url: node.url
    });
    return;
  }

  const childPathParts = includeCurrentFolder
    ? [...pathParts, node.name ?? node.guid ?? node.id ?? 'folder']
    : pathParts;

  for (const child of node.children ?? []) {
    visitNode(child, childPathParts, bookmarks);
  }
}
