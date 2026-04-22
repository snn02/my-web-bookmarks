---
name: release-smoke
description: Run compact release-readiness verification for local Windows V1 flows. Use before claiming a slice is complete, before demo, or before handoff to manual QA.
---

# Release Smoke

## Automated Gate

Run from repo root:

```powershell
npm run typecheck
npm run lint
npm test
npm run smoke
```

## Manual Critical Flows

1. Sync lifecycle reaches visible final state.
2. Status switching visibly highlights current state.
3. Global tag creation does not auto-attach to items.
4. Item-level tag attach/remove affects only selected item.
5. AI summary appears directly in editable field (Russian output expected).
6. AI failures are readable and actionable; no raw JSON shown.
7. Raw OpenRouter key is never shown.

## Logging And Data Checks

1. `data/logs/desktop-api.log` exists and has structured sync/AI events.
2. Logs contain no OpenRouter-style keys.
3. `data/sqlite/app.db` is present for normal backend startup.

## Completion Rule

Do not mark release-ready if any workflow remains indefinitely in loading/running/generating without a visible final state.
