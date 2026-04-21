import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { startDesktopApi } from '../../src/startup/start-desktop-api';
import type { AppLogger } from '../../src/logging/app-logger';

function createMemoryLogger() {
  const logs: Array<{ event: string; metadata?: Record<string, unknown> }> = [];
  const logger: AppLogger = {
    error: (event, metadata) => logs.push({ event, metadata }),
    info: (event, metadata) => logs.push({ event, metadata }),
    warn: (event, metadata) => logs.push({ event, metadata })
  };

  return { logger, logs };
}

describe('startDesktopApi', () => {
  it('logs database startup failures and does not start a server', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'my-web-bookmarks-startup-'));
    const { logger, logs } = createMemoryLogger();
    try {
      const result = startDesktopApi({
        databasePath: tempDir,
        logger,
        port: 0
      });

      expect(result.ok).toBe(false);
      expect(logs).toEqual([
        expect.objectContaining({
          event: 'database.startup.failed',
          metadata: expect.objectContaining({
            databasePath: tempDir
          })
        })
      ]);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
