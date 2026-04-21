import { createApp } from '../apps/desktop-api/src/app';
import { createFileDatabase, initializeDatabase } from '../apps/desktop-api/src/db/database';
import { createFileLogger } from '../apps/desktop-api/src/logging/app-logger';
import { createSmokeDatabasePath, runSmokeAgainstBaseUrl } from './smoke-test.mjs';

const port = Number(process.env.SMOKE_PORT ?? 4391);
const baseUrl = `http://127.0.0.1:${port}`;
const logger = createFileLogger();
const db = createFileDatabase(process.env.SMOKE_DATABASE_PATH ?? createSmokeDatabasePath());
initializeDatabase(db);
const server = createApp({ db, logger }).listen(port, '127.0.0.1');

try {
  const report = await runSmokeAgainstBaseUrl({ baseUrl });
  console.log(report);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  db.close();
}
