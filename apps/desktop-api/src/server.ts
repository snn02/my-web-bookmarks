import { getDefaultDatabasePath } from './db/database';
import { createFileLogger } from './logging/app-logger';
import { startDesktopApi } from './startup/start-desktop-api';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT ?? 4321);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const logger = createFileLogger({ logDir: join(repoRoot, 'data', 'logs') });
const databasePath = getDefaultDatabasePath();

const result = startDesktopApi({ databasePath, logger, port });
if (!result.ok) {
  console.error(result.error instanceof Error ? result.error.message : String(result.error));
  process.exitCode = 1;
}
