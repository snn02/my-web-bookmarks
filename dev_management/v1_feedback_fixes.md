# V1 Feedback Fixes

This file tracks the dedicated bug-fix and V1 adaptation iteration.

## Working Rules

- Process feedback in small, reviewable slices.
- Keep each fix focused on the reported issue.
- Add or update automated checks when behavior changes.
- Update `docs` whenever a fix changes documented functionality, setup, storage, sync, AI behavior, smoke tests, logs, or user workflows.
- Keep lessons learned in `dev_management/action_log_v1.md`.
- Move an item through: `reported` -> `in_progress` -> `ready_for_review` -> `accepted` or `rework`.

## Status

**Iteration:** Bug-fix and V1 adaptation

**State:** all_current_v1_fixes_accepted

## Feedback Items

| ID | Status | Summary | Code/Docs touched | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| V1-FIX-001 | accepted | Current item status is not visually highlighted; status actions look inactive/unclear. | `apps/web/src/App.vue`, `apps/web/test/App.test.ts`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-21. Manual QA accepted on 2026-04-22. | Current status text and active status button are green. |
| V1-FIX-002 | accepted | AI upstream errors render raw JSON instead of a user-readable message. | `apps/web/src/api/client.ts`, `apps/web/test/api-client.test.ts`, `apps/web/test/App.test.ts`, `docs/api/local-api.md`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-21. Manual QA accepted on 2026-04-22. | Web client translates structured API errors into actionable text; raw JSON is not shown. |
| V1-FIX-003 | accepted | Tag assignment is unclear and currently attaches a global new tag to the first item. | `apps/web/src/App.vue`, `apps/web/test/App.test.ts`, `dev_management/v1_feedback_fixes.md`, `dev_management/action_log_v1.md`, `docs/product/user-stories.md`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Manual QA accepted on 2026-04-22. | Item cards get scoped tag inputs with existing-tag suggestions; top `Create tag` only creates a global tag and attaches nothing. Bulk assignment remains deferred. |
| V1-FIX-004 | accepted | Generated summary appears above the editor instead of immediately becoming editable in the textarea. | `apps/web/src/App.vue`, `apps/web/test/App.test.ts`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md`, `docs/product/user-stories.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Manual QA accepted on 2026-04-22. | Generated and existing summaries are represented through the editable textarea, without a duplicate preview above it. |
| V1-FIX-005 | accepted | AI summary should be generated in Russian. | `apps/desktop-api/src/domain/ai/ai-service.ts`, `apps/desktop-api/test/api/v1-routes.test.ts`, `docs/api/local-api.md`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md`, `docs/product/user-stories.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Manual QA accepted on 2026-04-22. | Summary prompt now explicitly requests Russian output. |
| V1-FIX-006 | accepted | `Suggest tags` returns OpenRouter upstream error while summary generation works with the same settings. | `apps/desktop-api/src/domain/ai/ai-service.ts`, `apps/desktop-api/src/integrations/openrouter/openrouter-client.ts`, `apps/desktop-api/src/app.ts`, `apps/desktop-api/test/api/v1-routes.test.ts`, `docs/api/local-api.md`, `docs/development/manual-smoke-scenarios.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Manual QA accepted on 2026-04-22. | Tag prompt now asks for one tag per line and backend logs safe OpenRouter status/reason diagnostics. |
| V1-FIX-007 | accepted | `Generate summary` can fail with OpenRouter `429`, but the UI showed generic guidance. | `apps/desktop-api/src/app.ts`, `apps/desktop-api/test/api/v1-routes.test.ts`, `apps/web/src/api/client.ts`, `apps/web/test/api-client.test.ts`, `scripts/openrouter-diagnostic.mjs`, `docs/api/local-api.md`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Direct diagnostic: `google/gemma-4-31b-it:free` returned `429`; `openai/gpt-oss-20b:free` returned `200`. Manual QA accepted on 2026-04-22. | Fresh log and direct diagnostic showed upstream Google AI Studio rate limiting for the saved free Gemma model; the saved OpenRouter key works with another model. |

## V1-FIX-003 Planned Design

### User Decision

- Add item-scoped tag editing inside each bookmark card, below the summary editor and AI buttons.
- Show current item tags inside that item tag input area as blocks with tag name and `x`.
- While typing in the item tag input, show suggestions from existing database tags filtered by substring.
- Clicking a suggestion attaches that existing tag only to the current item.
- The top `New tag` field remains a global tag creation control only; it creates a tag in the database and attaches it to no items.
- Bulk tag assignment is deferred beyond V1.

### UI Behavior

- The top `New tag` input remains in the inbox summary row.
- `Create tag` creates a reusable global tag and updates the global tag list.
- `Create tag` must not call `POST /items/:itemId/tags`.
- Each card has a tag editor below the summary area.
- Existing item tags render as compact removable blocks.
- The item tag input searches existing global tags by case-insensitive substring.
- Suggestions exclude tags already attached to the item.
- Selecting a suggestion attaches the tag to that item and clears the item input.
- If no existing tag matches, V1 shows no suggestion list and does not create a tag from inside the card.

### Data Flow

- Initial load fetches items and global tags.
- Global create calls `POST /api/v1/tags` and updates the global `tags` list only.
- Item attach calls `POST /api/v1/items/:itemId/tags` with the selected existing tag ID.
- Item remove calls `DELETE /api/v1/items/:itemId/tags/:tagId`.
- Item attach/remove updates only the affected item card.

### Acceptance Criteria

- Creating a global tag does not attach it to the first visible item.
- A newly created global tag appears in tag filters and future item-level suggestions.
- Typing in a card tag input filters existing tags by substring.
- Clicking a suggestion attaches the tag only to that card's item.
- Already-attached tags are not shown as suggestions for that item.
- Removing a tag affects only the selected item.
- No bulk assignment controls are introduced in V1.
