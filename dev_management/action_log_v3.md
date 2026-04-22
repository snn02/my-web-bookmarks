# Development Action Log V3

This log is the active implementation journal for V3.

## Versioned Log Policy

- Keep one active log per product version: `action_log_v<version>.md`.
- Keep entries short and evidence-focused:
  - what changed;
  - what failed first;
  - what passed after;
  - what lesson changes future work.
- Keep operational task status in GitHub Issues, not in this log.

## Bootstrap Summary From V2

- V2 delivered launcher reliability, desktop shortcut flow, and browser-level smoke gates.
- V3 focus is AI reliability hardening, especially large-file anti-hallucination behavior.
- V3 tracking model:
  - roadmap and decisions in `dev_management/v3_plan.md`;
  - execution status in GitHub Issues;
  - lessons learned in this file.

## 2026-04-22 - V3 Log Initialized

**Change**

- Opened active V3 log and aligned it with issue-driven execution.

**Why**

- Reduce context drift and separate roadmap, execution status, and lessons.

**Next**

- Create and link V3 issues in `dev_management/v3_plan.md`.
- Start V3-I1 with test-first grounding and failure-state checks.

## 2026-04-22 - V3-I1 Started (Compact Inbox + Accordion)

**What changed**

- Implemented compact row presentation for Inbox items.
- Added per-item accordion behavior (`Toggle details`) for expanding/collapsing full item details.
- Kept item-scoped actions (status, summary, tags, AI actions) inside expanded details panel.
- Updated web tests to interact with item controls through accordion expansion.
- Linked V3 iterations to GitHub issues in `dev_management/v3_plan.md`.

**What failed first**

- Sandbox execution blocked Vitest/esbuild process spawn with `spawn EPERM` for web tests.
- GitHub MCP integration could not create issues due `403 Resource not accessible by integration`.

**What passed after**

- `gh` CLI auth and issue creation succeeded for V3-I1/V3-I2/V3-I3.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed.
- `npm run smoke` passed.

**Lesson that changes future work**

- In this environment, browser/Vite test commands should be executed with escalated permissions when sandbox `EPERM` appears.

## 2026-04-22 - V3-I2 Completed (Separate Settings Screen)

**What changed**

- Added application section navigation (`Inbox` / `Settings`) with URL-backed views:
  - `/` for Inbox
  - `/settings` for Settings
- Moved settings controls out of Inbox:
  - Chrome profile path save controls now exist only on Settings screen.
  - OpenRouter API key/model save controls now exist only on Settings screen.
- Kept Inbox focused on processing workflows (filters, sync trigger, list operations).
- Updated web tests to validate separated views and settings navigation behavior.

**What failed first**

- Web tests initially started in the wrong view because browser history path was preserved between test cases.
- Sync error test mock sequence still expected old Inbox-side settings save call.

**What passed after**

- Added per-test URL reset to `/` in web test setup.
- Updated sync error test mocks for the new settings flow.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed.
- `npm run smoke` passed.

**Lesson that changes future work**

- When introducing URL-based UI view switching, explicitly reset history state in test setup to avoid cross-test view leakage.

## 2026-04-22 - V3-I3 Completed (Unified Lifecycles + Confirmations)

**What changed**

- Added unified operation lifecycle phases in UI:
  - global sync phase: `idle`, `running`, `success`, `failure`
  - per-item phases: summary save, summary generation, tag suggestion
- Added consistent operation feedback:
  - lifecycle badges/text in Inbox for sync and item operations
  - success/error toast-style confirmations for key operations
- Added operation-specific button feedback for long actions:
  - `Syncing...`
  - `Generating...`
  - `Suggesting...`
- Added/updated test coverage for lifecycle and confirmation behavior in web tests.

**What failed first**

- New settings-route behavior caused test view leakage because browser path persisted across tests.
- One sync error test still expected legacy call ordering from pre-I2 flow.

**What passed after**

- Updated tests for route reset and new call sequence.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed.
- `npm run smoke` passed.

**Lesson that changes future work**

- For UI flow changes spanning multiple iterations, keep a dedicated lifecycle test that verifies visible final states and confirmation messaging together.
