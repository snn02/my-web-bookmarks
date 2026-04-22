# Development Action Log V2

This log is the active implementation journal for V2.

## Versioned Log Policy

- Keep one active log per product version: `action_log_v<version>.md`.
- When closing a version, freeze the current log and create the next one.
- Start each new version log with a compact summary of prior logs.
- Keep entries short and evidence-focused:
  - what changed;
  - what failed first;
  - what passed after;
  - what lesson changes future work.

## Bootstrap Summary From V1

Source logs: `dev_management/action_log_v1.md`, `dev_management/v1_retrospective.md`, `dev_management/iteration_plan.md`.

### Delivered Baseline

- V1 iterations `0-6` accepted.
- V1 feedback fixes `V1-FIX-001` through `V1-FIX-007` accepted.
- Stable local-first baseline exists:
  - Chrome bookmark sync from saved profile path;
  - statuses, search, filters;
  - global tags + item-scoped tag assignment/removal;
  - Russian AI summaries in editable textarea;
  - AI tag suggestions;
  - structured logs + smoke + backup flow.

### Working Rules Carried Into V2

1. Define observable user outcomes before coding.
2. For editable content, keep one source of truth in UI.
3. Separate global resource creation from item-scoped assignment.
4. Treat AI providers as independent operational dependencies and preserve provider-specific errors.
5. Update docs by ownership only; avoid parallel documentation roots.

### Open V2 Candidates (Not Committed Scope)

- Browser-level frontend smoke.
- Better OpenRouter fallback and cost/limit policy.
- Full article extraction.
- Desktop packaging/launcher improvements.
- Bulk tag assignment.
- Tag rename UI.
- Revisit `node:sqlite` experimental status before packaging.

## 2026-04-22 - V2 Log Initialized

**Change**

- Adopted versioned action logs to reduce context size and improve handoff clarity.
- Archived prior log as `dev_management/action_log_v1.md`.
- Opened this active V2 log with carry-forward summary and constraints.

**Why**

- V1 log became too large for efficient context loading.
- Version boundaries should be explicit in process artifacts.

**Next**

- Create/confirm `dev_management/v2_plan.md` as V2 control document.
- Record only V2 execution evidence in this file.

## 2026-04-22 - V2 Scope Confirmed (Launcher + Test Hardening)

**Change**

- Confirmed V2 committed scope with user:
  - desktop shortcut + launcher script;
  - launcher command surface: `start`, `stop`, `restart`, `status`;
  - necessary test upgrades with browser E2E smoke.
- Added canonical control plan at `dev_management/v2_plan.md`.

**Why**

- V2 needs an explicit operational reliability slice before packaging.
- One-click launch and deterministic startup state are primary user outcomes.
- Browser-level smoke is needed as a practical regression gate for real UI flows.

**Documentation decision**

- Rejected `docs/superpowers/specs` path for V2 planning in this repository.
- Kept documentation within existing ownership boundaries per project rules and V1 retrospective guidance.

**Next**

- Start V2-I1 (`Launcher Core`) with test-first command integration coverage.
- Define exact state model and failure semantics for launcher lifecycle before implementation.

## 2026-04-22 - V2-I1 Detailed Implementation Plan Written

**Change**

- Wrote detailed test-first implementation plan for V2-I1 at `dev_management/v2_i1_launcher_core_implementation_plan.md`.
- Kept plan in project-owned management docs instead of introducing new documentation roots.

**Why**

- V2-I1 requires precise command lifecycle semantics (`start`, `stop`, `restart`, `status`) and explicit verification gates before code changes.

**Next**

- Execute the plan task-by-task with failing tests first, then minimal implementation, then verification.

## 2026-04-22 - V2-I1 Launcher Core Implemented

**What changed**

- Added Windows launcher script at `scripts/launcher.ps1` with command surface:
  - `start`
  - `stop`
  - `restart`
  - `status`
- Added launcher integration test script `scripts/launcher.test.ps1` and root script `npm run test:launcher`.
- Added runtime state persistence under `data/runtime/launcher-state.json`.
- Added launcher npm scripts:
  - `launcher:start`
  - `launcher:stop`
  - `launcher:restart`
  - `launcher:status`

**What failed first**

- Node-based launcher tests failed with `spawn EPERM` in sandboxed execution.
- Launcher state JSON parsing failed in Windows PowerShell 5 due `ConvertFrom-Json -AsHashtable` incompatibility.
- Test-mode startup initially failed with `startup_timeout` due unstable inline `node -e` argument handling via `Start-Process`.

**What passed after**

- `npm run test:launcher` passed with PowerShell-based integration coverage.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed.
- `npm run smoke` passed.

**Lesson that changes future work**

- In this environment, process-spawning tests are more reliable when executed directly in PowerShell instead of `node --test` wrappers.
- For Windows compatibility, avoid PowerShell 7-only JSON conveniences in core scripts.

## 2026-04-22 - V2-I2 Shortcut Flow Started

**What changed**

- Added `scripts/create-desktop-shortcut.ps1` to generate a Windows `.lnk` for one-click startup.
- Added root npm command `npm run launcher:create-shortcut`.
- Updated user-facing startup docs to include shortcut creation and usage.

**Verification**

- Verified shortcut creation command on a safe local path:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1 -ShortcutPath data/runtime/MyWebBookmarks-Test.lnk`
- Confirmed the test shortcut file was created and then cleaned up.

**Next**

- Run manual Desktop validation for actual one-click launch from `%USERPROFILE%\\Desktop`.
- Continue V2-I2 readiness checks before marking the iteration accepted.

## 2026-04-22 - V2-I2 Desktop One-Click Validated With Playwright

**What changed**

- Added Playwright verification script `scripts/check-shortcut-playwright.mjs`.
- Executed real one-click launch from Desktop shortcut and validated UI readiness via Playwright.

**Verification**

- `npm run launcher:create-shortcut` created `C:\Users\savin\Desktop\My Web Bookmarks.lnk`.
- `Start-Process` launched the Desktop shortcut.
- `node scripts/check-shortcut-playwright.mjs` passed and confirmed `Backend: available`.
- `npm run launcher:stop` returned launcher stack to stopped state.

**Lesson**

- Browser launch and Playwright checks require non-sandbox execution in this environment because sandboxed process spawn fails with `EPERM`.
