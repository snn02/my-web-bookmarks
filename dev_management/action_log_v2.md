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
