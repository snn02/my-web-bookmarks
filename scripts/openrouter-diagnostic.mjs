import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const databasePath = process.env.DATABASE_PATH ?? 'data/sqlite/app.db';

if (!existsSync(databasePath)) {
  console.error(`Database not found: ${databasePath}`);
  process.exit(1);
}

const db = new DatabaseSync(databasePath, { readOnly: true });

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

const apiKey = getSetting('openrouter_api_key');
const model = process.env.OPENROUTER_MODEL ?? process.argv[2] ?? getSetting('openrouter_model') ?? 'openai/gpt-5-mini';

console.log(
  JSON.stringify(
    {
      apiKeyConfigured: Boolean(apiKey),
      apiKeyFingerprint: apiKey ? createHash('sha256').update(apiKey).digest('hex').slice(0, 12) : null,
      databasePath,
      model
    },
    null,
    2
  )
);

if (!apiKey) {
  console.error('OpenRouter API key is not configured in local settings.');
  process.exit(1);
}

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  body: JSON.stringify({
    messages: [
      {
        role: 'system',
        content: 'Reply with exactly: ok'
      },
      {
        role: 'user',
        content: 'Health check'
      }
    ],
    model
  }),
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  method: 'POST'
});

const body = await response.text();
const relevantHeaders = {};
for (const [key, value] of response.headers.entries()) {
  if (
    key.includes('limit') ||
    key.includes('quota') ||
    key.includes('retry') ||
    key === 'content-type' ||
    key === 'x-request-id'
  ) {
    relevantHeaders[key] = value;
  }
}

console.log(
  JSON.stringify(
    {
      bodyPreview: body.slice(0, 1200),
      headers: relevantHeaders,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText
    },
    null,
    2
  )
);
