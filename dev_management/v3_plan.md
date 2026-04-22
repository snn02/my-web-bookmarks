# My Web Bookmarks V3 Plan

## Version Goal

Deliver a cleaner, modernized workflow-focused UI by splitting Inbox work from Settings and improving operation feedback.

## Iterations

## V3-I1: Compact Inbox List + Accordion Details

**Status:** accepted  
**Issue:** #1 ([URL](https://github.com/snn02/my-web-bookmarks/issues/1))

**User-visible outcome (before/after)**

- Before: heavy cards on one overloaded screen make large lists harder to process.
- After: compact list rows with click-to-expand accordion details for each item.

**Scope**

- Introduce compact row presentation for bookmark list.
- Add expand/collapse behavior per item.
- Keep item actions (status, summary, tags, AI actions) inside expanded details.
- Keep existing API contracts unchanged.

**Acceptance criteria**

- List is visually compact by default.
- User can expand/collapse item details reliably.
- Existing item actions work correctly in expanded panel.
- No indefinite loading states introduced by accordion flow.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

## V3-I2: Separate Settings Screen

**Status:** accepted  
**Issue:** #2 ([URL](https://github.com/snn02/my-web-bookmarks/issues/2))

**User-visible outcome (before/after)**

- Before: settings and daily processing controls are mixed on one screen.
- After: settings live on `/settings`; Inbox remains focused on processing bookmarks.

**Scope**

- Add `/settings` route and settings view.
- Move Chrome profile and OpenRouter settings UI from Inbox to `/settings`.
- Keep save behavior equivalent to current implementation.

**Acceptance criteria**

- Settings controls are absent from Inbox.
- `/settings` persists settings successfully.
- Inbox workflows remain fully functional after move.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

## V3-I3: Unified Loaders + Operation Confirmations

**Status:** planned  
**Issue:** #3 ([URL](https://github.com/snn02/my-web-bookmarks/issues/3))

**User-visible outcome (before/after)**

- Before: operation feedback is inconsistent and can feel unclear.
- After: long operations consistently show `running -> success|failure` with readable messages.

**Scope**

- Add consistent loading indicators for long operations.
- Add unified success confirmations (toast/inline pattern).
- Ensure failure messages remain readable and safe (no raw JSON, no secrets).

**Acceptance criteria**

- Sync, summary generation, tag suggestion, and summary save have visible lifecycle.
- Every long operation ends in explicit success/failure feedback.
- No workflow remains indefinitely in loading/running state.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

## Execution Order

1. V3-I1
2. V3-I2
3. V3-I3

## Docs And Logging Per Iteration

- Update this file with iteration status and linked issue.
- Record lessons only in `dev_management/action_log_v3.md`.
