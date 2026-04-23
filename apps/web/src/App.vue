<script setup lang="ts">
import {
  API_BASE_PATH,
  getSortedModelProfiles,
  type HealthResponse
} from '@my-web-bookmarks/shared';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
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
type OperationPhase = 'idle' | 'running' | 'success' | 'failure';
type NoticeType = 'success' | 'error';
type ItemOperation = 'saveSummary' | 'generateSummary' | 'suggestTags';

interface ItemOperationState {
  saveSummary: OperationPhase;
  generateSummary: OperationPhase;
  suggestTags: OperationPhase;
}

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
const openRouterSummaryPrompt = ref('');
const openRouterTagsPrompt = ref('');
const syncStatus = ref<SyncStatus | null>(null);
const syncInProgress = ref(false);
const syncPhase = ref<OperationPhase>('idle');
const summaryDrafts = ref<Record<string, string>>({});
const aiBusyItemId = ref('');
const aiErrorMessage = ref('');
const tagSuggestionsByItemId = ref<Record<string, TagSuggestion[]>>({});
const tagSearchByItemId = ref<Record<string, string>>({});
const expandedItemIds = ref<string[]>([]);
const currentView = ref<AppView>(viewFromPath(currentPath()));
const itemOperationStateById = ref<Record<string, ItemOperationState>>({});
const notice = ref<{ type: NoticeType; message: string } | null>(null);
let noticeTimer: number | undefined;
const modelProfiles = getSortedModelProfiles();
const modelIds = new Set(modelProfiles.map((profile) => profile.id));

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
  if (noticeTimer !== undefined) {
    window.clearTimeout(noticeTimer);
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
    openRouterModel.value = normalizeModelSelection(settings.openRouter.model);
    openRouterSummaryPrompt.value = settings.openRouter.summaryPrompt;
    openRouterTagsPrompt.value = settings.openRouter.tagsPrompt;
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
  try {
    const updated = await updateItemStatus(item.id, status);
    replaceItem(updated);
    showNotice('success', `Status updated: ${status}.`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to update status.';
    showNotice('error', 'Status update failed.');
  }
}

async function createGlobalTag(): Promise<void> {
  if (!newTagName.value.trim()) return;
  try {
    const tag = await createTag(newTagName.value.trim());
    tags.value = [...tags.value, tag].sort((left, right) => left.name.localeCompare(right.name));
    newTagName.value = '';
    showNotice('success', `Tag created: ${tag.name}.`);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to create tag.';
    showNotice('error', 'Tag creation failed.');
  }
}

async function detachTag(item: BookmarkItem, tagId: string): Promise<void> {
  try {
    await removeTagFromItem(item.id, tagId);
    replaceItem({ ...item, tags: item.tags.filter((tag) => tag.id !== tagId) });
    showNotice('success', 'Tag removed from item.');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to remove tag.';
    showNotice('error', 'Removing tag failed.');
  }
}

async function saveSummary(item: BookmarkItem): Promise<void> {
  setItemOperationPhase(item.id, 'saveSummary', 'running');
  try {
    const summary = await updateSummary(item.id, summaryDrafts.value[item.id] ?? '');
    replaceItem({ ...item, summary });
    setItemOperationPhase(item.id, 'saveSummary', 'success');
    showNotice('success', 'Summary saved.');
  } catch (error) {
    setItemOperationPhase(item.id, 'saveSummary', 'failure');
    errorMessage.value = error instanceof Error ? error.message : 'Failed to save summary.';
    showNotice('error', 'Saving summary failed.');
  }
}

async function saveProfilePath(): Promise<void> {
  try {
    const settings = await saveChromeProfilePath(chromeProfilePath.value);
    chromeProfilePath.value = settings.chromeProfilePath ?? chromeProfilePath.value;
    showNotice('success', 'Chrome profile path saved.');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to save profile path.';
    showNotice('error', 'Saving profile path failed.');
  }
}

async function saveAiSettings(): Promise<void> {
  try {
    const useAutoModel = openRouterModel.value === '';
    const openRouterPatch = {
      ...(openRouterApiKey.value.trim() ? { apiKey: openRouterApiKey.value.trim() } : {}),
      model: useAutoModel ? '' : openRouterModel.value,
      summaryPrompt: openRouterSummaryPrompt.value.trim() ? openRouterSummaryPrompt.value : '',
      tagsPrompt: openRouterTagsPrompt.value.trim() ? openRouterTagsPrompt.value : ''
    };
    const settings = await saveOpenRouterSettings(openRouterPatch);
    openRouterConfigured.value = settings.openRouter.apiKeyConfigured;
    openRouterModel.value = useAutoModel ? '' : normalizeModelSelection(settings.openRouter.model);
    openRouterSummaryPrompt.value = settings.openRouter.summaryPrompt;
    openRouterTagsPrompt.value = settings.openRouter.tagsPrompt;
    openRouterApiKey.value = '';
    showNotice('success', 'AI settings saved.');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to save AI settings.';
    showNotice('error', 'Saving AI settings failed.');
    throw error;
  }
}

function normalizeModelSelection(model: string): string {
  return modelIds.has(model) ? model : '';
}

async function syncBookmarks(): Promise<void> {
  syncInProgress.value = true;
  syncPhase.value = 'running';
  errorMessage.value = '';
  try {
    const startedStatus = await startBookmarkSync();
    syncStatus.value = startedStatus;
    const finalStatus =
      startedStatus.status === 'running' ? await waitForSyncCompletion() : startedStatus;
    syncStatus.value = finalStatus;

    if (finalStatus.status === 'succeeded') {
      await applyFilters();
      syncPhase.value = 'success';
      showNotice('success', 'Bookmark sync completed.');
    } else if (finalStatus.status === 'failed') {
      syncPhase.value = 'failure';
      showNotice('error', finalStatus.error ?? 'Bookmark sync failed.');
    } else {
      syncPhase.value = 'idle';
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to sync bookmarks.';
    syncPhase.value = 'failure';
    showNotice('error', 'Starting bookmark sync failed.');
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
  setItemOperationPhase(item.id, 'generateSummary', 'running');
  aiErrorMessage.value = '';
  try {
    await saveAiSettings();
    const summary = await generateSummary(item.id);
    replaceItem({ ...item, summary });
    summaryDrafts.value = {
      ...summaryDrafts.value,
      [item.id]: summary.content
    };
    setItemOperationPhase(item.id, 'generateSummary', 'success');
    showNotice('success', 'Summary generated.');
  } catch (error) {
    setItemOperationPhase(item.id, 'generateSummary', 'failure');
    aiErrorMessage.value = error instanceof Error ? error.message : 'Failed to generate summary.';
    showNotice('error', 'Generating summary failed.');
  } finally {
    aiBusyItemId.value = '';
  }
}

async function loadTagSuggestions(item: BookmarkItem): Promise<void> {
  aiBusyItemId.value = item.id;
  setItemOperationPhase(item.id, 'suggestTags', 'running');
  aiErrorMessage.value = '';
  try {
    await saveAiSettings();
    const result = await suggestTags(item.id);
    tagSuggestionsByItemId.value = {
      ...tagSuggestionsByItemId.value,
      [item.id]: result.suggestions
    };
    setItemOperationPhase(item.id, 'suggestTags', 'success');
    showNotice('success', 'Tag suggestions loaded.');
  } catch (error) {
    setItemOperationPhase(item.id, 'suggestTags', 'failure');
    aiErrorMessage.value = error instanceof Error ? error.message : 'Failed to suggest tags.';
    showNotice('error', 'Tag suggestion failed.');
  } finally {
    aiBusyItemId.value = '';
  }
}

async function applySuggestedTag(item: BookmarkItem, suggestion: TagSuggestion): Promise<void> {
  aiErrorMessage.value = '';
  try {
    const existingTag = tags.value.find(
      (tag) => normalizeTagName(tag.name) === normalizeTagName(suggestion.name)
    );
    const tag = existingTag ?? (await createTag(suggestion.name));
    if (!existingTag) {
      tags.value = [...tags.value, tag].sort((left, right) => left.name.localeCompare(right.name));
    }
    const result = await attachTagToItem(item.id, tag.id);
    replaceItem({ ...item, tags: result.tags });
    dismissSuggestedTag(item.id, suggestion.name);
  } catch (error) {
    aiErrorMessage.value = error instanceof Error ? error.message : 'Failed to apply suggested tag.';
    showNotice('error', 'Applying suggested tag failed.');
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
    showNotice('error', 'Attaching tag failed.');
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

function visibleTagSuggestionsForItem(item: BookmarkItem): TagSuggestion[] {
  const assignedNames = new Set(item.tags.map((tag) => normalizeTagName(tag.name)));
  return (tagSuggestionsByItemId.value[item.id] ?? []).filter(
    (suggestion) => !assignedNames.has(normalizeTagName(suggestion.name))
  );
}

function dismissSuggestedTag(itemId: string, suggestionName: string): void {
  const suggestionToDismiss = normalizeTagName(suggestionName);
  tagSuggestionsByItemId.value = {
    ...tagSuggestionsByItemId.value,
    [itemId]: (tagSuggestionsByItemId.value[itemId] ?? []).filter(
      (current) => normalizeTagName(current.name) !== suggestionToDismiss
    )
  };
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

function syncSummaryDrafts(): void {
  const drafts: Record<string, string> = {};
  for (const item of items.value) {
    drafts[item.id] = summaryDrafts.value[item.id] ?? item.summary?.content ?? '';
  }
  summaryDrafts.value = drafts;
  expandedItemIds.value = expandedItemIds.value.filter((id) => items.value.some((item) => item.id === id));
  const nextStates: Record<string, ItemOperationState> = {};
  for (const item of items.value) {
    nextStates[item.id] = itemOperationStateById.value[item.id] ?? createItemOperationState();
  }
  itemOperationStateById.value = nextStates;
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

function createItemOperationState(): ItemOperationState {
  return {
    saveSummary: 'idle',
    generateSummary: 'idle',
    suggestTags: 'idle'
  };
}

function itemOperationPhase(itemId: string, operation: ItemOperation): OperationPhase {
  return itemOperationStateById.value[itemId]?.[operation] ?? 'idle';
}

function setItemOperationPhase(itemId: string, operation: ItemOperation, phase: OperationPhase): void {
  const current = itemOperationStateById.value[itemId] ?? createItemOperationState();
  itemOperationStateById.value = {
    ...itemOperationStateById.value,
    [itemId]: {
      ...current,
      [operation]: phase
    }
  };
}

function showNotice(type: NoticeType, message: string): void {
  notice.value = { type, message };
  if (noticeTimer !== undefined) {
    window.clearTimeout(noticeTimer);
  }
  noticeTimer = window.setTimeout(() => {
    notice.value = null;
  }, 3000);
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
          <Button
            aria-label="Open inbox view"
            type="button"
            :class="{ 'status-active': currentView === 'inbox' }"
            @click="navigateTo('inbox')"
          >
            Inbox
          </Button>
          <Button
            aria-label="Open settings view"
            type="button"
            :class="{ 'status-active': currentView === 'settings' }"
            @click="navigateTo('settings')"
          >
            Settings
          </Button>
        </nav>
        <p class="status-line">Backend: {{ backendState }}</p>
      </div>
    </header>

    <p v-if="loading" class="muted">Loading inbox...</p>
    <p v-if="notice" :class="['notice', `notice-${notice.type}`]" role="status">{{ notice.message }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="aiErrorMessage" class="error">{{ aiErrorMessage }}</p>

    <section v-if="currentView === 'inbox'" class="toolbar" aria-label="Inbox controls">
      <InputText
        v-model="searchQuery"
        aria-label="Search bookmarks"
        placeholder="Search title, URL, domain, summary"
      />
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
      <Button aria-label="Apply filters" type="button" @click="applyFilters">Apply</Button>
    </section>

    <section v-if="currentView === 'inbox'" class="sync-band" aria-label="Sync controls">
      <Button aria-label="Sync bookmarks" type="button" :disabled="syncInProgress" @click="syncBookmarks">
        {{ syncInProgress ? 'Syncing...' : 'Sync' }}
      </Button>
      <span class="sync-phase" :class="`phase-${syncPhase}`">Lifecycle: {{ syncPhase }}</span>
      <span v-if="syncStatus" class="sync-status">
        Sync: {{ syncStatus.status }} | +{{ syncStatus.importedCount }} / ~{{ syncStatus.updatedCount }} / skipped {{ syncStatus.skippedCount }}
      </span>
      <span v-if="syncStatus?.error" class="error sync-error">{{ syncStatus.error }}</span>
    </section>

    <section v-if="currentView === 'inbox'" class="summary-row" aria-label="Inbox summary">
      <strong>{{ total }}</strong>
      <span>items</span>
      <InputText v-model="newTagName" aria-label="New tag name" placeholder="New tag" />
      <Button aria-label="Create tag" type="button" @click="createGlobalTag">Create tag</Button>
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
            <Button
              :aria-label="`Mark ${item.title} as new`"
              :class="{ 'status-active': item.status === 'new' }"
              type="button"
              @click="setStatus(item, 'new')"
            >
              New
            </Button>
            <Button
              :aria-label="`Mark ${item.title} as read`"
              :class="{ 'status-active': item.status === 'read' }"
              type="button"
              @click="setStatus(item, 'read')"
            >
              Read
            </Button>
            <Button
              :aria-label="`Archive ${item.title}`"
              :class="{ 'status-active': item.status === 'archived' }"
              type="button"
              @click="setStatus(item, 'archived')"
            >
              Archive
            </Button>
          </div>

          <div class="summary-editor">
            <Textarea v-model="summaryDrafts[item.id]" :aria-label="`Summary for ${item.title}`" rows="4" />
            <div class="actions">
              <Button :aria-label="`Save summary for ${item.title}`" type="button" @click="saveSummary(item)"
                >Save summary</Button
              >
              <Button
                :aria-label="`Generate summary for ${item.title}`"
                type="button"
                :disabled="aiBusyItemId === item.id"
                @click="generateAiSummary(item)"
              >
                {{
                  itemOperationPhase(item.id, 'generateSummary') === 'running'
                    ? 'Generating...'
                    : item.summary
                      ? 'Regenerate summary'
                      : 'Generate summary'
                }}
              </Button>
            </div>
            <div class="tag-editor" :aria-label="`Tags for ${item.title}`">
              <div class="tag-editor-controls">
                <Button
                  class="tag-editor-suggest-button"
                  :aria-label="`Suggest tags for ${item.title}`"
                  type="button"
                  severity="secondary"
                  variant="outlined"
                  :disabled="aiBusyItemId === item.id"
                  @click="loadTagSuggestions(item)"
                >
                  {{ itemOperationPhase(item.id, 'suggestTags') === 'running' ? 'Suggesting...' : 'Suggest tags' }}
                </Button>
                <InputText
                  v-model="tagSearchByItemId[item.id]"
                  class="tag-editor-search-input"
                  :aria-label="`Find tag for ${item.title}`"
                  placeholder="Find existing tag"
                />
              </div>
              <div class="tag-chip-list" :aria-label="`Assigned tags for ${item.title}`">
                <span v-for="tag in item.tags" :key="tag.id" class="tag-chip">
                  {{ tag.name }}
                  <button :aria-label="`Remove ${tag.name} from ${item.title}`" type="button" @click="detachTag(item, tag.id)">x</button>
                </span>
              </div>
              <div v-if="matchingTagsForItem(item).length" class="tag-chip-list tag-chip-list-search">
                <span v-for="tag in matchingTagsForItem(item)" :key="tag.id" class="tag-chip">
                  <button
                    :aria-label="`Apply existing tag ${tag.name} to ${item.title}`"
                    type="button"
                    @click="attachExistingTag(item, tag)"
                  >
                    {{ tag.name }}
                  </button>
                </span>
              </div>
              <div v-if="visibleTagSuggestionsForItem(item).length" class="tag-chip-list tag-chip-list-suggested">
                <span v-for="suggestion in visibleTagSuggestionsForItem(item)" :key="suggestion.name" class="tag-chip">
                  <button
                    :aria-label="`Apply suggested tag ${suggestion.name} to ${item.title}`"
                    type="button"
                    @click="applySuggestedTag(item, suggestion)"
                  >
                    {{ suggestion.name }}
                  </button>
                  <button
                    :aria-label="`Dismiss suggested tag ${suggestion.name} for ${item.title}`"
                    type="button"
                    @click="dismissSuggestedTag(item.id, suggestion.name)"
                  >
                    x
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section v-if="currentView === 'settings'" class="settings-view" aria-label="Application settings">
      <section class="settings-band" aria-label="Sync settings">
        <label class="field-stack">
          <span class="field-label">Google profile</span>
          <InputText
            v-model="chromeProfilePath"
            aria-label="Chrome profile path"
            placeholder="Chrome profile path"
          />
        </label>
        <Button aria-label="Save Chrome profile path" type="button" @click="saveProfilePath">Save path</Button>
      </section>

      <section class="settings-band" aria-label="AI settings">
        <label class="field-stack">
          <span class="field-label">API key</span>
          <InputText
            v-model="openRouterApiKey"
            aria-label="OpenRouter API key"
            placeholder="OpenRouter API key"
            type="password"
          />
        </label>
        <label class="field-stack">
          <span class="field-label">AI model</span>
          <select v-model="openRouterModel" aria-label="OpenRouter model">
            <option value="">Auto (best model)</option>
            <option
              v-for="profile in modelProfiles"
              :key="`model-${profile.id}`"
              :value="profile.id"
            >
              {{ `${profile.id} (${profile.rating}/5)` }}
            </option>
          </select>
        </label>
        <label class="field-stack field-stack-wide">
          <span class="field-label">Summary prompt</span>
          <Textarea
            v-model="openRouterSummaryPrompt"
            aria-label="OpenRouter summary prompt"
            rows="4"
          />
        </label>
        <label class="field-stack field-stack-wide">
          <span class="field-label">Tags prompt</span>
          <Textarea
            v-model="openRouterTagsPrompt"
            aria-label="OpenRouter tags prompt"
            rows="4"
          />
        </label>
        <Button aria-label="Save OpenRouter settings" type="button" @click="saveAiSettings">Save AI</Button>
        <span class="sync-status">OpenRouter: {{ openRouterConfigured ? 'configured' : 'not configured' }}</span>
      </section>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  --bg-canvas: #f8fafc;
  --bg-panel: #ffffff;
  --bg-subtle: #f8fafc;
  --text-strong: #0f172a;
  --text-main: #334155;
  --text-muted: #64748b;
  --line-main: #e2e8f0;
  --line-strong: #cbd5e1;
  --brand-main: #3b82f6;
  --brand-soft: #eff6ff;
  --ok-bg: #f0fdf4;
  --ok-text: #166534;
  --warn-bg: #fffbeb;
  --warn-text: #92400e;
  --danger-bg: #fff1f2;
  --danger-text: #9f1239;
  background:
    radial-gradient(circle at 0 0, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0) 30%),
    linear-gradient(#ffffff, #f8fafc);
  color: var(--text-main);
  font-family:
    "Manrope",
    "Segoe UI Variable",
    ui-sans-serif,
    system-ui,
    sans-serif;
  min-height: 100vh;
  padding: 20px;
}

.topbar,
.toolbar,
.sync-band,
.settings-band,
.summary-row {
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--line-main);
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin: 0 auto 14px;
  max-width: 1180px;
  padding: 14px 16px;
}

.toolbar,
.sync-band,
.settings-band,
.summary-row {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.settings-band {
  align-items: flex-end;
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
  color: var(--text-muted);
  margin: 0;
}

h1,
h2 {
  margin: 0;
  color: var(--text-strong);
}

h1 {
  font-size: clamp(1.6rem, 2.2vw, 2.1rem);
  letter-spacing: 0.01em;
}

h2 {
  font-size: 1.08rem;
}

.toolbar select,
.settings-band select {
  appearance: none;
  background: #ffffff;
  border: 1px solid var(--line-main);
  border-radius: 10px;
  color: var(--text-main);
  font: inherit;
  min-height: 40px;
  padding: 8px 10px;
}

:deep(.p-button) {
  background: var(--brand-main);
  border: 1px solid var(--brand-main);
  border-radius: 10px;
  box-shadow: none;
  color: #ffffff;
  font-weight: 600;
  min-height: 40px;
  padding: 0.55rem 0.9rem;
}

:deep(.p-button:hover) {
  background: #2563eb;
  border-color: #2563eb;
}

:deep(.p-inputtext),
:deep(.p-textarea) {
  background: #ffffff;
  border: 1px solid var(--line-main);
  border-radius: 10px;
  box-shadow: none;
  color: var(--text-main);
  min-height: 40px;
  padding: 0.55rem 0.75rem;
}

:deep(.p-inputtext:enabled:focus),
:deep(.p-textarea:enabled:focus) {
  border-color: var(--brand-main);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14);
}

.status-active :deep(.p-button),
:deep(.p-button.status-active) {
  background: var(--brand-soft);
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.toolbar input,
.settings-band input {
  min-width: min(360px, 100%);
}

.toolbar :deep(.p-inputtext),
.settings-band :deep(.p-inputtext) {
  min-width: min(360px, 100%);
}

.field-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: min(360px, 100%);
}

.field-stack-wide {
  flex: 1 1 100%;
}

.field-label {
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.settings-view {
  margin: 0 auto;
  max-width: 1180px;
}

.status-line {
  color: var(--text-muted);
  font-size: 0.88rem;
  margin: 0;
}

.sync-status {
  color: var(--text-muted);
}

.sync-phase {
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 10px;
}

.phase-idle {
  background: #f1f5f9;
  color: #334155;
}

.phase-running {
  background: var(--warn-bg);
  color: var(--warn-text);
}

.phase-success {
  background: var(--ok-bg);
  color: var(--ok-text);
}

.phase-failure {
  background: var(--danger-bg);
  color: var(--danger-text);
}

.status-current {
  color: #15803d;
  font-weight: 700;
}

.error {
  background: var(--danger-bg);
  border: 1px solid #fda4af;
  border-radius: 10px;
  color: var(--danger-text);
  margin: 0 auto 16px;
  max-width: 1180px;
  padding: 10px 12px;
}

.notice {
  border: 1px solid transparent;
  border-radius: 10px;
  margin: 0 auto 16px;
  max-width: 1180px;
  padding: 10px 13px;
}

.notice-success {
  background: var(--ok-bg);
  border-color: #86efac;
  color: var(--ok-text);
}

.notice-error {
  background: var(--danger-bg);
  border-color: #fda4af;
  color: var(--danger-text);
}

.sync-error {
  margin: 0;
}

.empty {
  background: #ffffff;
  border: 1px dashed var(--line-strong);
  border-radius: 14px;
  margin: 32px auto;
  max-width: 1180px;
  padding: 22px;
  text-align: center;
}

.item-list {
  display: grid;
  gap: 10px;
  margin: 0 auto;
  max-width: 1180px;
}

.item-card {
  background: var(--bg-panel);
  border: 1px solid var(--line-main);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
  overflow: hidden;
}

.item-row {
  align-items: center;
  background: transparent;
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

.item-row:hover {
  background: #f8fafc;
}

.item-main {
  min-width: 0;
}

.item-main h2 {
  color: var(--text-strong);
  font-size: 1.02rem;
  line-height: 1.3;
  margin: 2px 0;
}

.url {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin: 0;
  overflow-wrap: anywhere;
}

.row-meta {
  align-items: flex-end;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  gap: 4px;
}

.status-chip {
  background: #eff6ff;
  border-radius: 999px;
  color: #1d4ed8;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 3px 8px;
  text-transform: capitalize;
}

.expand-indicator {
  color: #2563eb;
  font-weight: 600;
}

.item-details {
  border-top: 1px solid var(--line-main);
  display: grid;
  gap: 12px;
  padding: 14px 16px 16px;
}

.item-details a {
  color: #2563eb;
}

.item-details a:hover {
  color: #1d4ed8;
}

.actions,
.tag-chip-list {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip {
  background: #f8fafc;
  border: 1px solid var(--line-main);
  border-radius: 999px;
  color: var(--text-main);
  display: inline-flex;
  font-size: 0.9rem;
  gap: 4px;
  line-height: 1.2;
  padding: 4px 8px;
}

.tag-chip button {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  font: inherit;
  margin: 0;
  padding: 0;
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

.tag-editor {
  background: var(--bg-subtle);
  border: 1px solid var(--line-main);
  border-radius: 10px;
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding: 10px;
}

.tag-editor-controls {
  align-items: stretch;
  display: flex;
  gap: 8px;
}

.tag-editor-suggest-button {
  white-space: nowrap;
}

.tag-editor-search-input {
  flex: 1;
}

:deep(.tag-editor-suggest-button.p-button) {
  background: var(--brand-main);
  border-color: var(--brand-main);
  color: #ffffff !important;
}

:deep(.tag-editor-suggest-button.p-button .p-button-label),
:deep(.tag-editor-suggest-button.p-button .p-button-icon) {
  color: #ffffff !important;
}

:deep(.tag-editor-suggest-button.p-button:hover) {
  background: #2563eb;
  border-color: #2563eb;
}

.tag-editor-controls :deep(.p-inputtext),
.tag-editor-controls :deep(.p-button) {
  min-height: 2.75rem;
}

.tag-chip-list-search,
.tag-chip-list-suggested {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip-list-search .tag-chip,
.tag-chip-list-suggested .tag-chip {
  background: #eef2ff;
  border-color: #c7d2fe;
}

@media (max-width: 780px) {
  .app-shell {
    padding: 16px 12px;
  }

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

  .tag-editor-controls {
    flex-direction: column;
  }
}
</style>
