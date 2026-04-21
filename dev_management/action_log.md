# Development Action Log

This log records implementation actions, planning decisions, verification evidence, deviations, and lessons learned. Keep entries dated and append-only where practical.

## 2026-04-21

**Context reviewed**

- Read project scope from `docs/product/v1-scope.md`.
- Read user stories from `docs/product/user-stories.md`.
- Read architecture overview from `docs/architecture/overview.md`.
- Read database design from `docs/architecture/database.md`.
- Read local API contract from `docs/api/local-api.md`.

**Repository observations**

- The repository currently contains documentation only.
- No app source code or workspace tooling exists yet.
- `docs/architecture/database.md` is present as an untracked git file at the time of planning.

**Actions completed**

- Created `dev_management/iteration_plan.md`.
- Created `dev_management/action_log.md`.
- Broke V1 delivery into seven iterations from project foundation through reliability and release readiness.
- Added verification gates for automated tests, tester review, and team review for every iteration.
- Added plan maintenance rules so iteration statuses and verification evidence are updated after each iteration.

**Decisions**

- Treat the backend HTTP API as the stable boundary from the first implementation iteration.
- Defer live AI integration until after the non-AI local bookmark workflow is usable.
- Keep Chrome integration read-only for V1.
- Require every accepted iteration to update both this log and the iteration plan.

**Lessons and follow-ups**

- The documentation is already specific enough to plan development, but implementation still needs technical choices for package manager, HTTP framework, SQLite driver, migration tooling, and test stack.
- The first implementation iteration should avoid product expansion and focus on a boring, runnable, testable skeleton.

## 2026-04-21 - Iteration 0 started

**Goal**

- Establish the simplest runnable monorepo skeleton for the V1 architecture.

**Approved approach**

- npm workspaces for package management.
- Vite and Vue 3 for `apps/web`.
- Express for `apps/desktop-api`.
- Vitest for automated tests.
- TypeScript across all workspaces.

**Planned verification**

- `npm run lint`
- `npm run typecheck`
- `npm test`

**Implementation notes**

- Keep Iteration 0 focused on project foundation, shared API types, backend health endpoint, and frontend backend availability state.

**Actions completed**

- Added npm workspace root configuration.
- Added `apps/desktop-api` with Express app factory and `GET /api/v1/health`.
- Added `apps/web` with Vite, Vue 3, and backend availability rendering.
- Added `packages/shared` with V1 API base path, health response DTO, and standard API error response helper.
- Added `data/sqlite`, `data/logs`, and `data/cache` directories with `.gitkeep` files.
- Added `docs/development/local-setup.md`.
- Added tests before production code and confirmed the RED state:
  - initial test run failed because `../src/app`, `../src/App.vue`, and `../src` did not exist.

**Debugging notes**

- Initial `npm test` failed before test execution because dependencies were not installed.
- `npm install` required unrestricted network access and completed successfully.
- Vitest worker startup required running tests outside the sandbox because sandboxed process creation returned `spawn EPERM`.
- `vue-tsc` initially failed because `jsdom` was incorrectly listed as a TypeScript type library.
- `vue-tsc` then failed because Vite config used `defineConfig` from `vite`; switching to `vitest/config` made the `test` property type-safe.

**Verification evidence**

- `npm test` passed on 2026-04-21.
  - Backend: 1 test passed.
  - Web: 2 tests passed.
  - Shared: 3 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.

**Status**

- Iteration 0 implementation is ready for tester review and team review.

## 2026-04-21 - Iteration 0 QA and team review

**QA actions**

- Started backend with `npm run dev:api`.
- Verified backend health endpoint through `GET http://127.0.0.1:4321/api/v1/health`.
- Started frontend with `npm run dev:web`.
- Verified Vite served the frontend at `http://127.0.0.1:5173/`.
- Confirmed generated smoke evidence:
  - `HEALTH_STATUS=ok`
  - `WEB_STATUS=200`
  - `WEB_HAS_APP_ROOT=True`
- Confirmed no listeners remained on ports `4321` or `5173` after cleanup.

**Team review actions**

- Reviewed root workspace scripts.
- Reviewed backend app factory and health route.
- Reviewed frontend health state implementation.
- Reviewed shared API contracts.
- Reviewed local setup documentation.
- Searched frontend/shared code for direct SQLite, filesystem, Chrome, or bookmark integration references.

**Team review finding**

- The frontend duplicated `/api/v1/health` instead of composing it from the shared `API_BASE_PATH`.

**Follow-up implemented**

- Updated `apps/web/src/App.vue` to import `API_BASE_PATH` from `@my-web-bookmarks/shared` and call `${API_BASE_PATH}/health`.

**Final verification evidence**

- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - `@my-web-bookmarks/desktop-api`: 1 test passed.
  - `@my-web-bookmarks/web`: 2 tests passed.
  - `@my-web-bookmarks/shared`: 3 tests passed.

**Decision**

- Iteration 0 is accepted.
- Iteration 1 can start with SQLite persistence and core domain work.

**Iteration 1 preparation**

- Start with database initialization and migration tests.
- Choose SQLite driver and migration strategy before writing persistence implementation.
- Keep the frontend out of Iteration 1 unless shared API types need to evolve.

## 2026-04-21 - Iteration 1 started

**Goal**

- Implement SQLite persistence and backend domain repositories for imported items, tags, summaries, settings, and sync run history.

**Technical decisions**

- Use Node.js built-in `node:sqlite` with `DatabaseSync` for the V1 local backend.
- Use code-owned SQL migrations stored in backend source and tracked by a `schema_migrations` table.
- Use `crypto.randomUUID()` with resource prefixes for opaque IDs.
- Use one isolated in-memory SQLite database per automated repository test.

**Risk noted**

- `node:sqlite` is available in Node 24 but emits an experimental warning. This avoids native dependency installation now, but should be revisited before packaging if the warning or API stability becomes a problem.

**Planned TDD slices**

- Database migration creates required tables and constraints.
- URL normalization covers V1 deduplication rules.
- Item repository upserts by normalized URL and preserves user metadata.
- Tag repository handles normalized uniqueness and item relations.
- Summary, settings, and sync repositories cover V1 persistence rules.

**Actions completed**

- Added RED tests for:
  - schema migration table creation
  - URL normalization
  - item upsert and metadata preservation
  - item list filters
  - tag uniqueness, rename, attachment, and deletion
  - current summary upsert and manual edit
  - OpenRouter settings redaction
  - sync run status/count tracking
- Confirmed RED state with missing `src/db` and domain modules.
- Implemented database initialization with `schema_migrations`.
- Implemented SQL schema for `items`, `tags`, `item_tags`, `summaries`, `settings`, and `sync_runs`.
- Implemented URL normalization and domain extraction.
- Implemented item, tag, summary, settings, and sync run repositories.
- Updated backend test script to reduce main-process experimental warning noise.

**Debugging notes**

- Initial normalization test expectation contradicted the trailing-slash rule. The test was corrected to expect `https://example.com/Article?id=42`.
- `node:sqlite` returns broad `Record<string, SQLOutputValue>` row types. Repository code now uses explicit row interfaces with narrow casts at database boundaries.
- Full workspace tests still show `node:sqlite` experimental warnings from Vitest worker processes. This is documented as a known risk rather than hidden.

**Verification evidence**

- `npm run test --workspace @my-web-bookmarks/desktop-api` passed on 2026-04-21:
  - 4 test files passed.
  - 10 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 10 tests passed.
  - Web: 2 tests passed.
  - Shared: 3 tests passed.

**Status**

- Iteration 1 implementation is ready for tester review and team review.

**Next review focus**

- Confirm schema matches `docs/architecture/database.md`.
- Confirm repository boundaries are clean enough for Iteration 2 API routes.
- Decide whether `node:sqlite` remains acceptable before packaging, given the experimental warning.

## 2026-04-21 - Iteration 1 QA and team review

**QA actions**

- Ran full workspace verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
- Reviewed repository-backed test coverage for:
  - repeated imported item upsert and metadata preservation
  - tag deletion and relation cleanup
  - OpenRouter API key redaction
  - current summary editing
  - sync run count/status persistence

**Team review actions**

- Compared SQL migration against `docs/architecture/database.md`.
- Reviewed item, tag, summary, settings, and sync repository boundaries.
- Confirmed frontend still has no direct SQLite access.
- Reviewed `node:sqlite` operational risk.

**Team review finding**

- The settings repository did not expose `chrome_profile_path`, although the database architecture document lists it as an expected V1 setting.

**Follow-up implemented**

- Added a failing test for storing and clearing Chrome profile path.
- Implemented `setChromeProfilePath` and `getChromeProfilePath` in `apps/desktop-api/src/domain/settings/settings-repository.ts`.
- Re-ran the focused repository test and confirmed it passed.

**Final verification evidence**

- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 11 tests passed.
  - Web: 2 tests passed.
  - Shared: 3 tests passed.

**Decision**

- Iteration 1 is accepted.
- `node:sqlite` remains acceptable for now because it avoids native dependency setup and keeps the project simple, but the experimental warning stays in the risk register for packaging review.
- Iteration 2 can start with API contract tests around the repository layer.

**Iteration 2 preparation**

- Implement HTTP routes over the existing repositories.
- Add common validation and error response handling first.
- Keep Chrome sync implementation and live AI calls out of Iteration 2.

## 2026-04-21 - Iteration 2 started

**Goal**

- Expose the accepted repository layer through the stable `/api/v1` HTTP JSON contract for items, tags, summaries, and settings.

**Scope decision**

- Implement items, tags, summaries, settings, and AI placeholder endpoints.
- Keep Chrome bookmark sync endpoints out of this iteration because Chrome import and async sync are owned by Iteration 3.

**Planned TDD slices**

- API route tests for item list/detail/status update and validation errors.
- API route tests for tag create/rename/delete/attach/detach and conflict handling.
- API route tests for current summary read/manual edit and AI summary placeholder.
- API route tests for settings redaction and patch behavior.
- Common error response helper for `validation_error`, `not_found`, `conflict`, and `ai_not_configured`.

**Actions completed**

- Added API contract tests for:
  - item list/detail/status update
  - item validation and not-found errors
  - tag create/list/rename/delete
  - item tag attach/detach
  - duplicate tag conflict handling
  - current summary read/manual edit
  - AI summary and tag suggestion placeholders
  - OpenRouter settings redaction
- Confirmed RED state: new API route tests returned 404 for all new endpoints before implementation.
- Implemented injectable database support in `createApp`.
- Implemented common API error sender.
- Implemented items, tags, summaries, settings, and AI placeholder endpoints.
- Added `getTag` and `listTags` to the tag repository for route support.

**Verification evidence**

- Focused API route test passed on 2026-04-21:
  - `apps/desktop-api/test/api/v1-routes.test.ts`: 8 tests passed.
- Backend test suite passed on 2026-04-21:
  - 5 test files passed.
  - 19 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 19 tests passed.
  - Web: 2 tests passed.
  - Shared: 3 tests passed.

**Status**

- Iteration 2 implementation is ready for tester review and team review.

**Next review focus**

- Compare implemented routes with `docs/api/local-api.md`.
- Confirm validation errors are specific enough for frontend use.
- Confirm repository layer remains hidden behind the HTTP API.
- Confirm Chrome sync remains cleanly deferred to Iteration 3.

## 2026-04-21 - Iteration 2 QA and team review

**QA actions**

- Ran full workspace verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
- Reviewed API contract tests as HTTP-level QA with repository-seeded data.
- Confirmed covered workflows:
  - item list/detail/status update
  - tag create/list/rename/attach/detach/delete
  - duplicate tag conflict
  - summary read/manual edit
  - AI placeholder errors
  - settings redaction

**Team review actions**

- Compared implemented routes with `docs/api/local-api.md`.
- Reviewed validation and error response behavior.
- Confirmed repository layer remains hidden behind HTTP routes.
- Confirmed Chrome sync routes are intentionally deferred to Iteration 3.

**Team review finding**

- `GET /items` did not implement the documented `sort` query parameter.

**Follow-up implemented**

- Added a failing API contract test for `sort=importedAt:asc`, `sort=updatedAt:desc`, and unsupported sort rejection.
- Implemented item sort support in `apps/desktop-api/src/domain/items/item-repository.ts`.
- Added sort validation in `apps/desktop-api/src/app.ts`.
- Re-ran focused API tests and full workspace verification.

**Final verification evidence**

- Focused API route test passed on 2026-04-21:
  - `apps/desktop-api/test/api/v1-routes.test.ts`: 9 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 20 tests passed.
  - Web: 2 tests passed.
  - Shared: 3 tests passed.

**Decision**

- Iteration 2 is accepted.
- Manual HTTP smoke with persistent seeded data is deferred until file-backed database wiring exists; current API contract tests provide HTTP-level coverage.
- Iteration 3 can start with Chrome bookmark parser fixtures, read-only import, and sync status orchestration.

**Iteration 3 preparation**

- Create Chrome bookmark JSON fixtures.
- Implement parser and URL deduplication through the existing item repository.
- Add sync active-run protection and status endpoints.
- Keep local Chrome bookmark access read-only.

## 2026-04-21 - Iteration 3 started

**Goal**

- Import Chrome bookmarks from a configured local profile path, deduplicate imported items, and expose sync start/status through the HTTP API.

**Scope decision**

- Implement read-only Chrome `Bookmarks` JSON parsing.
- Use existing item repository for URL normalization and deduplication.
- Use existing settings repository for `chrome_profile_path`.
- Use existing sync run repository for sync status and counts.
- Keep bookmark deletion and Chrome bookmark editing out of scope.

**Planned TDD slices**

- Chrome bookmark parser fixture test for recursive folders.
- Import service tests for created/updated/skipped counts and metadata preservation.
- Failure test for missing or malformed bookmark files.
- API tests for `POST /sync/bookmarks`, `GET /sync/status`, and `sync_already_running`.

**Actions completed**

- Added Chrome `Bookmarks` fixture under `apps/desktop-api/test/fixtures/chrome-profile/Bookmarks`.
- Added parser tests for recursive Chrome bookmark folders.
- Added sync service tests for:
  - imported, updated, and skipped counts
  - metadata preservation on re-import
  - failed sync status for missing profile path
- Added sync API tests for:
  - `POST /sync/bookmarks`
  - `GET /sync/status`
  - `sync_already_running`
- Confirmed RED state:
  - missing parser and sync service modules
  - sync API routes returning 404
- Implemented read-only Chrome bookmarks parser.
- Implemented bookmark sync service.
- Implemented active sync run protection.
- Implemented async sync API response and latest status mapping.
- Refactored sync existing-item detection to use normalized URL lookup instead of text search.

**Debugging notes**

- Parser initially included both the Chrome root key and root display name in `sourceId`. It now keeps the root key plus user folder path to avoid redundant IDs such as `bookmark_bar/Bookmarks bar/...`.
- API initially returned a completed `succeeded` sync response from `POST /sync/bookmarks`. The API spec requires asynchronous behavior, so the route now returns `running` immediately and completes the import in the background.

**Verification evidence**

- Focused Iteration 3 test suite passed on 2026-04-21:
  - 3 test files passed.
  - 7 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 27 tests passed.
  - Web: 2 tests passed.
  - Shared: 3 tests passed.

**Status**

- Iteration 3 implementation is ready for tester review and team review.

**Next review focus**

- Confirm saved-settings-only Chrome profile path behavior is acceptable for V1.
- Review source ID stability for imported Chrome bookmarks.
- Review async sync behavior and active-run protection.

## 2026-04-21 - Iteration 3 QA and team review

**Scope decision**

- User confirmed default Windows Chrome profile path detection should not be implemented.
- V1 sync uses only the saved `chrome_profile_path` setting.

**QA actions**

- Ran full workspace verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
- Reviewed parser, sync service, and sync API tests.
- Confirmed tests cover:
  - recursive Chrome bookmark parsing
  - invalid URL skipping
  - deduplication by normalized URL
  - metadata preservation on re-import
  - missing profile/bookmarks file failure status
  - async `POST /sync/bookmarks`
  - `GET /sync/status`
  - `sync_already_running`

**Team review actions**

- Confirmed parser reads Chrome `Bookmarks` file only and does not write to Chrome.
- Confirmed sync service reads profile path only from persisted settings.
- Confirmed no default Chrome profile path detection code exists.

**Follow-up implemented**

- Added a QA test for unset `chrome_profile_path`.
- Confirmed unset profile path records a failed sync with `Chrome profile path is not configured.`.

**Final verification evidence**

- Focused sync service QA test passed on 2026-04-21:
  - 1 test file passed.
  - 4 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 28 tests passed.
  - Web: 2 tests passed.
  - Shared: 3 tests passed.

**Decision**

- Iteration 3 is accepted.
- Default Windows profile path detection is out of scope for V1 unless explicitly reintroduced later.
- Iteration 4 can start with the web inbox over the existing HTTP API.

**Iteration 4 preparation**

- Build frontend API client for items, tags, summaries, settings, and sync endpoints.
- Add inbox list and processing UI tests before UI implementation.
- Keep AI generation UI as disabled/placeholder unless covered by Iteration 5.

## 2026-04-21 - Iteration 4 started

**Goal**

- Deliver the first usable web inbox for local bookmark processing over the existing HTTP API.

**Scope decision**

- Build API client and single-screen inbox UI.
- Include sync trigger, Chrome profile setting input, item list, search/status/tag filters, status actions, tag creation/attach/detach, summary display/manual edit, loading/error/empty states.
- Keep live AI generation controls out of scope until Iteration 5.

**Planned TDD slices**

- API client tests for items, tags, settings, sync, status update, tag attach/detach, and summary update.
- App tests for initial load, backend unavailable state, filtering, status update, tag creation/attach, sync trigger, and settings save.

**Actions completed**

- Added frontend API client tests.
- Added App workflow tests for inbox loading, backend unavailable state, filtering, status update, tag creation/attach, settings save, and sync trigger.
- Confirmed RED state:
  - missing `src/api/client`
  - App still rendering only health shell
- Implemented `apps/web/src/api/client.ts`.
- Replaced `apps/web/src/App.vue` with the first inbox screen.
- Added backend settings API support for saved `chromeProfilePath` so the frontend settings control has a real backend contract.

**Debugging notes**

- Initial App workflow test mock order returned an item status response where an item list response was expected; fixed the test setup to match the real request sequence.
- Summary text is now rendered as visible preview text in addition to editable textarea content.
- Backend settings API shape now includes `chromeProfilePath: string | null`.

**Verification evidence**

- `npm run test --workspace @my-web-bookmarks/web` passed on 2026-04-21:
  - 2 test files passed.
  - 5 tests passed.
- Focused backend settings tests passed on 2026-04-21:
  - 2 test files passed.
  - 17 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 29 tests passed.
  - Web: 5 tests passed.
  - Shared: 3 tests passed.

**Status**

- Iteration 4 implementation is ready for tester review and team review.

**Next review focus**

- Decide whether tag rename UI is required before accepting Iteration 4.
- Review whether the single-screen inbox workflow is ergonomic enough for first manual use.
- Verify UI with a real synced dataset once a persisted dev database is introduced.

## 2026-04-21 - Iteration 4 QA and team review

**Scope decision**

- User confirmed tag rename UI should not be implemented as part of Iteration 4.
- Existing backend API support for tag rename remains available for a future explicit task.

**QA actions**

- Reviewed the web inbox workflow against the Iteration 4 acceptance scope.
- Confirmed the implemented first screen covers:
  - backend availability state;
  - item loading;
  - search and status/tag filters;
  - status changes;
  - tag creation, attach, and detach;
  - summary preview and manual summary edit;
  - Chrome profile path setting save;
  - bookmark sync trigger and status display.
- Confirmed live AI generation remains absent from the UI until Iteration 5.

**Team review**

- Frontend code uses `apps/web/src/api/client.ts` for HTTP API access.
- No frontend code reaches directly into backend repositories, SQLite, or Chrome bookmark parser internals.
- Backend settings contract now includes saved `chromeProfilePath`, matching the user decision to avoid profile path auto-detection.
- The first inbox workflow is sufficient for V1 non-AI bookmark review and processing.

**Verification evidence**

- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 29 tests passed.
  - Web: 5 tests passed.
  - Shared: 3 tests passed.

**Decision**

- Iteration 4 is accepted.
- Tag rename UI is out of scope unless reintroduced by a later product decision.
- Iteration 5 can start with OpenRouter settings and AI workflows.

## 2026-04-21 - Iteration 4 post-QA sync UI hotfix

**User finding**

- During manual browser verification, pressing Sync appeared to do nothing useful: the UI showed `Sync: running`, item count stayed at 0, and no error was visible.

**Root cause**

- `POST /sync/bookmarks` starts an async backend run and returns the initial `running` status.
- The web UI did not poll `GET /sync/status` after starting sync.
- The web UI did not refresh the item list after successful sync.
- The web UI did not render `syncStatus.error`, so a missing or wrong Chrome profile path was invisible to the user.
- UX risk found during test tightening: Sync depended on a separately saved path, so a user could type a path and press Sync before the setting was persisted.

**Planning mistakes and corrections**

- Planning mistake: Iteration 4 acceptance treated "sync trigger exists" as enough, but did not define the complete user-observable sync lifecycle.
  - Correction: future iteration acceptance criteria must describe the full async flow: start action, progress/running state, final state, error state, and data refresh after completion.
- Planning mistake: QA checklist said to verify sync trigger and latest sync status, but did not require verifying the item list after sync completion.
  - Correction: QA checks for import-like actions must include a before/after data assertion: item count changes, imported item appears, or a visible failure explains why it did not.
- Planning mistake: the first UI test only asserted that `POST /sync/bookmarks` was called, so it tested transport wiring rather than the user's outcome.
  - Correction: UI tests now assert outcome behavior: final sync status is rendered, errors are visible, and imported items appear after sync.
- Planning mistake: the settings workflow assumed the user would press Save path before Sync.
  - Correction: Sync now persists the current path before starting, and future UX planning should avoid hidden ordering requirements between adjacent controls.
- Planning mistake: manual QA before acceptance did not include a real browser run against the running backend with a realistic Chrome profile path.
  - Correction: before accepting UI iterations that cross frontend/backend boundaries, add at least one manual smoke pass using the actual dev server and a realistic local input.

**TDD evidence**

- Added failing web tests for:
  - Sync polling to final `succeeded` status and refreshing the inbox.
  - Showing sync failure errors returned by the backend.
- RED confirmed: tests failed because the UI stayed on `running` and did not show the failure message.

**Actions completed**

- Updated Sync button behavior to save the current Chrome profile path before starting sync.
- Added sync status polling after `POST /sync/bookmarks`.
- Refreshed the inbox after successful sync completion.
- Displayed sync failure errors inline near sync status.
- Disabled the Sync button while a sync attempt is in progress.

**Verification evidence**

- `npm run test --workspace @my-web-bookmarks/web` passed on 2026-04-21:
  - 2 test files passed.
  - 6 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 29 tests passed.
  - Web: 6 tests passed.
  - Shared: 3 tests passed.

**Decision**

- Iteration 4 remains accepted with a post-QA hotfix.
- The user should retry Sync with a full Chrome profile folder path such as `C:\Users\<user>\AppData\Local\Google\Chrome\User Data\Default`; the app will now show the backend error if the `Bookmarks` file is not found.

## 2026-04-21 - Future iteration plan updated from Iteration 4 lessons

**Actions completed**

- Added lessons-learned gates to the iteration plan for all remaining work.
- Updated Iteration 5 with explicit lifecycle requirements for AI workflows: idle, generating, success, failure, retry/regenerate, visible final state, and before/after outcome assertions.
- Updated Iteration 5 QA and team review expectations so tests must verify user-visible outcomes, not only API calls.
- Updated Iteration 6 reliability scope to include lifecycle smoke testing, realistic local input, timeout/failure visibility, and no indefinite running/loading states.

**Planning correction**

- Future iterations must convert post-QA lessons into acceptance gates before implementation begins.
- QA/team review must check that every async or side-effect workflow has a complete observable lifecycle and a visible user outcome.

## 2026-04-21 - Iteration 5 started and implemented

**Scope decision**

- User approved the Iteration 5 design and allowed implementation on `master`.
- Implemented OpenRouter workflow with simple V1 article context: bookmark title, URL, domain, and current summary.
- Full article fetching/extraction is deferred; metadata-only prompting is the V1 strategy for this iteration.

**TDD actions**

- Backend RED:
  - Added tests expecting AI summary generation to store a current summary.
  - Added regeneration test expecting the current summary to be replaced.
  - Added tag suggestion test expecting suggestions to be returned without persistence.
  - Added upstream failure test expecting `upstream_error`.
  - RED confirmed because existing endpoints still returned `ai_not_configured`.
- Backend GREEN:
  - Added mockable OpenRouter client.
  - Added AI service for summary generation and tag suggestions.
  - Wired `POST /items/:itemId/summary` and `POST /items/:itemId/tag-suggestions`.
- Frontend RED:
  - Added API client tests for OpenRouter settings, summary generation, and tag suggestions.
  - Added App workflow tests for user-visible AI outcomes and visible failure state.
  - RED confirmed because client methods and UI controls did not exist.
- Frontend GREEN:
  - Added OpenRouter API key/model controls.
  - Added generate/regenerate summary action.
  - Added suggest tags and confirm suggested tag flow.
  - AI actions save current settings before calling generation/suggestion endpoints.

**Lessons-learned gates applied**

- AI workflows now assert user-visible outcomes, not only API calls.
- AI actions avoid hidden ordering requirements by saving current settings before running.
- Failure states are visible in the UI.
- Tag suggestions are not persisted until the user confirms them.
- API key remains write-only from the UI perspective; public settings expose only `apiKeyConfigured`.

**Verification evidence**

- `npm run test --workspace @my-web-bookmarks/desktop-api` passed on 2026-04-21:
  - 8 test files passed.
  - 33 tests passed.
- `npm run test --workspace @my-web-bookmarks/web` passed on 2026-04-21:
  - 2 test files passed.
  - 8 tests passed.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 33 tests passed.
  - Web: 8 tests passed.
  - Shared: 3 tests passed.

**Status**

- Iteration 5 implementation is ready for QA and team review.

## 2026-04-21 - Iteration 5 QA and team review

**QA findings**

- Finding: OpenRouter network exceptions were not normalized by the client.
  - Impact: a rejected `fetch` could surface as an unhandled 500 instead of the planned `upstream_error`.
  - Fix: wrapped fetch and JSON parsing in the OpenRouter client and mapped failures to `OpenRouterRequestError`.
  - Regression test: backend test now verifies network failures return `502 upstream_error`.
- Finding: AI actions saved `apiKey: ""` when the password field was empty.
  - Impact: a user with an already configured API key could click Generate and accidentally clear the saved key.
  - Fix: frontend sends `apiKey` only when the user enters a non-empty replacement key.
  - Regression test: web test now verifies generation with an existing configured key sends only the model.
- Finding: confirming an AI suggestion always attempted to create a new tag.
  - Impact: if the suggested tag already existed, confirmation would hit duplicate-tag conflict instead of attaching the existing tag.
  - Fix: frontend now reuses an existing matching tag before creating a new one.
  - Regression test: web test now verifies an existing matching tag is attached without `POST /tags`.

**Team review**

- OpenRouter integration is isolated behind `apps/desktop-api/src/integrations/openrouter/openrouter-client.ts`.
- AI domain logic is isolated in `apps/desktop-api/src/domain/ai/ai-service.ts`.
- Public settings continue to redact the raw API key.
- AI workflows have outcome-based frontend tests covering success, visible failure, settings preservation, and suggestion confirmation.
- Metadata-only prompt context is acceptable for V1; full article extraction remains an explicit future task.

**Verification evidence**

- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Backend: 34 tests passed.
  - Web: 10 tests passed.
  - Shared: 3 tests passed.

**Residual risk**

- Live OpenRouter smoke with a real API key and network access was not performed in this environment.
- User verification should include one real low-cost model run before relying on AI workflows for daily use.

**Decision**

- Iteration 5 is accepted.
- Iteration 6 can start with reliability, observability, and packaging readiness.

## 2026-04-21 - Iteration 6 started

**Scope decision**

- Started with the release-readiness slice: automated smoke script, Windows release checklist, backup guidance, and manual smoke scenarios.
- Deferred structured local logs and durable database storage to the next Iteration 6 slice.
- Packaging decision for V1: keep local development commands plus checklist; defer Electron/Tauri until a non-developer launch experience is required.

**TDD actions**

- RED:
  - Added smoke helper tests before the smoke module existed.
  - Confirmed missing module failure for `scripts/smoke-test.mjs`.
- GREEN:
  - Added `scripts/smoke-test.mjs` with URL building, lifecycle final-state detection, report generation, and secret redaction helpers.
  - Added `scripts/smoke-runner.ts` to start the Express app in-process and run real HTTP lifecycle checks.
  - Added `npm run smoke` and `npm run test:smoke`.
  - Root `npm test` now runs smoke helper tests before workspace tests.

**Debugging notes**

- Initial smoke runner attempted to spawn `npm run dev:api` from Node.
- On this Windows/sandbox setup, nested child process spawning produced `spawn EINVAL` or `spawn EPERM`.
- Fix: avoid shell-dependent spawning and run the backend in-process through `tsx scripts/smoke-runner.ts`.

**Documentation added**

- `docs/release/windows-v1-checklist.md`
- `docs/development/data-backup.md`
- `docs/development/manual-smoke-scenarios.md`

**Smoke coverage**

- `npm run smoke` starts backend on a local smoke port.
- Checks `/api/v1/health`.
- Checks `/api/v1/settings` does not expose OpenRouter-style keys.
- Checks `/api/v1/items` returns a list response.
- Starts bookmark sync without Chrome profile path.
- Verifies sync reaches final failed state with a visible error.

**Verification evidence**

- `npm run test:smoke` passed on 2026-04-21:
  - 6 tests passed.
- `npm run smoke` passed on 2026-04-21:
  - health: ok.
  - settings redaction: ok.
  - items list: ok.
  - sync lifecycle started: ok.
  - sync lifecycle failure is visible: ok.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Smoke helpers: 6 tests passed.
  - Backend: 34 tests passed.
  - Web: 10 tests passed.
  - Shared: 3 tests passed.

**Status**

- Iteration 6 remains in progress.
- First release-readiness slice is ready for QA/team review.
- Remaining planned Iteration 6 work: structured local logs, durable data decision, and additional defensive failure handling.

## 2026-04-21 - Iteration 6 structured logging slice

**Scope decision**

- Add structured local JSONL logs under `data/logs`.
- Keep logging narrowly focused on runtime lifecycle and diagnostic events.
- Avoid logging raw OpenRouter API keys at the source; also redact OpenRouter-style keys before file writes as defense in depth.

**TDD actions**

- RED:
  - Added logger unit tests before `apps/desktop-api/src/logging/app-logger.ts` existed.
  - Added API tests expecting sync, AI, and settings events to be logged.
  - RED confirmed because logger module was missing and app events were not logged.
- GREEN:
  - Added `createFileLogger`, `createNoopLogger`, `AppLogger`, and recursive `redactLogValue`.
  - Added `createApp({ logger })` injection.
  - Added file logger usage in `apps/desktop-api/src/server.ts`.
  - Added logging for backend start, OpenRouter settings updates, sync start/finish, AI summary success/failure, and AI tag suggestion success/failure.
  - Extended `npm run smoke` to verify structured logs are written without OpenRouter-style secrets.

**Debugging notes**

- Initial settings event included the raw API key in injected test logger metadata.
- Fix: do not pass raw `apiKey` into log metadata at all; log only `apiKeyProvided` and model.

**Documentation updated**

- `docs/release/windows-v1-checklist.md` now includes log checks.
- `docs/development/data-backup.md` now documents `data/logs/desktop-api.log`, JSONL format, redaction, and sharing cautions.

**Verification evidence**

- `npm run smoke` passed on 2026-04-21:
  - structured logs written without secrets: ok.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Smoke helpers: 6 tests passed.
  - Backend: 36 tests passed.
  - Web: 10 tests passed.
  - Shared: 3 tests passed.

**Status**

- Structured logging slice is ready for QA/team review.
- Iteration 6 remains in progress.
- Remaining planned Iteration 6 work: durable database/storage decision and additional defensive failure handling.

## 2026-04-21 - Iteration 6 durable storage plan updated

**Planning update**

- Normal backend startup should use durable SQLite storage at root `data/sqlite/app.db`.
- `DATABASE_PATH` should override the default path for development, smoke, and future packaging.
- Automated tests should continue using in-memory or temporary databases.
- `npm run smoke` must use an isolated temporary database and must not mutate the real app database.
- Startup database or migration failures should be logged as `database.startup.failed` and exit with a non-zero process code.

**Acceptance additions**

- File database data survives close/reopen.
- Root server startup uses file database by default.
- Smoke runner uses temporary file database.
- Backup docs point to the real durable database location.
- Migration/startup failure path has tests or a focused manual verification note.

## 2026-04-21 - Iteration 6 durable storage and startup hardening

**TDD actions**

- RED:
  - Added file database persistence-across-reopen test.
  - Added default durable database path test.
  - Added isolated smoke database path test.
  - Added startup failure logging test.
  - RED confirmed because file database helpers, smoke database path helper, and startup helper did not exist.
- GREEN:
  - Added `createFileDatabase`.
  - Added `getDefaultDatabasePath`.
  - Normal backend startup now uses durable SQLite at root `data/sqlite/app.db`.
  - Added `DATABASE_PATH` override support.
  - Smoke runner now uses isolated temporary SQLite database paths.
  - Added `startDesktopApi` startup helper with tested `database.startup.failed` logging on database open/migration failure.

**Debugging notes**

- First default database path implementation used `process.cwd()`.
- Workspace tests showed this could create `apps/desktop-api/data/sqlite/app.db`.
- Fix: resolve default database path from the source file location to the repository root, not from `cwd`.
- Removed the generated erroneous `apps/desktop-api/data` runtime artifact.

**Documentation updated**

- `docs/development/data-backup.md` now documents real storage at `data/sqlite/app.db`, `DATABASE_PATH`, and isolated smoke databases.
- `docs/release/windows-v1-checklist.md` now asks the tester to confirm `data/sqlite/app.db` creation and backup/restore steps.

**Verification evidence**

- `npm run smoke` passed on 2026-04-21 and did not create `apps/desktop-api/data`.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Smoke helpers: 7 tests passed.
  - Backend: 39 tests passed.
  - Web: 10 tests passed.
  - Shared: 3 tests passed.

**Status**

- Iteration 6 implementation is ready for QA and team review.

## 2026-04-21 - Iteration 6 QA and team review

**QA finding**

- Finding: `npm run smoke` checked the whole `data/logs/desktop-api.log` file for sync log entries.
  - Impact: old log lines from previous runs could make the smoke check pass even if the current run did not write structured sync logs.
  - Fix: smoke now records the log file offset at the start of the run and validates only the fresh log tail written during the current smoke run.
  - Regression test: smoke helper test now verifies `sliceNewLogContent`.

**QA coverage**

- `npm run smoke` validates backend health, settings redaction, item list API shape, sync lifecycle final failure state, and current-run structured logs without OpenRouter-style secrets.
- Database tests validate file database persistence across close/reopen.
- Startup tests validate database startup failure logging through `database.startup.failed`.
- Docs cover Windows release checklist, manual smoke scenarios, `data/sqlite/app.db`, `DATABASE_PATH`, `data/logs/desktop-api.log`, backup, restore, and sharing cautions.

**Team review**

- V1 packaging decision is acceptable: local commands plus checklist, Electron/Tauri deferred.
- Durable storage is simple and local-first: root `data/sqlite/app.db` by default, `DATABASE_PATH` override for isolation and future packaging.
- Smoke tests avoid mutating the real app database.
- Structured logs are JSONL and redacted for OpenRouter-style keys.
- Startup failure handling is testable and logs actionable context.

**Verification evidence**

- `npm run smoke` passed on 2026-04-21:
  - health: ok.
  - settings redaction: ok.
  - items list: ok.
  - sync lifecycle started: ok.
  - sync lifecycle failure is visible: ok.
  - structured logs written without secrets: ok.
- `npm run typecheck` passed on 2026-04-21.
- `npm run lint` passed on 2026-04-21.
- `npm test` passed on 2026-04-21:
  - Smoke helpers: 8 tests passed.
  - Backend: 39 tests passed.
  - Web: 10 tests passed.
  - Shared: 3 tests passed.

**Residual risk**

- Node `node:sqlite` remains experimental and emits warnings during tests.
- Real-world smoke with an actual Chrome profile and optional real OpenRouter key should still be performed before daily use.

**Decision**

- Iteration 6 is accepted.
- V1 is ready for local structured feedback and manual real-data smoke testing.

## 2026-04-21 - V1 feedback fix iteration opened

**Scope decision**

- Opened a dedicated bug-fix and V1 adaptation iteration for tester feedback.
- Created `dev_management/v1_feedback_fixes.md` as the working tracker for reported issues and small fixes.
- Lessons learned will continue to be recorded in this `action_log.md`.

**Working rules**

- Process each feedback item as a small focused slice.
- Update `docs` for every fix that changes documented functionality, setup, storage, sync, AI behavior, smoke tests, logs, or user workflows.
- Add or update automated verification when behavior changes.
- Keep V1 feedback status separate from the original iteration plan while preserving major lessons in the action log.
