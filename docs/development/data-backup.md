# Data Backup And Recovery

The app is local-first. Chrome remains the source for imported bookmark input, while app-specific data such as statuses, tags, summaries, settings, and sync history belongs to the local app database.

## Current Storage

- The backend uses `data/sqlite/app.db` for normal local startup.
- Set `DATABASE_PATH` to override the default database file.
- Automated tests use in-memory or temporary databases.
- `npm run smoke` uses an isolated temporary database so it does not mutate the real app database.

## Backing Up SQLite

- Stop the backend before copying the database file.
- Copy `data/sqlite/app.db` to a dated backup location.
- Keep backups outside `node_modules` and build output directories.
- Do not edit the SQLite file manually unless using a trusted SQLite tool and a separate backup copy.

## What Needs Backup

- `data/sqlite/app.db`.
- Any future `data/logs` directory only when logs are needed for debugging.
- Do not include OpenRouter API keys in shared bug reports or screenshots.

## Logs

- Runtime logs are written to `data/logs/desktop-api.log`.
- Logs are JSONL: one JSON object per line.
- OpenRouter-style API keys are redacted before file writes.
- Logs may still contain local paths, item IDs, URLs, and error messages; review before sharing.

## Recovery Checklist

- Stop backend and web dev servers.
- Restore `data/sqlite/app.db` from backup.
- Start backend.
- Run `npm run smoke`.
- Open the web UI and verify bookmarks, statuses, tags, and summaries.

## Known Limitation

SQLite is durable local storage, but it is still a local file. Back it up before risky experiments, migrations, or large imports.
