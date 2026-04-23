import { API_BASE_PATH } from '@my-web-bookmarks/shared';

export type ItemStatus = 'new' | 'read' | 'archived';
export type ItemSort = 'importedAt:desc' | 'importedAt:asc' | 'updatedAt:desc' | 'updatedAt:asc';

export interface Tag {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Summary {
  itemId?: string;
  content: string;
  updatedAt: string;
  updatedBy: 'ai' | 'user';
}

export interface BookmarkItem {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  domain: string;
  status: ItemStatus;
  importedAt: string;
  updatedAt: string;
  tags: Tag[];
  summary: Summary | null;
}

export interface ItemListResponse {
  items: BookmarkItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ItemFilters {
  q?: string;
  status?: ItemStatus | '';
  tagIds?: string[];
  sort?: ItemSort;
}

export interface PublicSettings {
  openRouter: {
    apiKeyConfigured: boolean;
    summaryModel: string;
    tagsModel: string;
  };
  chromeProfilePath?: string | null;
}

export interface SyncStatus {
  status: 'idle' | 'running' | 'succeeded' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  error: string | null;
}

export interface OpenRouterSettingsPatch {
  apiKey?: string;
  summaryModel?: string;
  tagsModel?: string;
  model?: string;
}

export interface TagSuggestion {
  name: string;
}

export async function fetchItems(filters: ItemFilters = {}): Promise<ItemListResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.tagIds?.length) params.set('tagIds', filters.tagIds.join(','));
  if (filters.sort) params.set('sort', filters.sort);

  return requestJson(`${API_BASE_PATH}/items${params.size ? `?${params.toString()}` : ''}`);
}

export async function updateItemStatus(itemId: string, status: ItemStatus): Promise<BookmarkItem> {
  return requestJson(`${API_BASE_PATH}/items/${itemId}`, {
    body: JSON.stringify({ status }),
    headers: jsonHeaders(),
    method: 'PATCH'
  });
}

export async function fetchTags(): Promise<{ tags: Tag[] }> {
  return requestJson(`${API_BASE_PATH}/tags`);
}

export async function createTag(name: string): Promise<Tag> {
  return requestJson(`${API_BASE_PATH}/tags`, {
    body: JSON.stringify({ name }),
    headers: jsonHeaders(),
    method: 'POST'
  });
}

export async function attachTagToItem(itemId: string, tagId: string): Promise<{ id: string; tags: Tag[] }> {
  return requestJson(`${API_BASE_PATH}/items/${itemId}/tags`, {
    body: JSON.stringify({ tagId }),
    headers: jsonHeaders(),
    method: 'POST'
  });
}

export async function removeTagFromItem(itemId: string, tagId: string): Promise<void> {
  await requestNoContent(`${API_BASE_PATH}/items/${itemId}/tags/${tagId}`, { method: 'DELETE' });
}

export async function updateSummary(itemId: string, content: string): Promise<Summary> {
  return requestJson(`${API_BASE_PATH}/items/${itemId}/summary`, {
    body: JSON.stringify({ content }),
    headers: jsonHeaders(),
    method: 'PATCH'
  });
}

export async function fetchSettings(): Promise<PublicSettings> {
  return requestJson(`${API_BASE_PATH}/settings`);
}

export async function saveChromeProfilePath(chromeProfilePath: string): Promise<PublicSettings> {
  return requestJson(`${API_BASE_PATH}/settings`, {
    body: JSON.stringify({ chromeProfilePath }),
    headers: jsonHeaders(),
    method: 'PATCH'
  });
}

export async function saveOpenRouterSettings(
  openRouter: OpenRouterSettingsPatch
): Promise<PublicSettings> {
  return requestJson(`${API_BASE_PATH}/settings`, {
    body: JSON.stringify({ openRouter }),
    headers: jsonHeaders(),
    method: 'PATCH'
  });
}

export async function generateSummary(itemId: string): Promise<Summary> {
  return requestJson(`${API_BASE_PATH}/items/${itemId}/summary`, {
    body: JSON.stringify({}),
    headers: jsonHeaders(),
    method: 'POST'
  });
}

export async function suggestTags(itemId: string): Promise<{ suggestions: TagSuggestion[] }> {
  return requestJson(`${API_BASE_PATH}/items/${itemId}/tag-suggestions`, {
    body: JSON.stringify({}),
    headers: jsonHeaders(),
    method: 'POST'
  });
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  return requestJson(`${API_BASE_PATH}/sync/status`);
}

export async function startBookmarkSync(): Promise<SyncStatus> {
  return requestJson(`${API_BASE_PATH}/sync/bookmarks`, {
    body: JSON.stringify({}),
    headers: jsonHeaders(),
    method: 'POST'
  });
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = init ? await fetch(url, init) : await fetch(url);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
  return (await response.json()) as T;
}

async function requestNoContent(url: string, init?: RequestInit): Promise<void> {
  const response = init ? await fetch(url, init) : await fetch(url);
  if (!response.ok) {
    throw new Error(await parseApiErrorMessage(response));
  }
}

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

async function parseApiErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as {
      error?: {
        code?: string;
        message?: string;
      };
    };
    if (parsed.error?.code === 'upstream_error') {
      return formatUpstreamErrorMessage(parsed.error.message);
    }
    if (parsed.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Fall through to the plain response body.
  }

  return text || `Request failed with status ${response.status}.`;
}

function formatUpstreamErrorMessage(message?: string): string {
  const fallback = 'OpenRouter request failed.';
  const text = message ?? fallback;
  const hasSpecificGuidance =
    text.includes('rate limit') || text.includes('rejected') || text.includes('choose another model');

  return hasSpecificGuidance
    ? text
    : `${text} Check API key, model name, network access, or provider availability.`;
}
