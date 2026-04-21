import type { Server } from 'node:http';
import { createApp } from '../app';
import { createFileDatabase, initializeDatabase } from '../db/database';
import type { AppLogger } from '../logging/app-logger';

export type StartDesktopApiResult =
  | {
      ok: true;
      server: Server;
    }
  | {
      error: unknown;
      ok: false;
    };

export interface StartDesktopApiOptions {
  databasePath: string;
  logger: AppLogger;
  port: number;
}

export function startDesktopApi({
  databasePath,
  logger,
  port
}: StartDesktopApiOptions): StartDesktopApiResult {
  try {
    const db = createFileDatabase(databasePath);
    initializeDatabase(db);
    const server = createApp({ db, logger }).listen(port, '127.0.0.1', () => {
      logger.info('desktop_api.started', { databasePath, port });
      console.log(`desktop-api listening on http://127.0.0.1:${port}`);
    });
    return { ok: true, server };
  } catch (error) {
    logger.error('database.startup.failed', {
      databasePath,
      error: error instanceof Error ? error.message : 'Unknown database startup failure.'
    });
    return { error, ok: false };
  }
}
