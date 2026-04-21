import { API_BASE_PATH, healthResponse } from '@my-web-bookmarks/shared';
import express, { type Express } from 'express';
import { createInMemoryDatabase, initializeDatabase, type AppDatabase } from './db/database';
import { createItemRepository, type ItemSort, type ItemStatus } from './domain/items/item-repository';
import { createSettingsRepository } from './domain/settings/settings-repository';
import { createSummaryRepository } from './domain/summaries/summary-repository';
import { createBookmarkSyncService } from './domain/sync/bookmark-sync-service';
import { createSyncRunRepository, type SyncRun } from './domain/sync/sync-run-repository';
import { createTagRepository } from './domain/tags/tag-repository';
import { sendApiError } from './http/errors';

export interface CreateAppOptions {
  db?: AppDatabase;
}

const ITEM_STATUSES = new Set<ItemStatus>(['new', 'read', 'archived']);
const ITEM_SORTS = new Set<ItemSort>([
  'importedAt:desc',
  'importedAt:asc',
  'updatedAt:desc',
  'updatedAt:asc'
]);

export function createApp(options: CreateAppOptions = {}): Express {
  const db = options.db ?? createInMemoryDatabase();
  initializeDatabase(db);

  const items = createItemRepository(db);
  const settings = createSettingsRepository(db);
  const summaries = createSummaryRepository(db);
  const syncRuns = createSyncRunRepository(db);
  const bookmarkSync = createBookmarkSyncService({ items, settings, syncRuns });
  const tags = createTagRepository(db);
  const app = express();

  app.use(express.json());

  app.get(`${API_BASE_PATH}/health`, (_request, response) => {
    response.status(200).json(healthResponse());
  });

  app.get(`${API_BASE_PATH}/items`, (request, response) => {
    const status = typeof request.query.status === 'string' ? request.query.status : undefined;
    if (status && !ITEM_STATUSES.has(status as ItemStatus)) {
      return sendApiError(response, 400, 'validation_error', 'Status value is not supported.', {
        field: 'status'
      });
    }

    const limit = clampIntegerQuery(request.query.limit, 50, 1, 200);
    const offset = clampIntegerQuery(request.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const sort = typeof request.query.sort === 'string' ? request.query.sort : undefined;
    if (sort && !ITEM_SORTS.has(sort as ItemSort)) {
      return sendApiError(response, 400, 'validation_error', 'Sort value is not supported.', {
        field: 'sort'
      });
    }
    const tagIds =
      typeof request.query.tagIds === 'string' && request.query.tagIds.trim()
        ? request.query.tagIds.split(',').map((tagId) => tagId.trim())
        : undefined;

    const result = items.listItems({
      limit,
      offset,
      q: typeof request.query.q === 'string' ? request.query.q : undefined,
      sort: sort as ItemSort | undefined,
      status: status as ItemStatus | undefined,
      tagIds
    });

    return response.status(200).json(result);
  });

  app.get(`${API_BASE_PATH}/items/:itemId`, (request, response) => {
    const item = items.getItem(request.params.itemId);
    if (!item) {
      return sendApiError(response, 404, 'not_found', 'Item was not found.');
    }
    return response.status(200).json(item);
  });

  app.patch(`${API_BASE_PATH}/items/:itemId`, (request, response) => {
    const bodyKeys = Object.keys(request.body ?? {});
    if (bodyKeys.length !== 1 || bodyKeys[0] !== 'status') {
      return sendApiError(
        response,
        400,
        'validation_error',
        'Only status can be updated through this endpoint.',
        { field: 'status' }
      );
    }

    const status = request.body.status;
    if (!ITEM_STATUSES.has(status)) {
      return sendApiError(response, 400, 'validation_error', 'Status value is not supported.', {
        field: 'status'
      });
    }

    try {
      return response.status(200).json(items.updateStatus(request.params.itemId, status));
    } catch {
      return sendApiError(response, 404, 'not_found', 'Item was not found.');
    }
  });

  app.get(`${API_BASE_PATH}/tags`, (_request, response) => {
    return response.status(200).json({ tags: tags.listTags() });
  });

  app.post(`${API_BASE_PATH}/tags`, (request, response) => {
    if (typeof request.body?.name !== 'string' || !request.body.name.trim()) {
      return sendApiError(response, 400, 'validation_error', 'Tag name is required.', {
        field: 'name'
      });
    }

    try {
      return response.status(201).json(tags.createTag(request.body.name));
    } catch {
      return sendApiError(response, 409, 'conflict', 'Tag already exists.');
    }
  });

  app.patch(`${API_BASE_PATH}/tags/:tagId`, (request, response) => {
    if (typeof request.body?.name !== 'string' || !request.body.name.trim()) {
      return sendApiError(response, 400, 'validation_error', 'Tag name is required.', {
        field: 'name'
      });
    }

    try {
      return response.status(200).json(tags.renameTag(request.params.tagId, request.body.name));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      return sendApiError(
        response,
        message.includes('already exists') ? 409 : 404,
        message.includes('already exists') ? 'conflict' : 'not_found',
        message.includes('already exists') ? 'Tag already exists.' : 'Tag was not found.'
      );
    }
  });

  app.delete(`${API_BASE_PATH}/tags/:tagId`, (request, response) => {
    tags.deleteTag(request.params.tagId);
    return response.status(204).send();
  });

  app.post(`${API_BASE_PATH}/items/:itemId/tags`, (request, response) => {
    if (typeof request.body?.tagId !== 'string' || !request.body.tagId.trim()) {
      return sendApiError(response, 400, 'validation_error', 'Tag id is required.', {
        field: 'tagId'
      });
    }

    if (!items.getItem(request.params.itemId)) {
      return sendApiError(response, 404, 'not_found', 'Item was not found.');
    }

    if (!tags.getTag(request.body.tagId)) {
      return sendApiError(response, 404, 'not_found', 'Tag was not found.');
    }

    tags.attachTagToItem(request.params.itemId, request.body.tagId);
    return response.status(200).json({
      id: request.params.itemId,
      tags: items.getItem(request.params.itemId)?.tags ?? []
    });
  });

  app.delete(`${API_BASE_PATH}/items/:itemId/tags/:tagId`, (request, response) => {
    tags.detachTagFromItem(request.params.itemId, request.params.tagId);
    return response.status(204).send();
  });

  app.get(`${API_BASE_PATH}/items/:itemId/summary`, (request, response) => {
    const summary = summaries.getSummary(request.params.itemId);
    if (!summary) {
      return sendApiError(response, 404, 'not_found', 'Summary was not found.');
    }
    return response.status(200).json(summary);
  });

  app.post(`${API_BASE_PATH}/items/:itemId/summary`, (request, response) => {
    if (!items.getItem(request.params.itemId)) {
      return sendApiError(response, 404, 'not_found', 'Item was not found.');
    }
    return sendApiError(response, 409, 'ai_not_configured', 'OpenRouter is not configured.');
  });

  app.patch(`${API_BASE_PATH}/items/:itemId/summary`, (request, response) => {
    if (typeof request.body?.content !== 'string') {
      return sendApiError(response, 400, 'validation_error', 'Summary content is required.', {
        field: 'content'
      });
    }

    try {
      return response
        .status(200)
        .json(summaries.updateSummaryManually(request.params.itemId, request.body.content));
    } catch {
      return sendApiError(response, 404, 'not_found', 'Summary was not found.');
    }
  });

  app.post(`${API_BASE_PATH}/items/:itemId/tag-suggestions`, (request, response) => {
    if (!items.getItem(request.params.itemId)) {
      return sendApiError(response, 404, 'not_found', 'Item was not found.');
    }
    return sendApiError(response, 409, 'ai_not_configured', 'OpenRouter is not configured.');
  });

  app.get(`${API_BASE_PATH}/settings`, (_request, response) => {
    return response.status(200).json(settings.getPublicSettings());
  });

  app.patch(`${API_BASE_PATH}/settings`, (request, response) => {
    const openRouter = request.body?.openRouter;
    if (openRouter !== undefined) {
      if (typeof openRouter !== 'object' || openRouter === null) {
        return sendApiError(response, 400, 'validation_error', 'OpenRouter settings are invalid.', {
          field: 'openRouter'
        });
      }

      settings.updateOpenRouterSettings({
        apiKey: typeof openRouter.apiKey === 'string' ? openRouter.apiKey : undefined,
        model: typeof openRouter.model === 'string' ? openRouter.model : undefined
      });
    }

    if (typeof request.body?.chromeProfilePath === 'string') {
      settings.setChromeProfilePath(request.body.chromeProfilePath);
    }

    return response.status(200).json(settings.getPublicSettings());
  });

  app.post(`${API_BASE_PATH}/sync/bookmarks`, (_request, response) => {
    if (syncRuns.hasActiveSyncRun('chrome_bookmark')) {
      return sendApiError(
        response,
        409,
        'sync_already_running',
        'A bookmark sync is already running.'
      );
    }

    return response.status(202).json(toSyncStatusResponse(bookmarkSync.startBookmarkSync()));
  });

  app.get(`${API_BASE_PATH}/sync/status`, (_request, response) => {
    const latest = syncRuns.getLatestSyncRun();
    return response.status(200).json(latest ? toSyncStatusResponse(latest) : idleSyncStatus());
  });

  return app;
}

function idleSyncStatus() {
  return {
    error: null,
    finishedAt: null,
    importedCount: 0,
    skippedCount: 0,
    startedAt: null,
    status: 'idle',
    updatedCount: 0
  };
}

function toSyncStatusResponse(run: SyncRun) {
  return {
    error: run.errorMessage,
    finishedAt: run.finishedAt,
    importedCount: run.importedCount,
    skippedCount: run.skippedCount,
    startedAt: run.startedAt,
    status: run.status === 'success' ? 'succeeded' : run.status,
    updatedCount: run.updatedCount
  };
}

function clampIntegerQuery(
  value: unknown,
  defaultValue: number,
  minValue: number,
  maxValue: number
): number {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsed, minValue), maxValue);
}
