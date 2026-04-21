import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFileLogger, redactLogValue } from '../../src/logging/app-logger';

describe('app logger', () => {
  it('redacts OpenRouter-like secrets from nested log metadata', () => {
    expect(
      redactLogValue({
        apiKey: 'or-v1-secret-value',
        nested: ['keep', 'or-v1-another-secret']
      })
    ).toEqual({
      apiKey: '[REDACTED_OPENROUTER_KEY]',
      nested: ['keep', '[REDACTED_OPENROUTER_KEY]']
    });
  });

  it('writes structured JSONL logs without leaking secrets', () => {
    const logDir = mkdtempSync(join(tmpdir(), 'my-web-bookmarks-logs-'));
    try {
      const logger = createFileLogger({ logDir });

      logger.info('openrouter.settings.updated', {
        apiKey: 'or-v1-secret-value',
        model: 'openai/gpt-5-mini'
      });

      const content = readFileSync(join(logDir, 'desktop-api.log'), 'utf8');
      const line = JSON.parse(content.trim()) as {
        event: string;
        level: string;
        metadata: Record<string, unknown>;
      };
      expect(line).toMatchObject({
        event: 'openrouter.settings.updated',
        level: 'info',
        metadata: {
          apiKey: '[REDACTED_OPENROUTER_KEY]',
          model: 'openai/gpt-5-mini'
        }
      });
      expect(content).not.toContain('or-v1-secret-value');
    } finally {
      rmSync(logDir, { force: true, recursive: true });
    }
  });
});
