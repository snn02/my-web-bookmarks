# My Web Bookmarks V2 Plan

## V2 Charter

**Goal**

Deliver an operationally reliable local launch flow for Windows with one-click start and repeatable browser-level smoke verification.

**Committed Scope**

1. Desktop shortcut + launcher script.
2. Launcher commands: `start`, `stop`, `restart`, `status`.
3. Necessary test upgrades, including browser E2E smoke.

**Non-Goals (Current V2 Wave)**

- Full desktop packaging (Electron/Tauri installer).
- AI quality/fallback policy redesign.
- Bulk tag assignment and taxonomy UX expansion.

**Success Metrics**

- User can start the app from desktop shortcut in one action.
- Launcher always ends in a readable final state (`running`, `stopped`, or `failed`).
- `stop` is idempotent and `restart` returns to a healthy running state.
- Browser smoke covers one happy path and one controlled failure path.
- Required checks pass: `npm run typecheck`, `npm run lint`, `npm test`, `npm run smoke` (plus V2 smoke command when introduced).

## Iteration Plan

## V2-I1: Launcher Core

**Status:** accepted

**User-visible outcome (before/after)**

- Before: app startup requires manual multi-command sequence.
- After: user (or script) can run `launcher.ps1 start|stop|restart|status` with deterministic results.

**Scope**

- Implement `scripts/launcher.ps1` command surface.
- Add runtime state/PID tracking under `data/runtime`.
- Add health checks for backend and web readiness.
- Add lock/guard against concurrent conflicting launcher actions.

**Automated verification**

- Launcher command integration tests:
  - `start` reaches running state.
  - `status` reports component states and failure reasons.
  - `stop` is idempotent.
  - `restart` returns to running.
  - double `start` is safely rejected or coalesced by design.

**Manual QA**

- Run launcher commands on Windows PowerShell and confirm expected final state text.

**Verification Evidence (2026-04-22)**

- `npm run test:launcher` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed.
- `npm run smoke` passed.

## V2-I2: Desktop Shortcut Flow

**Status:** accepted

**User-visible outcome (before/after)**

- Before: user must remember terminal commands.
- After: desktop shortcut starts the app and opens browser workflow.

**Scope**

- Add/verify desktop shortcut creation instructions.
- Bind shortcut action to `launcher.ps1 start`.
- Ensure browser opens only after readiness checks pass.

**Automated verification**

- Script-level smoke confirms shortcut-targeted command path is valid.

**Manual QA**

- One-click desktop launch on Windows.
- Confirm `status` reflects running state after launch.

**Current Progress (2026-04-22)**

- Added shortcut creation script `scripts/create-desktop-shortcut.ps1`.
- Added npm command `npm run launcher:create-shortcut`.
- Updated manual and release docs with shortcut setup instructions.
- Verified shortcut creation on a local test path:
  - `powershell -File scripts/create-desktop-shortcut.ps1 -ShortcutPath data/runtime/MyWebBookmarks-Test.lnk`
- Verified real Desktop one-click launch with Playwright:
  - launch source: `%USERPROFILE%\Desktop\My Web Bookmarks.lnk`
  - check: `node scripts/check-shortcut-playwright.mjs`
  - result: UI became available and reported `Backend: available`

## V2-I3: Browser E2E Smoke

**Status:** accepted

**User-visible outcome (before/after)**

- Before: no browser-level regression gate for primary workflow.
- After: CI/local smoke catches major end-to-end regressions early.

**Scope**

- Add browser E2E smoke harness (tooling per repo conventions).
- Implement happy-path smoke:
  - app is reachable;
  - backend health is visible;
  - one core item action completes and UI refreshes.

**Automated verification**

- `npm run e2e:smoke` (or equivalent script name introduced in this iteration) passes locally.

**Manual QA**

- Run smoke from clean startup and confirm deterministic pass/fail output.

**Verification Evidence (2026-04-22)**

- `npm run e2e:smoke:happy` passed through aggregate smoke runner.
- `npm run e2e:smoke` passed (`happy-path` + `failure-path` checks reported `ok`).
- Added stable e2e scripts:
  - `scripts/e2e-smoke-happy.mjs`
  - `scripts/e2e-smoke-lib.mjs`
  - `scripts/e2e-smoke-runner.mjs`

## V2-I4: Failure Smoke + Release Gate

**Status:** accepted

**User-visible outcome (before/after)**

- Before: failures can be discovered late and inconsistently.
- After: controlled failure scenario is tested and produces explicit readable final UI state.

**Scope**

- Add one controlled failure-path browser smoke.
- Add aggregate V2 smoke command that runs launcher + browser smoke gates.

**Automated verification**

- Aggregate V2 smoke command returns non-zero on failure.
- Failure-path assertion proves no indefinite loading state.

**Manual QA**

- Validate failure message is actionable and non-technical where possible.

**Verification Evidence (2026-04-22)**

- `npm run e2e:smoke` passed with controlled failure-path assertions:
  - sync reaches `failed` final state;
  - readable sync error text is visible in UI.
- Added release gate command `npm run smoke:v2`.
- `npm run smoke:v2` passed:
  - `npm run test:launcher` green;
  - `npm run e2e:smoke` green.

## V2-I5: Hardening + Docs By Ownership

**Status:** accepted

**User-visible outcome (before/after)**

- Before: operational behavior is partially documented from V1 baseline.
- After: V2 launch/reliability workflows are documented once in correct owner docs.

**Scope**

- Stabilization fixes discovered during V2-I1..I4 verification.
- Documentation updates only by ownership:
  - Product behavior: `docs/product/user-stories.md` (if changed).
  - API contract: `docs/api/local-api.md` (if changed).
  - Manual QA/release: `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-release-checklist.md` (or V2 checklist if introduced).
  - Process/lessons: `dev_management/action_log_v2.md`.

**Automated verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`
- V2 aggregate smoke command

**Manual QA**

- Windows launch/restart/stop/status walkthrough.
- Browser smoke happy + controlled failure confirmation.

**Verification Evidence (2026-04-22)**

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed.
- `npm run smoke` passed.
- `npm run smoke:v2` passed.

**Docs Updated By Ownership**

- Manual QA/release:
  - `docs/development/manual-smoke-scenarios.md`
  - `docs/release/windows-release-checklist.md`
- Process/lessons:
  - `dev_management/action_log_v2.md`
- V2 control/acceptance:
  - `dev_management/v2_plan.md`

## Definition Of Done For This V2 Wave

- Launcher commands are stable and deterministic.
- Desktop shortcut launch works with one click on Windows.
- Browser E2E smoke includes happy and controlled failure paths.
- No workflow remains in indefinite running/loading without a final state.
- Required checks pass and docs are updated once in correct ownership boundaries.

