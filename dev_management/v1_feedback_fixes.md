# V1 Feedback Fixes

This file tracks the dedicated bug-fix and V1 adaptation iteration.

## Working Rules

- Process feedback in small, reviewable slices.
- Keep each fix focused on the reported issue.
- Add or update automated checks when behavior changes.
- Update `docs` whenever a fix changes documented functionality, setup, storage, sync, AI behavior, smoke tests, logs, or user workflows.
- Keep lessons learned in `dev_management/action_log.md`.
- Move an item through: `reported` -> `in_progress` -> `ready_for_review` -> `accepted` or `rework`.

## Status

**Iteration:** Bug-fix and V1 adaptation

**State:** accepted_with_deferred_tag_assignment

## Feedback Items

| ID | Status | Summary | Code/Docs touched | Verification | Notes |
| --- | --- | --- | --- | --- | --- |
| V1-FIX-001 | accepted | Current item status is not visually highlighted; status actions look inactive/unclear. | `apps/web/src/App.vue`, `apps/web/test/App.test.ts`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-21. Manual QA accepted on 2026-04-22. | Current status text and active status button are green. |
| V1-FIX-002 | accepted | AI upstream errors render raw JSON instead of a user-readable message. | `apps/web/src/api/client.ts`, `apps/web/test/api-client.test.ts`, `apps/web/test/App.test.ts`, `docs/api/local-api.md`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-21. Manual QA accepted on 2026-04-22. | Web client translates structured API errors into actionable text; raw JSON is not shown. |
| V1-FIX-003 | deferred | Tag assignment is unclear and currently attaches a global new tag to the first item. | None | Not started | Deferred by user for separate UI discussion; do not implement in this batch. |
| V1-FIX-004 | accepted | Generated summary appears above the editor instead of immediately becoming editable in the textarea. | `apps/web/src/App.vue`, `apps/web/test/App.test.ts`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md`, `docs/product/user-stories.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Manual QA accepted on 2026-04-22. | Generated and existing summaries are represented through the editable textarea, without a duplicate preview above it. |
| V1-FIX-005 | accepted | AI summary should be generated in Russian. | `apps/desktop-api/src/domain/ai/ai-service.ts`, `apps/desktop-api/test/api/v1-routes.test.ts`, `docs/api/local-api.md`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md`, `docs/product/user-stories.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Manual QA accepted on 2026-04-22. | Summary prompt now explicitly requests Russian output. |
| V1-FIX-006 | accepted | `Suggest tags` returns OpenRouter upstream error while summary generation works with the same settings. | `apps/desktop-api/src/domain/ai/ai-service.ts`, `apps/desktop-api/src/integrations/openrouter/openrouter-client.ts`, `apps/desktop-api/src/app.ts`, `apps/desktop-api/test/api/v1-routes.test.ts`, `docs/api/local-api.md`, `docs/development/manual-smoke-scenarios.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Manual QA accepted on 2026-04-22. | Tag prompt now asks for one tag per line and backend logs safe OpenRouter status/reason diagnostics. |
| V1-FIX-007 | accepted | `Generate summary` can fail with OpenRouter `429`, but the UI showed generic guidance. | `apps/desktop-api/src/app.ts`, `apps/desktop-api/test/api/v1-routes.test.ts`, `apps/web/src/api/client.ts`, `apps/web/test/api-client.test.ts`, `scripts/openrouter-diagnostic.mjs`, `docs/api/local-api.md`, `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md` | `npm run typecheck`, `npm run lint`, `npm test` passed on 2026-04-22. Direct diagnostic: `google/gemma-4-31b-it:free` returned `429`; `openai/gpt-oss-20b:free` returned `200`. Manual QA accepted on 2026-04-22. | Fresh log and direct diagnostic showed upstream Google AI Studio rate limiting for the saved free Gemma model; the saved OpenRouter key works with another model. |
