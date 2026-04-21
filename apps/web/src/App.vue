<script setup lang="ts">
import { API_BASE_PATH, type HealthResponse } from '@my-web-bookmarks/shared';
import { computed, onMounted, ref } from 'vue';
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

const selectedTagId = computed(() => tagFilter.value || undefined);

onMounted(async () => {
  await checkBackend();
  if (backendState.value === 'available') {
    await loadInitialData();
  }
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

async function addTagToFirstItem(): Promise<void> {
  if (!newTagName.value.trim() || !items.value[0]) return;
  const tag = await createTag(newTagName.value.trim());
  tags.value = [...tags.value, tag].sort((left, right) => left.name.localeCompare(right.name));
  const result = await attachTagToItem(items.value[0].id, tag.id);
  replaceItem({ ...items.value[0], tags: result.tags });
  newTagName.value = '';
}

async function detachTag(item: BookmarkItem, tagId: string): Promise<void> {
  await removeTagFromItem(item.id, tagId);
  replaceItem({ ...item, tags: item.tags.filter((tag) => tag.id !== tagId) });
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
    if (chromeProfilePath.value.trim()) {
      const settings = await saveChromeProfilePath(chromeProfilePath.value);
      chromeProfilePath.value = settings.chromeProfilePath ?? chromeProfilePath.value;
    }

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

async function generateAiSummary(item: BookmarkItem): Promise<void> {
  aiBusyItemId.value = item.id;
  aiErrorMessage.value = '';
  try {
    await saveAiSettings();
    const summary = await generateSummary(item.id);
    replaceItem({ ...item, summary });
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

function syncSummaryDrafts(): void {
  const drafts: Record<string, string> = {};
  for (const item of items.value) {
    drafts[item.id] = summaryDrafts.value[item.id] ?? item.summary?.content ?? '';
  }
  summaryDrafts.value = drafts;
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
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">My Web Bookmarks</p>
        <h1>Reading inbox</h1>
      </div>
      <p class="status-line">Backend: {{ backendState }}</p>
    </header>

    <section class="toolbar" aria-label="Inbox controls">
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

    <section class="settings-band" aria-label="Sync settings">
      <input v-model="chromeProfilePath" aria-label="Chrome profile path" placeholder="Chrome profile path" />
      <button aria-label="Save Chrome profile path" type="button" @click="saveProfilePath">Save path</button>
      <button aria-label="Sync bookmarks" type="button" :disabled="syncInProgress" @click="syncBookmarks">Sync</button>
      <span v-if="syncStatus" class="sync-status">
        Sync: {{ syncStatus.status }} | +{{ syncStatus.importedCount }} / ~{{ syncStatus.updatedCount }} / skipped {{ syncStatus.skippedCount }}
      </span>
      <span v-if="syncStatus?.error" class="error sync-error">{{ syncStatus.error }}</span>
    </section>

    <section class="settings-band" aria-label="AI settings">
      <input v-model="openRouterApiKey" aria-label="OpenRouter API key" placeholder="OpenRouter API key" type="password" />
      <input v-model="openRouterModel" aria-label="OpenRouter model" placeholder="OpenRouter model" />
      <button aria-label="Save OpenRouter settings" type="button" @click="saveAiSettings">Save AI</button>
      <span class="sync-status">OpenRouter: {{ openRouterConfigured ? 'configured' : 'not configured' }}</span>
    </section>

    <p v-if="loading" class="muted">Loading inbox...</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="aiErrorMessage" class="error">{{ aiErrorMessage }}</p>

    <section class="summary-row" aria-label="Inbox summary">
      <strong>{{ total }}</strong>
      <span>items</span>
      <input v-model="newTagName" aria-label="New tag name" placeholder="New tag" />
      <button aria-label="Create tag" type="button" @click="addTagToFirstItem">Create tag</button>
    </section>

    <section v-if="!loading && items.length === 0" class="empty">No bookmarks match the current view.</section>

    <section class="item-list" aria-label="Bookmark list">
      <article v-for="item in items" :key="item.id" class="item-card">
        <div class="item-main">
          <p class="domain">{{ item.domain }}</p>
          <h2>{{ item.title }}</h2>
          <a :href="item.url" target="_blank" rel="noreferrer">Open original</a>
          <p class="url">{{ item.url }}</p>
          <p class="meta">
            Status: <span class="status-current">{{ item.status }}</span> | Imported: {{ item.importedAt }}
          </p>
        </div>

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

        <div class="tags">
          <span v-for="tag in item.tags" :key="tag.id">
            {{ tag.name }}
            <button :aria-label="`Remove ${tag.name} from ${item.title}`" type="button" @click="detachTag(item, tag.id)">x</button>
          </span>
        </div>

        <div class="summary-editor">
          <p v-if="item.summary" class="summary-preview">{{ item.summary.content }}</p>
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
        </div>
      </article>
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
.settings-band,
.summary-row {
  justify-content: flex-start;
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
  gap: 14px;
  margin: 0 auto;
  max-width: 1180px;
}

.item-card {
  background: #ffffff;
  border: 1px solid #dde3eb;
  border-radius: 8px;
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 18px;
}

.item-main {
  min-width: 0;
}

.url {
  color: #405065;
  overflow-wrap: anywhere;
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
  grid-column: 1 / -1;
}

.summary-preview {
  color: #334155;
  margin: 0 0 8px;
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

@media (max-width: 780px) {
  .topbar,
  .toolbar,
  .settings-band,
  .summary-row,
  .item-card {
    align-items: stretch;
    display: flex;
    flex-direction: column;
  }
}
</style>
