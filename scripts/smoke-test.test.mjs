import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildApiUrl,
  createSmokeReport,
  createSmokeDatabasePath,
  isFinalSyncStatus,
  isMainModule,
  redactText,
  resolveNpmCommand
} from './smoke-test.mjs';

describe('smoke-test helpers', () => {
  it('builds API URLs from a base URL and path', () => {
    assert.equal(buildApiUrl('http://127.0.0.1:4321', '/api/v1/health'), 'http://127.0.0.1:4321/api/v1/health');
  });

  it('recognizes final sync states for lifecycle assertions', () => {
    assert.equal(isFinalSyncStatus({ status: 'running' }), false);
    assert.equal(isFinalSyncStatus({ status: 'succeeded' }), true);
    assert.equal(isFinalSyncStatus({ status: 'failed' }), true);
  });

  it('redacts OpenRouter-like API keys from report text', () => {
    assert.equal(redactText('key=or-v1-secret-value'), 'key=[REDACTED_OPENROUTER_KEY]');
  });

  it('creates an outcome-focused smoke report', () => {
    const report = createSmokeReport({
      baseUrl: 'http://127.0.0.1:4321',
      checks: [
        { name: 'health', ok: true },
        { name: 'sync lifecycle failure is visible', ok: true }
      ]
    });

    assert.match(report, /health: ok/);
    assert.match(report, /sync lifecycle failure is visible: ok/);
  });

  it('uses npm.cmd on Windows and npm elsewhere', () => {
    assert.equal(resolveNpmCommand('win32'), 'npm.cmd');
    assert.equal(resolveNpmCommand('linux'), 'npm');
  });

  it('detects the CLI entrypoint on Windows-style paths', () => {
    assert.equal(
      isMainModule('file:///C:/repo/scripts/smoke-test.mjs', 'C:\\repo\\scripts\\smoke-test.mjs'),
      true
    );
  });

  it('creates an isolated smoke database path outside the real app database', () => {
    const smokePath = createSmokeDatabasePath('C:\\repo\\data\\sqlite\\app.db');

    assert.match(smokePath, /smoke/);
    assert.notEqual(smokePath, 'C:\\repo\\data\\sqlite\\app.db');
  });
});
