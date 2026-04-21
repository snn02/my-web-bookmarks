# Windows V1 Release Checklist

Use this checklist before treating the local V1 app as ready for regular use.

## Automated Checks

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.
- Run `npm run smoke`.

Expected smoke result:

- backend starts on a local test port;
- `/api/v1/health` returns `ok`;
- `/api/v1/settings` does not expose raw OpenRouter keys;
- `/api/v1/items` returns a list response;
- bookmark sync reaches a final failed state when Chrome profile path is missing;
- the failure message is visible in the API response.
- structured logs are written under `data/logs` without OpenRouter-style keys.

## Local Startup

- Start the backend:

```powershell
npm run dev:api
```

- Start the web UI in another terminal:

```powershell
npm run dev:web
```

- Open the Vite URL shown by the web command, usually `http://127.0.0.1:5173`.
- Confirm `data/sqlite/app.db` is created after backend startup.

## Bookmark Sync Smoke Pass

- Enter a full Chrome profile folder path, for example:

```text
C:\Users\<user>\AppData\Local\Google\Chrome\User Data\Default
```

- Press `Sync`.
- Confirm the sync status reaches a final state.
- Confirm imported bookmarks appear, or a visible error explains why import failed.
- Confirm search, status filter, and status update still work after sync.
- Confirm each item shows its current status in green.
- Click `New`, `Read`, and `Archive` on one item and confirm the green active button moves to the selected status.

## AI Smoke Pass

- Leave OpenRouter API key empty and press `Generate summary`.
- Confirm the app remains usable and shows a visible AI configuration error.
- Enter an OpenRouter API key and a low-cost model.
- Press `Generate summary` without pressing `Save AI` first.
- Confirm a generated summary appears or a visible upstream/configuration error appears.
- Press `Suggest tags`.
- Confirm suggestions are not attached until one is explicitly selected.
- If OpenRouter fails upstream, confirm the UI shows a readable troubleshooting message instead of raw JSON.
- Confirm the raw API key is not shown after save or generation.

## Failure Modes

- Use a missing Chrome profile path and confirm the app shows a file-not-found style error.
- Disconnect or block OpenRouter access and confirm AI actions show an upstream failure with user-readable guidance.
- Repeat sync twice and confirm the app reaches a final state instead of staying in `running`.

## Logs

- Check `data/logs/desktop-api.log`.
- Confirm sync events are written as JSON lines.
- Confirm OpenRouter API keys are not present in logs.
- Include log excerpts in bug reports only after checking they do not contain private URLs, local paths, or secrets.

## Backup

- Stop the backend before backup.
- Copy `data/sqlite/app.db` to a dated backup location.
- Restore by replacing `data/sqlite/app.db` while the backend is stopped.

## Packaging Decision

For V1, use local development commands plus this checklist.

Electron or Tauri packaging is deferred until the app needs a non-developer launch experience.
