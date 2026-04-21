import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 4391;
const API_BASE_PATH = '/api/v1';

export function resolveNpmCommand(platform = process.platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function buildApiUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

export function isFinalSyncStatus(status) {
  return status?.status === 'succeeded' || status?.status === 'failed';
}

export function redactText(text) {
  return text.replace(/or-v1-[A-Za-z0-9._-]+/g, '[REDACTED_OPENROUTER_KEY]');
}

export function createSmokeReport({ baseUrl, checks }) {
  const lines = [`Smoke test target: ${baseUrl}`];
  for (const check of checks) {
    lines.push(`- ${check.name}: ${check.ok ? 'ok' : 'failed'}`);
    if (check.detail) {
      lines.push(`  ${redactText(check.detail)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function isMainModule(moduleUrl, argvPath) {
  return fileURLToPath(moduleUrl) === argvPath;
}

export function createSmokeDatabasePath(realDatabasePath = join(process.cwd(), 'data', 'sqlite', 'app.db')) {
  const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return join(tmpdir(), 'my-web-bookmarks-smoke', timestamp, 'smoke-app.db');
}

export function sliceNewLogContent(content, startOffset) {
  return content.slice(startOffset);
}

export async function runSmokeAgainstBaseUrl({ baseUrl, timeoutMs = 15_000 }) {
  const checks = [];
  const logPath = join(process.cwd(), 'data', 'logs', 'desktop-api.log');
  const logStartOffset = existsSync(logPath) ? readFileSync(logPath, 'utf8').length : 0;
  try {
    await waitForHealth(baseUrl, timeoutMs);
    checks.push({ name: 'health', ok: true });

    const settings = await getJson(buildApiUrl(baseUrl, `${API_BASE_PATH}/settings`));
    checks.push({
      name: 'settings redaction',
      ok: settings.openRouter && !JSON.stringify(settings).includes('or-v1-')
    });

    const items = await getJson(buildApiUrl(baseUrl, `${API_BASE_PATH}/items`));
    checks.push({ name: 'items list', ok: Array.isArray(items.items) });

    const startedSync = await postJson(buildApiUrl(baseUrl, `${API_BASE_PATH}/sync/bookmarks`), {});
    checks.push({ name: 'sync lifecycle started', ok: startedSync.status === 'running' });

    const finalSync = await waitForFinalSyncStatus(baseUrl, timeoutMs);
    checks.push({
      detail: finalSync.error ?? undefined,
      name: 'sync lifecycle failure is visible',
      ok: finalSync.status === 'failed' && typeof finalSync.error === 'string'
    });

    const logContent = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
    const newLogContent = sliceNewLogContent(logContent, logStartOffset);
    checks.push({
      name: 'structured logs written without secrets',
      ok:
        newLogContent.includes('sync.bookmarks.started') &&
        newLogContent.includes('sync.bookmarks.finished') &&
        !newLogContent.includes('or-v1-')
    });

    assertChecks(checks);
    return createSmokeReport({ baseUrl, checks });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    checks.push({
      detail,
      name: 'smoke execution',
      ok: false
    });
    throw new Error(createSmokeReport({ baseUrl, checks }));
  }
}

export async function runSmokeTest({ baseUrl, port = DEFAULT_PORT, timeoutMs = 15_000 } = {}) {
  return runSmokeAgainstBaseUrl({
    baseUrl: baseUrl ?? `http://127.0.0.1:${port}`,
    timeoutMs
  });
}

async function waitForHealth(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(buildApiUrl(baseUrl, `${API_BASE_PATH}/health`));
      const body = await response.json();
      if (response.ok && body.status === 'ok') {
        return;
      }
    } catch {
      // Keep polling until the server is ready or the timeout expires.
    }
    await delay(250);
  }
  throw new Error('Backend health check did not become ready.');
}

async function waitForFinalSyncStatus(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getJson(buildApiUrl(baseUrl, `${API_BASE_PATH}/sync/status`));
    if (isFinalSyncStatus(status)) {
      return status;
    }
    await delay(250);
  }
  throw new Error('Sync did not reach a final state.');
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

function assertChecks(checks) {
  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    throw new Error(`Smoke checks failed: ${failed.map((check) => check.name).join(', ')}`);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

if (isMainModule(import.meta.url, process.argv[1])) {
  runSmokeTest()
    .then((report) => {
      console.log(report);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
