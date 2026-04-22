<script setup lang="ts">
import { API_BASE_PATH, type HealthResponse } from '@my-web-bookmarks/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  attachTagToItem,
  createTag,
  fetchItems,
  fetchSettings,
  fetchSyncStatus,
  fetchTags,
  generateSummary,
  removeTagFromItem,
  saveChromeProfilePath,
  saveOpenRouterSettings,
  suggestTags,
  startBookmarkSync,
  updateItemStatus,
  updateSummary,
  type BookmarkItem,
  type ItemSort,
  type ItemStatus,
  type SyncStatus,
  type Tag,
  type TagSuggestion
} from './api/client';

type BackendState = 'checking' | 'available' | 'unavailable';
type AppView = 'inbox' | 'settings';

const backendState = ref<BackendState>('checking');
const items = ref<BookmarkItem[]>([]);
const tags = ref<Tag[]>([]);
const total = ref(0);
const loading = ref(false);
const errorMessage = ref('');
const searchQuery = ref('');
const statusFilter = ref<ItemStatus | ''>('');
const tagFilter = ref('');
const sort = ref<ItemSort>('importedAt:desc');
const newTagName = ref('');
const chromeProfilePath = ref('');
const openRouterApiKey = ref('');
const openRouterConfigured = ref(false);
const openRouterModel = ref('');
const syncStatus = ref<SyncStatus | null>(null);
const syncInProgress = ref(false);
const summaryDrafts = ref<Record<string, string>>({});
const aiBusyItemId = ref('');
const aiErrorMessage = ref('');
const tagSuggestionsByItemId = ref<Record<string, TagSuggestion[]>>({});
const tagSearchByItemId = ref<Record<string, string>>({});
const expandedItemIds = ref<string[]>([]);
const currentView = ref<AppView>(viewFromPath(currentPath()));

const selectedTagId = computed(() => tagFilter.value || undefined);

onMounted(async () => {
  window.addEventListener('popstate', handlePopState);
  await checkBackend();
  if (backendState.value === 'available') {
    await loadInitialData();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
});

async function checkBackend(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_PATH}/health`);
    const body = (await response.json()) as HealthResponse;
    backendState.value = response.ok && body.status === 'ok' ? 'available' : 'unavailable';
  } catch {
    backendState.value = 'unavailable';
  }
}

async function loadInitialData(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [itemList, tagList, settings, status] = await Promise.all([
      fetchItems({ sort: sort.value }),
      fetchTags(),
      fetchSettings(),
      fetchSyncStatus()
    ]);
    items.value = itemList.items;
    total.value = itemList.total;
    tags.value = tagList.tags;
    chromeProfilePath.value = settings.chromeProfilePath ?? '';
    openRouterConfigured.value = settings.openRouter.apiKeyConfigured;
    openRouterModel.value = settings.openRouter.model ?? 'openai/gpt-5-mini';
    syncStatus.value = status;
    syncSummaryDrafts();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load inbox.';
  } finally {
    loading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    const itemList = await fetchItems({
      q: searchQuery.value.trim() || undefined,
      sort: sort.value,
      status: statusFilter.value,
      tagIds: selectedTagId.value ? [selectedTagId.value] : undefined
    });
    items.value = itemList.items;
    total.value = itemList.total;
    syncSummaryDrafts();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to apply filters.';
  } finally {
    loading.value = false;
  }
}

async function setStatus(item: BookmarkItem, status: ItemStatus): Promise<void> {
  const updated = await updateItemStatus(item.id, status);
  replaceItem(updated);
}

async function createGlobalTag(): Promise<void> {
  if (!newTagName.value.trim()) return;
  const tag = await createTag(newTagName.value.trim());
  tags.value = [...tags.value, tag].sort((left, right) => left.name.localeCompare(right.name));
  newTagName.value = '';
}

async function detachTag(item: BookmarkItem, tagId: string): Promise<void> {
  try {
    await removeTagFromItem(item.id, tagId);
    replaceItem({ ...item, tags: item.tags.filter((tag) => tag.id !== tagId) });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to remove tag.';
  }
}

async function saveSummary(item: BookmarkItem): Promise<void> {
  const summary = await updateSummary(item.id, summaryDrafts.value[item.id] ?? '');
  replaceItem({ ...item, summary });
}

async function saveProfilePath(): Promise<void> {
  const settings = await saveChromeProfilePath(chromeProfilePath.value);
  chromeProfilePath.value = settings.chromeProfilePath ?? chromeProfilePath.value;
}

async function saveAiSettings(): Promise<void> {
  const openRouterPatch = {
    ...(openRouterApiKey.value.trim() ? { apiKey: openRouterApiKey.value.trim() } : {}),
    model: openRouterModel.value
  };
  const settings = await saveOpenRouterSettings(openRouterPatch);
  openRouterConfigured.value = settings.openRouter.apiKeyConfigured;
  openRouterModel.value = settings.openRouter.model ?? openRouterModel.value;
  openRouterApiKey.value = '';
}

async function syncBookmarks(): Promise<void> {
  syncInProgress.value = true;
  errorMessage.value = '';
  try {
    const startedStatus = await startBookmarkSync();
    syncStatus.value = startedStatus;
    const finalStatus =
      startedStatus.status === 'running' ? await waitForSyncCompletion() : startedStatus;
    syncStatus.value = finalStatus;

    if (finalStatus.status === 'succeeded') {
      await applyFilters();
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to sync bookmarks.';
  } finally {
    syncInProgress.value = false;
  }
}

function replaceItem(updated: BookmarkItem): void {
  items.value = items.value.map((item) => (item.id === updated.id ? updated : item));
  syncSummaryDrafts();
}

function isItemExpanded(itemId: string): boolean {
  return expandedItemIds.value.includes(itemId);
}

function toggleItemExpanded(itemId: string): void {
  if (isItemExpanded(itemId)) {
    expandedItemIds.value = expandedItemIds.value.filter((id) => id !== itemId);
    return;
  }
  expandedItemIds.value = [...expandedItemIds.value, itemId];
}

async function generateAiSummary(item: BookmarkItem): Promise<void> {
  aiBusyItemId.value = item.id;
  aiErrorMessage.value = '';
  try {
    await saveAiSettings();
    const summary = await generateSummary(item.id);
    replaceItem({ ...item, summary });
    summaryDrafts.value = {
      ...summaryDrafts.value,
      [item.id]: summary.content
    };
  } catch (error) {
    aiErrorMessage.value = error instanceof Error ? error.message : 'Failed to generate summary.';
  } finally {
    aiBusyItemId.value = '';
  }
}

async function loadTagSuggestions(item: BookmarkItem): Promise<void> {
  aiBusyItemId.value = item.id;
  aiErrorMessage.value = '';
  try {
    await saveAiSettings();
    const result = await suggestTags(item.id);
    tagSuggestionsByItemId.value = {
      ...tagSuggestionsByItemId.value,
      [item.id]: result.suggestions
    };
  } catch (error) {
    aiErrorMessage.value = error instanceof Error ? error.message : 'Failed to suggest tags.';
  } finally {
    aiBusyItemId.value = '';
  }
}

async function applySuggestedTag(item: BookmarkItem, suggestion: TagSuggestion): Promise<void> {
  aiErrorMessage.value = '';
  try {
    const existingTag = tags.value.find(
      (tag) => tag.name.toLowerCase() === suggestion.name.toLowerCase()
    );
    const tag = existingTag ?? (await createTag(suggestion.name));
    if (!existingTag) {
      tags.value = [...tags.value, tag].sort((left, right) => left.name.localeCompare(right.name));
    }
    const result = await attachTagToItem(item.id, tag.id);
    replaceItem({ ...item, tags: result.tags });
    tagSuggestionsByItemId.value = {
      ...tagSuggestionsByItemId.value,
      [item.id]: (tagSuggestionsByItemId.value[item.id] ?? []).filter(
        (current) => current.name !== suggestion.name
      )
    };
  } catch (error) {
    aiErrorMessage.value = error instanceof Error ? error.message : 'Failed to apply suggested tag.';
  }
}

async function attachExistingTag(item: BookmarkItem, tag: Tag): Promise<void> {
  errorMessage.value = '';
  try {
    const result = await attachTagToItem(item.id, tag.id);
    replaceItem({ ...item, tags: result.tags });
    tagSearchByItemId.value = {
      ...tagSearchByItemId.value,
      [item.id]: ''
    };
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to attach tag.';
  }
}

function matchingTagsForItem(item: BookmarkItem): Tag[] {
  const query = (tagSearchByItemId.value[item.id] ?? '').trim().toLowerCase();
  if (!query) return [];

  const attachedIds = new Set(item.tags.map((tag) => tag.id));
  return tags.value
    .filter((tag) => !attachedIds.has(tag.id))
    .filter((tag) => tag.name.toLowerCase().includes(query))
    .slice(0, 8);
}

function syncSummaryDrafts(): void {
  const drafts: Record<string, string> = {};
  for (const item of items.value) {
    drafts[item.id] = summaryDrafts.value[item.id] ?? item.summary?.content ?? '';
  }
  summaryDrafts.value = drafts;
  expandedItemIds.value = expandedItemIds.value.filter((id) => items.value.some((item) => item.id === id));
}

async function waitForSyncCompletion(): Promise<SyncStatus> {
  let latest = syncStatus.value;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    latest = await fetchSyncStatus();
    if (latest.status !== 'running') {
      return latest;
    }
    await delay(300);
  }
  return latest ?? fetchSyncStatus();
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function currentPath(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

function viewFromPath(pathname: string): AppView {
  return pathname === '/settings' ? 'settings' : 'inbox';
}

function pathFromView(view: AppView): string {
  return view === 'settings' ? '/settings' : '/';
}

function navigateTo(view: AppView): void {
  currentView.value = view;
  const nextPath = pathFromView(view);
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath);
  }
}

function handlePopState(): void {
  currentView.value = viewFromPath(window.location.pathname);
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">My Web Bookmarks</p>
        <h1>{{ currentView === 'inbox' ? 'Reading inbox' : 'Settings' }}</h1>
      </div>
      <div class="topbar-right">
        <nav class="view-switch" aria-label="App sections">
          <button
            aria-label="Open inbox view"
            type="button"
            :class="{ 'status-active': currentView === 'inbox' }"
            @click="navigateTo('inbox')"
          >
            Inbox
          </button>
          <button
            aria-label="Open settings view"
            type="button"
            :class="{ 'status-active': currentView === 'settings' }"
            @click="navigateTo('settings')"
          >
            Settings
          </button>
        </nav>
        <p class="status-line">Backend: {{ backendState }}</p>
      </div>
    </header>

    <p v-if="loading" class="muted">Loading inbox...</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="aiErrorMessage" class="error">{{ aiErrorMessage }}</p>

    <section v-if="currentView === 'inbox'" class="toolbar" aria-label="Inbox controls">
      <input v-model="searchQuery" aria-label="Search bookmarks" placeholder="Search title, URL, domain, summary" />
      <select v-model="statusFilter" aria-label="Status filter">
        <option value="">All statuses</option>
        <option value="new">New</option>
        <option value="read">Read</option>
        <option value="archived">Archived</option>
      </select>
      <select v-model="tagFilter" aria-label="Tag filter">
        <option value="">All tags</option>
        <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
      </select>
      <select v-model="sort" aria-label="Sort items">
        <option value="importedAt:desc">Newest imported</option>
        <option value="importedAt:asc">Oldest imported</option>
        <option value="updatedAt:desc">Recently updated</option>
        <option value="updatedAt:asc">Least recently updated</option>
      </select>
      <button aria-label="Apply filters" type="button" @click="applyFilters">Apply</button>
    </section>

    <section v-if="currentView === 'inbox'" class="sync-band" aria-label="Sync controls">
      <button aria-label="Sync bookmarks" type="button" :disabled="syncInProgress" @click="syncBookmarks">Sync</button>
      <span v-if="syncStatus" class="sync-status">
        Sync: {{ syncStatus.status }} | +{{ syncStatus.importedCount }} / ~{{ syncStatus.updatedCount }} / skipped {{ syncStatus.skippedCount }}
      </span>
      <span v-if="syncStatus?.error" class="error sync-error">{{ syncStatus.error }}</span>
    </section>

    <section v-if="currentView === 'inbox'" class="summary-row" aria-label="Inbox summary">
      <strong>{{ total }}</strong>
      <span>items</span>
      <input v-model="newTagName" aria-label="New tag name" placeholder="New tag" />
      <button aria-label="Create tag" type="button" @click="createGlobalTag">Create tag</button>
    </section>

    <section v-if="currentView === 'inbox' && !loading && items.length === 0" class="empty">
      No bookmarks match the current view.
    </section>

    <section v-if="currentView === 'inbox'" class="item-list" aria-label="Bookmark list">
      <article v-for="item in items" :key="item.id" class="item-card">
        <button
          class="item-row"
          type="button"
          :aria-label="`Toggle details for ${item.title}`"
          :aria-expanded="isItemExpanded(item.id)"
          @click="toggleItemExpanded(item.id)"
        >
          <div class="item-main">
            <p class="domain">{{ item.domain }}</p>
            <h2>{{ item.title }}</h2>
            <p class="url">{{ item.url }}</p>
          </div>
          <div class="row-meta">
            <span class="status-chip">{{ item.status }}</span>
            <span class="meta">Imported: {{ item.importedAt }}</span>
            <span class="expand-indicator">{{ isItemExpanded(item.id) ? 'Hide' : 'Details' }}</span>
          </div>
        </button>

        <div v-if="isItemExpanded(item.id)" class="item-details">
          <a :href="item.url" target="_blank" rel="noreferrer">Open original</a>

          <div class="actions">
            <button
              :aria-label="`Mark ${item.title} as new`"
              :class="{ 'status-active': item.status === 'new' }"
              type="button"
              @click="setStatus(item, 'new')"
            >
              New
            </button>
            <button
              :aria-label="`Mark ${item.title} as read`"
              :class="{ 'status-active': item.status === 'read' }"
              type="button"
              @click="setStatus(item, 'read')"
            >
              Read
            </button>
            <button
              :aria-label="`Archive ${item.title}`"
              :class="{ 'status-active': item.status === 'archived' }"
              type="button"
              @click="setStatus(item, 'archived')"
            >
              Archive
            </button>
          </div>

          <div class="summary-editor">
            <textarea v-model="summaryDrafts[item.id]" :aria-label="`Summary for ${item.title}`" rows="4" />
            <div class="actions">
              <button :aria-label="`Save summary for ${item.title}`" type="button" @click="saveSummary(item)">Save summary</button>
              <button
                :aria-label="`Generate summary for ${item.title}`"
                type="button"
                :disabled="aiBusyItemId === item.id"
                @click="generateAiSummary(item)"
              >
                {{ item.summary ? 'Regenerate summary' : 'Generate summary' }}
              </button>
              <button
                :aria-label="`Suggest tags for ${item.title}`"
                type="button"
                :disabled="aiBusyItemId === item.id"
                @click="loadTagSuggestions(item)"
              >
                Suggest tags
              </button>
            </div>
            <div v-if="tagSuggestionsByItemId[item.id]?.length" class="suggestions">
              <button
                v-for="suggestion in tagSuggestionsByItemId[item.id]"
                :key="suggestion.name"
                :aria-label="`Apply suggested tag ${suggestion.name} to ${item.title}`"
                type="button"
                @click="applySuggestedTag(item, suggestion)"
              >
                {{ suggestion.name }}
              </button>
            </div>
            <div class="tag-editor" :aria-label="`Tags for ${item.title}`">
              <div class="tags">
                <span v-for="tag in item.tags" :key="tag.id">
                  {{ tag.name }}
                  <button :aria-label="`Remove ${tag.name} from ${item.title}`" type="button" @click="detachTag(item, tag.id)">x</button>
                </span>
              </div>
              <input
                v-model="tagSearchByItemId[item.id]"
                :aria-label="`Find tag for ${item.title}`"
                placeholder="Find existing tag"
              />
              <div v-if="matchingTagsForItem(item).length" class="tag-suggestions">
                <button
                  v-for="tag in matchingTagsForItem(item)"
                  :key="tag.id"
                  :aria-label="`Apply existing tag ${tag.name} to ${item.title}`"
                  type="button"
                  @click="attachExistingTag(item, tag)"
                >
                  {{ tag.name }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section v-if="currentView === 'settings'" class="settings-view" aria-label="Application settings">
      <section class="settings-band" aria-label="Sync settings">
        <input v-model="chromeProfilePath" aria-label="Chrome profile path" placeholder="Chrome profile path" />
        <button aria-label="Save Chrome profile path" type="button" @click="saveProfilePath">Save path</button>
      </section>

      <section class="settings-band" aria-label="AI settings">
        <input
          v-model="openRouterApiKey"
          aria-label="OpenRouter API key"
          placeholder="OpenRouter API key"
          type="password"
        />
        <input v-model="openRouterModel" aria-label="OpenRouter model" placeholder="OpenRouter model" />
        <button aria-label="Save OpenRouter settings" type="button" @click="saveAiSettings">Save AI</button>
        <span class="sync-status">OpenRouter: {{ openRouterConfigured ? 'configured' : 'not configured' }}</span>
      </section>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  background: #f7f8fb;
  color: #18212c;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  min-height: 100vh;
  padding: 24px;
}

.topbar,
.toolbar,
.sync-band,
.settings-band,
.summary-row {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin: 0 auto 16px;
  max-width: 1180px;
}

.toolbar,
.sync-band,
.settings-band,
.summary-row {
  justify-content: flex-start;
}

.topbar-right {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-switch {
  display: flex;
  gap: 8px;
}

.eyebrow,
.domain,
.meta,
.muted {
  color: #5d6978;
  margin: 0;
}

h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 2.25rem;
}

h2 {
  font-size: 1.25rem;
}

input,
select,
textarea,
button {
  border: 1px solid #c9d1dc;
  border-radius: 6px;
  font: inherit;
}

input,
select,
textarea {
  background: #ffffff;
  padding: 9px 10px;
}

button {
  background: #233447;
  color: #ffffff;
  cursor: pointer;
  padding: 9px 12px;
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.toolbar input,
.settings-band input {
  min-width: min(360px, 100%);
}

.settings-view {
  margin: 0 auto;
  max-width: 1180px;
}

.sync-status {
  color: #334155;
}

.status-current {
  color: #18743a;
  font-weight: 700;
}

.status-active {
  background: #18743a;
  border-color: #18743a;
}

.error {
  color: #a31919;
  margin: 0 auto 16px;
  max-width: 1180px;
}

.sync-error {
  margin: 0;
}

.empty {
  margin: 32px auto;
  max-width: 1180px;
}

.item-list {
  display: grid;
  gap: 10px;
  margin: 0 auto;
  max-width: 1180px;
}

.item-card {
  background: #ffffff;
  border: 1px solid #dde3eb;
  border-radius: 8px;
  overflow: hidden;
}

.item-row {
  align-items: center;
  background: #ffffff;
  border: 0;
  border-radius: 0;
  color: inherit;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 14px 16px;
  text-align: left;
  width: 100%;
}

.item-main {
  min-width: 0;
}

.item-main h2 {
  font-size: 1rem;
  line-height: 1.3;
  margin: 2px 0;
}

.url {
  color: #405065;
  font-size: 0.9rem;
  margin: 0;
  overflow-wrap: anywhere;
}

.row-meta {
  align-items: flex-end;
  color: #5d6978;
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 4px;
}

.status-chip {
  background: #e8f0ff;
  border-radius: 999px;
  color: #214f8f;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 3px 8px;
  text-transform: capitalize;
}

.expand-indicator {
  color: #3f5774;
  font-weight: 600;
}

.item-details {
  border-top: 1px solid #e5eaf1;
  display: grid;
  gap: 12px;
  padding: 14px 16px 16px;
}

.actions,
.tags {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tags span {
  background: #e9eef5;
  border-radius: 999px;
  color: #243244;
  padding: 4px 8px;
}

.tags button {
  background: transparent;
  border: 0;
  color: #243244;
  padding: 0 0 0 6px;
}

.summary-editor {
  min-width: 0;
}

.summary-editor textarea {
  box-sizing: border-box;
  display: block;
  margin-bottom: 8px;
  width: 100%;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.tag-editor {
  border: 1px solid #d9e0ea;
  border-radius: 6px;
  margin-top: 12px;
  padding: 10px;
}

.tag-editor input {
  box-sizing: border-box;
  margin-top: 8px;
  width: 100%;
}

.tag-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

@media (max-width: 780px) {
  .topbar,
  .topbar-right,
  .toolbar,
  .sync-band,
  .settings-band,
  .summary-row,
  .item-row {
    align-items: stretch;
    display: flex;
    flex-direction: column;
  }

  .row-meta {
    align-items: flex-start;
  }
}
</style>
