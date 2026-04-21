import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'error' | 'info' | 'warn';

export interface LogMetadata {
  [key: string]: unknown;
}

export interface AppLogger {
  error(event: string, metadata?: LogMetadata): void;
  info(event: string, metadata?: LogMetadata): void;
  warn(event: string, metadata?: LogMetadata): void;
}

export interface FileLoggerOptions {
  logDir?: string;
}

const OPENROUTER_KEY_PATTERN = /or-v1-[A-Za-z0-9._-]+/g;

export function createNoopLogger(): AppLogger {
  return {
    error: () => undefined,
    info: () => undefined,
    warn: () => undefined
  };
}

export function createFileLogger({ logDir = join(process.cwd(), 'data', 'logs') }: FileLoggerOptions = {}): AppLogger {
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, 'desktop-api.log');

  function write(level: LogLevel, event: string, metadata: LogMetadata = {}): void {
    appendFileSync(
      logPath,
      `${JSON.stringify({
        event,
        level,
        metadata: redactLogValue(metadata),
        timestamp: new Date().toISOString()
      })}\n`,
      'utf8'
    );
  }

  return {
    error: (event, metadata) => write('error', event, metadata),
    info: (event, metadata) => write('info', event, metadata),
    warn: (event, metadata) => write('warn', event, metadata)
  };
}

export function redactLogValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(OPENROUTER_KEY_PATTERN, '[REDACTED_OPENROUTER_KEY]');
  }

  if (Array.isArray(value)) {
    return value.map(redactLogValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, redactLogValue(nestedValue)])
    );
  }

  return value;
}
