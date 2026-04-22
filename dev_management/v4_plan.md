# My Web Bookmarks V4 Plan

## Version Goal

Deliver a visual UI modernization (look and feel) on top of the stable V3 UX, without API or business-logic changes.

## Process Rules For V4

- No separate spec files for V4 slices.
- `dev_management/v4_plan.md` is the roadmap source with issue links and execution statuses.
- Detailed change description, scope, acceptance criteria, and design details live inside the related GitHub Issue.
- `dev_management/action_log_v4.md` is the only active implementation log for V4 lessons and decisions.
- Product/API/release docs in `docs/` are updated only when behavior requires it and only in owner-boundary files.

## Version Status

Active (started on 2026-04-23).

## Iterations

## V4-I1: Command Center Visual Theme Foundation

**Status:** in_review  
**Issue:** #4 ([URL](https://github.com/snn02/my-web-bookmarks/issues/4))

**User-visible outcome (before/after)**

- Before: stable UX with basic visual hierarchy and limited visual personality.
- After: same UX flow with Command Center look and feel, clearer hierarchy, and modern visual rhythm.

**Scope Boundaries**

- Visual-only updates: layout polish, tokens, typography, spacing, color, component styling.
- No API contract changes.
- No business logic changes.
- No UX flow changes.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

**Execution Notes**

- 2026-04-23: initial visual-only Command Center styling pass implemented and verified.
- 2026-04-23: direction changed after review feedback to a light, minimal style using PrimeVue components as visual layer (API and business logic unchanged).
- 2026-04-23: PrimeVue integration implemented (`Button`, `InputText`, `Textarea`) with forced light preset and minimal styling pass; verification suite passed.

## Execution Order

1. V4-I1

## Tracking Notes

- After creating an issue for a slice, replace `TBD` with `#<id>` and full URL.
- Keep issue status in GitHub labels/comments and mirror concise status here.
