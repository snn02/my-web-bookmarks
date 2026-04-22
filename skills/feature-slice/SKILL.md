---
name: feature-slice
description: Implement a behavior slice end-to-end for this project. Use when changing user-visible workflows in inbox, tags, summaries, sync, or settings. Enforce outcome-first design, global-vs-item scope clarity, and explicit lifecycle states.
---

# Feature Slice

## Required Inputs

- User-visible before/after outcome.
- Touched workflows and ownership scope (global vs item-scoped).

## Workflow

1. State expected visible outcome and final states.
2. Create or link the GitHub Issue for this slice; set initial status labels.
3. Add/update failing tests first.
4. Implement minimal vertical slice.
5. Verify no duplicate editable source of truth.
6. Verify scope boundaries:
   - global create does not mutate unrelated item;
   - item action affects only selected item.
7. Run verification:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test`
   - `npm run smoke` when flow is lifecycle-critical.
8. Update execution status and evidence in the linked GitHub Issue.
9. Update owner docs only if behavior changed.
10. Record concise implementation evidence in active log `dev_management/action_log_v<version>.md`.

## Stop Conditions

- No explicit user-visible outcome.
- Async lifecycle states are undefined.
- Change requires broad scope expansion not in current slice.
