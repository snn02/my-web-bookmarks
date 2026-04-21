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

- Decide whether default Windows Chrome profile path detection must be finished before accepting Iteration 3.
- Review source ID stability for imported Chrome bookmarks.
- Review async sync behavior and active-run protection.
