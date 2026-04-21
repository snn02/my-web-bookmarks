import request from 'supertest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { createInMemoryDatabase, initializeDatabase } from '../../src/db/database';
import { createSettingsRepository } from '../../src/domain/settings/settings-repository';
import { createSyncRunRepository } from '../../src/domain/sync/sync-run-repository';

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureProfilePath = join(testDir, '..', 'fixtures', 'chrome-profile');

function createSyncApiTestContext() {
  const db = createInMemoryDatabase();
  initializeDatabase(db);

  return {
    app: createApp({ db }),
    settings: createSettingsRepository(db),
    syncRuns: createSyncRunRepository(db)
  };
}

describe('sync API', () => {
  it('starts bookmark sync asynchronously and returns the latest sync status', async () => {
    const { app, settings } = createSyncApiTestContext();
    settings.setChromeProfilePath(fixtureProfilePath);

    const startResponse = await request(app).post('/api/v1/sync/bookmarks').send({});
    expect(startResponse.status).toBe(202);
    expect(startResponse.body).toMatchObject({
      status: 'running',
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: null
    });

    const statusResponse = await waitForSucceededSyncStatus(app);
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body).toMatchObject({
      status: 'succeeded',
      importedCount: 2,
      updatedCount: 1,
      skippedCount: 1,
      error: null
    });
  });

  it('returns idle sync status before any sync has run', async () => {
    const { app } = createSyncApiTestContext();

    const response = await request(app).get('/api/v1/sync/status');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'idle',
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      error: null
    });
  });

  it('rejects sync start when a sync run is already active', async () => {
    const { app, syncRuns } = createSyncApiTestContext();
    syncRuns.startSyncRun('chrome_bookmark');

    const response = await request(app).post('/api/v1/sync/bookmarks').send({});

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('sync_already_running');
  });
});

async function waitForSucceededSyncStatus(app: Parameters<typeof request>[0]) {
  let latest = await request(app).get('/api/v1/sync/status');

  for (let attempt = 0; attempt < 10 && latest.body.status === 'running'; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    latest = await request(app).get('/api/v1/sync/status');
  }

  return latest;
}
