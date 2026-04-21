# My Web Bookmarks Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for parallelizable implementation tasks or `superpowers:executing-plans` for inline execution. Keep checkbox statuses current after each iteration.

**Goal:** Deliver a V1 local-first Windows application for importing Chrome bookmarks, processing them in a reading inbox, enriching them with manual and AI-assisted metadata, and retrieving them through search and filters.

**Architecture:** Build a monorepo with `apps/web`, `apps/desktop-api`, and `packages/shared`. The Vue frontend talks only to a stable HTTP JSON API under `/api/v1`; the backend owns Chrome bookmark import, SQLite persistence, OpenRouter calls, and local configuration. SQLite is the source of app-specific metadata, while Chrome remains the source of bookmark input.

**Tech Stack:** Vue 3, TypeScript, Node.js, SQLite, HTTP JSON API, OpenRouter, Windows local Chrome profile integration.

---

## Operating Model

This plan is maintained as the development control document. After every iteration, update:

- the iteration status: `planned`, `in_progress`, `ready_for_test`, `accepted`, or `rework`
- the checklist state for completed scope
- the verification evidence: automated tests, tester review, team review
- newly discovered risks, decisions, and follow-up tasks

Implementation actions, deviations, test results, and lessons learned are logged in `dev_management/action_log.md`.

## Current Project Baseline

Existing documentation:

- `docs/product/v1-scope.md`
- `docs/product/user-stories.md`
- `docs/architecture/overview.md`
- `docs/architecture/database.md`
- `docs/api/local-api.md`

Current repository state:

- Product and architecture documentation exists.
- Application source code has not been scaffolded yet.
- `docs/architecture/database.md` is currently untracked in git and should be reviewed before the first development commit.

## Roles And Review Gates

**Team Lead**

- Owns iteration scope, sequencing, technical decisions, and status updates in this plan.
- Confirms that each iteration has a working vertical outcome, not only isolated code.
- Maintains the action log and captures lessons learned.

**Developers**

- Work task-by-task with TDD where practical.
- Keep commits small and tied to iteration deliverables.
- Add or update tests with each behavioral change.

**Tester**

- Reviews acceptance criteria from the user's perspective.
- Runs exploratory checks against the built app and API.
- Records defects with reproduction steps and expected behavior.

**Team Review**

- Reviews architecture fit, maintainability, API contract stability, data safety, and operational risks.
- Confirms whether the iteration result is acceptable for the next iteration.

## Definition Of Done For Every Iteration

An iteration can move to `accepted` only when:

- automated tests for the iteration pass locally
- linting/type checks pass for touched workspaces
- tester review is complete with no unresolved blocking defects
- team review is complete and decisions are documented
- this plan is updated with final status and verification evidence
- `dev_management/action_log.md` contains a dated implementation summary

## Iteration 0: Project Foundation

**Status:** accepted

**Objective:** Establish the monorepo, shared tooling, executable baseline, and CI-ready quality gates.

**Scope**

- [x] Create repository layout: `apps/web`, `apps/desktop-api`, `packages/shared`, `data/sqlite`, `data/logs`, `data/cache`.
- [x] Configure TypeScript for all packages.
- [x] Configure package management and workspace scripts.
- [x] Add lint, format, typecheck, and test commands.
- [x] Add minimal backend health endpoint: `GET /api/v1/health`.
- [x] Add minimal web app that calls the health endpoint and renders backend availability.
- [x] Add shared DTO package for API response/error conventions.
- [x] Document local setup commands.

**Primary Files**

- `package.json`
- `tsconfig.base.json`
- `apps/web/*`
- `apps/desktop-api/*`
- `packages/shared/*`
- `docs/development/local-setup.md`

**Automated Verification**

- `npm run lint`
- `npm run typecheck`
- `npm test`
- Backend API test: `GET /api/v1/health` returns `{ "status": "ok" }`.
- Frontend component/integration test verifies health state rendering.

**Tester Review**

- Start backend and frontend locally on Windows.
- Open the web app and confirm it shows backend availability.
- Stop backend and confirm the frontend shows a non-crashing unavailable state.

**Team Review**

- Confirm workspace layout matches architecture docs.
- Confirm scripts are simple enough for future agents and developers.
- Confirm API error convention is represented in shared types.

**Exit Result**

- A runnable skeleton exists and can be validated automatically.
- Development can proceed without reworking project structure.

**Implementation Notes**

- 2026-04-21: User approved the simplest Approach A: npm workspaces, Vite/Vue 3, Express, Vitest, and TypeScript.
- 2026-04-21: Implemented runnable skeleton with `apps/web`, `apps/desktop-api`, `packages/shared`, and data directories.

**Verification Evidence**

- 2026-04-21: `npm test` passed.
  - `@my-web-bookmarks/desktop-api`: 1 file, 1 test passed.
  - `@my-web-bookmarks/web`: 1 file, 2 tests passed.
  - `@my-web-bookmarks/shared`: 1 file, 3 tests passed.
- 2026-04-21: `npm run typecheck` passed for all workspaces.
- 2026-04-21: `npm run lint` passed for all workspaces. Current lint script is intentionally simple and delegates to TypeScript checks for Iteration 0.
- 2026-04-21: Final review verification passed after team-review refactor:
  - `npm test`: backend 1 test passed, web 2 tests passed, shared 3 tests passed.
  - `npm run typecheck`: passed for all workspaces.
  - `npm run lint`: passed for all workspaces.

**Tester Review Status**

- Accepted on 2026-04-21.
- Smoke evidence:
  - `npm run dev:api` started backend on `http://127.0.0.1:4321`.
  - `GET http://127.0.0.1:4321/api/v1/health` returned `status=ok`.
  - `npm run dev:web` started Vite on `http://127.0.0.1:5173`.
  - `GET http://127.0.0.1:5173/` returned HTTP `200` and served the app root.
  - Backend unavailable state is covered by frontend component test with rejected `fetch`.

**Team Review Status**

- Accepted on 2026-04-21.
- Review notes:
  - Workspace layout matches the documented architecture.
  - Frontend has no direct SQLite, filesystem, Chrome bookmark, or backend-internal access.
  - Shared package owns the V1 API base path, health response DTO, and standard API error shape.
  - Team-review refactor replaced a duplicated frontend API path with `API_BASE_PATH` from shared.
  - Iteration 0 intentionally uses TypeScript checks as the initial lint gate; a dedicated ESLint setup can be added when style rules become valuable.

## Iteration 1: SQLite Persistence And Core Domain

**Status:** accepted

**Entry Notes**

- Iteration 0 is accepted.
- Start with TDD around database initialization, migrations, URL normalization, and repositories.
- Technical decisions still needed at iteration start: SQLite driver, migration approach, ID generation, test database strategy.
- 2026-04-21 decisions:
  - SQLite driver: built-in Node.js `node:sqlite` `DatabaseSync`.
  - Migration approach: code-owned SQL migrations applied through a small `schema_migrations` table.
  - ID generation: `crypto.randomUUID()` with resource prefixes.
  - Test database strategy: isolated in-memory SQLite database per test.
  - Known risk: Node currently emits an experimental warning for `node:sqlite`; keep this visible and revisit if it becomes operationally noisy.

**Objective:** Implement the local database schema and repository layer for items, tags, summaries, settings, and sync history.

**Scope**

- [x] Create SQLite initialization and migration mechanism.
- [x] Implement tables: `items`, `tags`, `item_tags`, `summaries`, `settings`, `sync_runs`.
- [x] Implement URL normalization used for item deduplication.
- [x] Implement repository functions for item create/update/list/detail/status changes.
- [x] Implement repository functions for tag create/rename/delete/attach/detach.
- [x] Implement repository functions for current summary read/upsert/manual update.
- [x] Implement settings repository with OpenRouter secret redaction at API boundary.
- [x] Implement sync run repository for latest status and run history.

**Primary Files**

- `apps/desktop-api/src/db/*`
- `apps/desktop-api/src/domain/items/*`
- `apps/desktop-api/src/domain/tags/*`
- `apps/desktop-api/src/domain/summaries/*`
- `apps/desktop-api/src/domain/settings/*`
- `apps/desktop-api/src/domain/sync/*`
- `packages/shared/src/*`

**Automated Verification**

- Migration test creates all required tables on an empty database.
- Repository tests use isolated temporary SQLite databases.
- URL normalization tests cover whitespace, host casing, fragments, trailing slash handling, and common `utm_*` parameters.
- Deduplication test proves repeated normalized URLs update one item rather than creating duplicates.
- Tag uniqueness test proves case-insensitive duplicate names produce a conflict.

**Tester Review**

- Use seeded test data through API or a dev script.
- Confirm imported-like items preserve status, tags, and summary after repeated upsert.
- Confirm deleting a tag removes it from items without deleting items.

**Team Review**

- Confirm schema follows `docs/architecture/database.md`.
- Confirm no frontend code accesses SQLite directly.
- Confirm secret handling is acceptable for V1 and future OS secure storage migration remains possible.

**Exit Result**

- The backend has a reliable local persistence layer that protects user metadata across repeated imports.

**Implementation Notes**

- 2026-04-21: Implemented database initialization and code-owned SQL migration `001_v1_schema`.
- 2026-04-21: Implemented domain repositories for items, tags, summaries, settings, and sync runs.
- 2026-04-21: Implemented V1 URL normalization for deduplication.
- 2026-04-21: Used in-memory SQLite databases for repository tests.
- 2026-04-21: `node:sqlite` experimental warning remains visible during full workspace tests; risk is accepted for now and should be revisited before packaging.

**Verification Evidence**

- 2026-04-21: RED confirmed before implementation:
  - `npm run test --workspace @my-web-bookmarks/desktop-api` failed because `src/db` and domain modules did not exist.
- 2026-04-21: `npm run test --workspace @my-web-bookmarks/desktop-api` passed:
  - 4 test files passed.
  - 10 backend tests passed.
- 2026-04-21: Full workspace verification passed:
  - `npm run typecheck`: passed for all workspaces.
  - `npm run lint`: passed for all workspaces.
  - `npm test`: backend 10 tests passed, web 2 tests passed, shared 3 tests passed.
- 2026-04-21: QA/team review fix added Chrome profile path settings support with RED/GREEN evidence:
  - focused RED: settings repository test failed because `setChromeProfilePath` did not exist.
  - focused GREEN: repository test file passed with 7 tests.
  - final `npm test`: backend 11 tests passed, web 2 tests passed, shared 3 tests passed.
  - final `npm run typecheck`: passed for all workspaces.
  - final `npm run lint`: passed for all workspaces.

**Tester Review Status**

- Accepted on 2026-04-21.
- Repository-backed QA checks covered by automated tests:
  - repeated imported-like item upsert preserves status, tags, and summary.
  - deleting a tag removes item relations without deleting items.
  - public settings do not expose the OpenRouter API key.
  - Chrome profile path can be stored and cleared.

**Team Review Status**

- Accepted on 2026-04-21.
- Review notes:
  - Schema aligns with `docs/architecture/database.md` and adds `skipped_count` plus `updated_by` to satisfy API-facing V1 needs.
  - Repository boundaries are backend-only and ready for Iteration 2 API routes.
  - Review finding fixed: settings repository now supports `chrome_profile_path`.
  - `node:sqlite` remains accepted for now as the simplest local driver, with its experimental warning tracked as a risk before packaging.

## Iteration 2: Local API For Items, Tags, Summaries, And Settings

**Status:** accepted

**Entry Notes**

- Iteration 1 is accepted.
- Use existing repositories from `apps/desktop-api/src/domain/*` behind HTTP routes.
- Start with API contract tests for validation errors, not-found handling, tag conflicts, settings redaction, and item list filtering.
- Keep live Chrome import and live AI calls out of Iteration 2.
- 2026-04-21: Iteration 2 started. Scope remains focused on items, tags, summaries, settings, and AI placeholder endpoints; Chrome sync endpoints stay for Iteration 3.

**Objective:** Implement the stable `/api/v1` contract without Chrome import or live AI calls yet.

**Scope**

- [x] Implement common request validation and error response shape.
- [x] Implement `GET /items` with search, status filter, tag filter, pagination, and sorting.
- [x] Implement `GET /items/:itemId`.
- [x] Implement `PATCH /items/:itemId` for status only.
- [x] Implement `GET /tags`, `POST /tags`, `PATCH /tags/:tagId`, `DELETE /tags/:tagId`.
- [x] Implement `POST /items/:itemId/tags` and `DELETE /items/:itemId/tags/:tagId`.
- [x] Implement `GET /items/:itemId/summary` and `PATCH /items/:itemId/summary`.
- [x] Implement `GET /settings` and `PATCH /settings`.
- [x] Keep AI endpoints present as explicit `ai_not_configured` or controlled stub behavior until Iteration 5.

**Primary Files**

- `apps/desktop-api/src/http/*`
- `apps/desktop-api/src/routes/*`
- `apps/desktop-api/src/validation/*`
- `apps/desktop-api/src/domain/*`
- `packages/shared/src/api/*`

**Automated Verification**

- API contract tests cover every endpoint in `docs/api/local-api.md`.
- Error tests verify `validation_error`, `not_found`, `conflict`, and `ai_not_configured`.
- Search tests cover title, URL, domain, and summary content.
- Settings tests verify `GET /settings` never returns the raw OpenRouter key.

**Tester Review**

- Exercise endpoints with a REST client collection or scripted smoke test.
- Confirm invalid inputs produce understandable errors.
- Confirm API behavior matches the local API document.

**Team Review**

- Confirm frontend can rely on the contract without knowing filesystem or SQLite details.
- Confirm unsupported fields are rejected rather than silently ignored.
- Confirm current summary behavior is one-version-only as specified.

**Exit Result**

- The backend API contract is usable for frontend development and stable enough for future implementation behind it.

**Implementation Notes**

- 2026-04-21: Implemented V1 HTTP routes over the accepted repository layer.
- 2026-04-21: `createApp` now accepts an injectable SQLite database for API tests and initializes an in-memory database by default.
- 2026-04-21: Chrome sync endpoints remain intentionally out of scope for Iteration 2 and will be handled in Iteration 3.

**Verification Evidence**

- 2026-04-21: RED confirmed before implementation:
  - focused API route test file failed with 404 responses for all new endpoints.
- 2026-04-21: Focused API route tests passed:
  - `apps/desktop-api/test/api/v1-routes.test.ts`: 8 tests passed.
- 2026-04-21: Full backend test suite passed:
  - 5 test files passed.
  - 19 backend tests passed.
- 2026-04-21: Full workspace verification passed:
  - `npm run typecheck`: passed for all workspaces.
  - `npm run lint`: passed for all workspaces.
  - `npm test`: backend 19 tests passed, web 2 tests passed, shared 3 tests passed.
- 2026-04-21: QA/team review fix added `GET /items` sort support:
  - focused RED: API sort test failed because `sort=importedAt:asc` was ignored.
  - focused GREEN: API route test file passed with 9 tests.
  - final `npm test`: backend 20 tests passed, web 2 tests passed, shared 3 tests passed.
  - final `npm run typecheck`: passed for all workspaces.
  - final `npm run lint`: passed for all workspaces.

**Tester Review Status**

- Accepted on 2026-04-21.
- HTTP-level QA is covered by API contract tests with repository-seeded data:
  - item list/detail/status update through HTTP
  - tag create/rename/attach/detach/delete through HTTP
  - settings responses never include raw OpenRouter API key
  - AI placeholder endpoints return `ai_not_configured`
  - item list supports `sort=importedAt:asc`, `sort=updatedAt:desc`, and rejects unsupported sort values

**Team Review Status**

- Accepted on 2026-04-21.
- Review notes:
  - Implemented routes align with the Iteration 2 subset of `docs/api/local-api.md`.
  - Chrome sync routes remain intentionally deferred to Iteration 3.
  - Route handlers use repositories through backend-only boundaries; frontend still sees only HTTP JSON.
  - Review finding fixed: `GET /items` now supports documented sort values and rejects unsupported sort values.
  - API tests are the current QA harness because the dev server uses an empty in-memory database until file-backed app database wiring is introduced.

## Iteration 3: Chrome Bookmark Import And Sync

**Status:** accepted

**Entry Notes**

- Iteration 2 is accepted.
- Start with Chrome bookmark parser fixtures and sync repository orchestration tests.
- Add file-backed database wiring before or during Iteration 3 if manual API smoke testing needs persistent seeded data.
- Keep the Chrome integration read-only.
- 2026-04-21: Iteration 3 started. Implementation will focus on read-only Chrome bookmark parsing, import orchestration, single-active-run protection, and sync HTTP status.

**Objective:** Import Chrome bookmarks from a Windows profile, deduplicate them, and expose asynchronous sync status.

**Scope**

- [x] Implement Chrome `Bookmarks` file reader for configured profile path.
- [x] Confirm profile path strategy: use only saved `chrome_profile_path`; do not add default Windows detection in V1.
- [x] Parse bookmark folders recursively and extract bookmark title, URL, source path, and source identifier.
- [x] Normalize URLs and upsert items by `normalized_url`.
- [x] Preserve user-managed status, tags, and summaries on re-import.
- [x] Implement `POST /sync/bookmarks` with single-active-run protection.
- [x] Implement `GET /sync/status`.
- [x] Record `importedCount`, `updatedCount`, `skippedCount`, and failure details.

**Primary Files**

- `apps/desktop-api/src/integrations/chrome/*`
- `apps/desktop-api/src/domain/sync/*`
- `apps/desktop-api/src/routes/sync*`
- `packages/shared/src/api/sync*`

**Automated Verification**

- Parser tests use fixture Chrome bookmark JSON files.
- Sync tests prove recursive folders are imported.
- Deduplication tests prove repeated sync updates existing items.
- Concurrency test proves a second sync request returns `sync_already_running`.
- Failure test proves malformed or missing bookmark files create a failed sync status with useful error details.

**Tester Review**

- Configure a real or copied Chrome profile path on Windows.
- Run sync and confirm newly saved Android/Chrome bookmarks appear after Chrome sync writes them locally.
- Re-run sync and confirm item count is stable when there are no new bookmarks.
- Confirm removing a bookmark from Chrome does not delete the local item.

**Team Review**

- Confirm Chrome integration is read-only.
- Confirm file access errors are diagnosable.
- Confirm source identifier strategy is stable enough for V1.

**Exit Result**

- The app can populate its local inbox from Chrome bookmarks and report sync status safely.

**Implementation Notes**

- 2026-04-21: Implemented read-only Chrome `Bookmarks` parser using configured `chrome_profile_path`.
- 2026-04-21: Implemented bookmark sync service using item repository deduplication by normalized URL.
- 2026-04-21: Implemented async `POST /sync/bookmarks` response with `running` status and background completion.
- 2026-04-21: Implemented `GET /sync/status` with `idle`, `running`, `succeeded`, and `failed` API statuses.
- 2026-04-21: User confirmed default Windows profile path detection is out of scope; sync uses only saved `chrome_profile_path`.

**Verification Evidence**

- 2026-04-21: RED confirmed before implementation:
  - parser and sync service modules did not exist.
  - sync API routes returned 404.
- 2026-04-21: Focused Iteration 3 tests passed:
  - parser, sync service, and sync API route tests: 3 files, 7 tests passed.
- 2026-04-21: Contract correction RED/GREEN:
  - RED: `POST /sync/bookmarks` returned completed `succeeded` status instead of documented async `running`.
  - GREEN: sync API returns `running` immediately and `GET /sync/status` later returns `succeeded`.
- 2026-04-21: Full workspace verification passed:
  - `npm run typecheck`: passed for all workspaces.
  - `npm run lint`: passed for all workspaces.
  - `npm test`: backend 27 tests passed, web 2 tests passed, shared 3 tests passed.
- 2026-04-21: QA/team review verification passed:
  - focused sync service QA test for unset `chrome_profile_path`: passed.
  - final `npm run typecheck`: passed for all workspaces.
  - final `npm run lint`: passed for all workspaces.
  - final `npm test`: backend 28 tests passed, web 2 tests passed, shared 3 tests passed.

**Tester Review Status**

- Accepted on 2026-04-21.
- QA checks covered by fixture-backed and API-level tests:
  - sync against fixture Chrome profile path
  - imported/updated/skipped counts
  - repeated sync deduplication by normalized URL
  - missing or unset profile path creates failed sync status with useful error

**Team Review Status**

- Accepted on 2026-04-21.
- Review notes:
  - Chrome integration is read-only and only reads the configured `Bookmarks` file.
  - Source IDs use the Chrome root key, user folder path, and bookmark `guid`/fallback identifier.
  - Sync API follows the async contract: `POST /sync/bookmarks` returns `running`; `GET /sync/status` reports completion.
  - Single-active-run protection is implemented with `sync_already_running`.
  - User explicitly confirmed default Windows profile path detection is out of scope; sync uses only saved `chrome_profile_path`.

## Iteration 4: Web Inbox, Manual Processing, Search, And Filters

**Status:** accepted

**Entry Notes**

- Iteration 3 is accepted.
- Frontend can now use HTTP API endpoints for items, tags, summaries, settings, and sync.
- Start with frontend API client and inbox tests using mocked HTTP responses.
- Use saved settings for Chrome profile path; default detection remains out of scope.
- 2026-04-21: Iteration 4 started. Build the first usable inbox screen over the existing HTTP API.

**Objective:** Deliver the first user-facing workflow for reviewing imported bookmarks without AI dependency.

**Scope**

- [x] Build inbox list showing title, URL, domain, import date, status, tags, and summary presence.
- [x] Add status actions: mark new, mark read, archive.
- [x] Add open-original action using the item URL.
- [x] Add tag creation, attach, and detach UI.
- [x] Add summary display and manual editing UI for existing summaries.
- [x] Add search across title, URL, domain, and summary.
- [x] Add filters by status and tags.
- [x] Add sync trigger and latest sync status display.
- [x] Add loading, empty, and error states for all main workflows.

**Primary Files**

- `apps/web/src/api/*`
- `apps/web/src/components/*`
- `apps/web/src/views/*`
- `apps/web/src/stores/*`
- `apps/web/src/router/*`
- `packages/shared/src/api/*`

**Automated Verification**

- Frontend unit tests for components with key states.
- API client tests verify request/response mapping.
- Integration tests with mocked API cover inbox load, status update, tag attach/detach, search, filtering, and sync trigger.
- Accessibility-focused tests cover keyboard navigation for core controls where feasible.

**Tester Review**

- Perform a full manual workflow: sync, search, filter, mark read, archive, tag, untag, open article.
- Confirm the app remains useful with no AI settings configured.
- Confirm long URLs, long titles, empty states, and backend errors do not break the UI.

**Team Review**

- Confirm UI supports the V1 user stories for non-AI processing.
- Confirm frontend code uses only API clients, not backend internals.
- Confirm the workflow is ergonomic enough before adding AI complexity.

**Exit Result**

- A user can manage and retrieve bookmarks locally without AI.

**Implementation Notes**

- 2026-04-21: Implemented frontend API client for items, tags, summaries, settings, and sync.
- 2026-04-21: Replaced the health-only shell with a usable inbox screen.
- 2026-04-21: Added Chrome profile path settings control that uses the saved `chromeProfilePath` API field; no default detection is introduced.
- 2026-04-21: Live AI generation remains out of scope until Iteration 5.
- 2026-04-21: User confirmed tag rename UI is out of scope for Iteration 4; existing API support remains available for a future explicit task.
- 2026-04-21: Post-QA hotfix: Sync now saves the current Chrome profile path before starting, polls sync status until a final state, displays sync errors, and refreshes the inbox after successful import.

**Verification Evidence**

- 2026-04-21: RED confirmed before implementation:
  - web API client module did not exist.
  - App tests failed because the UI only rendered the health shell.
- 2026-04-21: Backend RED/GREEN for settings UI support:
  - RED: `PATCH /settings` ignored `chromeProfilePath`.
  - GREEN: settings API now saves, clears, and returns saved `chromeProfilePath`.
- 2026-04-21: Full workspace verification passed:
  - `npm run typecheck`: passed for all workspaces.
  - `npm run lint`: passed for all workspaces.
  - `npm test`: backend 29 tests passed, web 5 tests passed, shared 3 tests passed.
- 2026-04-21: Post-QA hotfix verification passed:
  - RED confirmed: web tests failed because Sync stayed on `running`, did not refresh imported items, and did not show sync errors.
  - GREEN confirmed: `npm run test --workspace @my-web-bookmarks/web` passed with 6 tests.
  - Full workspace verification passed: `npm run typecheck`, `npm run lint`, and `npm test`.
  - Final test totals after hotfix: backend 29 tests passed, web 6 tests passed, shared 3 tests passed.

**Tester Review Status**

- Accepted on 2026-04-21.
- QA checks covered by automated tests and team review:
  - Web API client tests cover items, tags, summaries, settings, sync, status update, tag attach/detach, and summary update.
  - App workflow tests cover initial load, backend unavailable state, filtering, status update, tag creation/attach, settings save, and sync trigger.
  - Full workspace verification passed: `npm run typecheck`, `npm run lint`, and `npm test`.
  - Final test totals: backend 29 tests passed, web 5 tests passed, shared 3 tests passed.
- Manual follow-up remains useful with a persisted dev database and real imported Chrome dataset, but it does not block Iteration 4 acceptance.

**Team Review Status**

- Accepted on 2026-04-21.
- Review notes:
  - Frontend uses the HTTP API client boundary and does not reach into backend internals.
  - Backend settings contract now includes saved `chromeProfilePath`; default profile detection remains out of scope by user decision.
  - The first inbox screen covers non-AI bookmark processing: sync trigger, search, status and tag filters, status changes, tag creation/attach/detach, and manual summary editing.
  - Live AI generation remains deferred to Iteration 5.
  - Tag rename UI is explicitly not included in Iteration 4.

## Lessons-Learned Gates For Remaining Iterations

These gates were added after the Iteration 4 post-QA sync issue.

- Any async user workflow must define the full observable lifecycle before implementation: start action, pending/running state, final success state, final failure state, visible error message, and data refresh behavior.
- Any import, generation, sync, or mutation workflow must have a before/after acceptance assertion: what changed in the UI, what persisted data changed, or what user-visible failure explains why nothing changed.
- Frontend tests must verify the user outcome, not only that a transport call happened.
- Adjacent controls must not have hidden ordering requirements. If the expected path is "enter setting, then run action", the action must either persist the setting first or block with a clear message.
- UI iterations that cross frontend/backend boundaries require a manual smoke pass against the running dev servers with realistic local input before acceptance.
- Tester review must include at least one failure-mode check for each new workflow that can fail due to missing config, invalid local path, network failure, upstream failure, or timeout.

## Iteration 5: OpenRouter Settings And AI Workflows

**Status:** ready_for_test

**Entry Notes**

- Iteration 4 is accepted with post-QA lifecycle gates applied to future async workflows.
- 2026-04-21: User approved the Iteration 5 design and explicitly allowed implementation on `master`.

**Objective:** Add AI-generated summaries and tag suggestions while preserving local-first usability.

**Scope**

- [x] Add OpenRouter client with configurable model.
- [x] Add settings UI for API key configured state and model choice.
- [x] Implement article content fetching/extraction strategy suitable for V1.
- [x] Implement `POST /items/:itemId/summary` to generate and store the current summary.
- [x] Implement `POST /items/:itemId/tag-suggestions` without automatic persistence.
- [x] Add frontend controls for generating/regenerating summaries.
- [x] Add frontend flow for reviewing AI tag suggestions and confirming selected tags.
- [x] Add clear AI error states for missing configuration and upstream failures.
- [x] Define and implement the full observable lifecycle for each AI action: idle, generating, succeeded, failed, retry/regenerate.
- [x] Ensure AI actions persist or validate current settings before generation so the user is not required to remember a separate Save step.

**Primary Files**

- `apps/desktop-api/src/integrations/openrouter/*`
- `apps/desktop-api/src/domain/ai/*`
- `apps/desktop-api/src/routes/summary*`
- `apps/desktop-api/src/routes/tagSuggestions*`
- `apps/web/src/views/settings*`
- `apps/web/src/components/ai*`
- `packages/shared/src/api/*`

**Automated Verification**

- OpenRouter client tests mock HTTP responses and failures.
- AI endpoint tests verify `ai_not_configured`, `upstream_error`, successful summary persistence, and non-persistence of tag suggestions.
- Prompt construction tests verify minimum required article context and expected output constraints.
- Frontend tests cover settings redaction, generation states, failure states, and suggestion confirmation.
- Frontend workflow tests assert user-visible outcomes after AI actions: generated summary appears, old current summary is replaced on regeneration, failed generation shows an actionable error, and accepted tag suggestions appear on the item.
- Tests must include before/after assertions for every generation or suggestion-confirmation workflow.

**Tester Review**

- Test with no API key: core app works and AI actions fail clearly.
- Test with configured API key and low-cost model: summary generation stores one current editable summary.
- Test regeneration: old current summary is replaced.
- Test tag suggestions: suggestions are shown but not saved until the user confirms them.
- Test hidden-ordering risk: enter or change AI settings and immediately run an AI action; the UI must either save/validate settings automatically or show a clear blocker.
- Test final-state visibility: every AI action must leave the user seeing success, failure, or a retryable error rather than an indefinite loading state.
- Run one manual smoke pass with backend and web dev servers running together, using a realistic bookmark item and either a configured low-cost model or a mocked/stubbed upstream mode.

**Team Review**

- Confirm costs and model defaults are reasonable.
- Confirm secrets are not logged or returned by API.
- Confirm AI failures do not block bookmark processing.
- Confirm frontend tests assert workflow outcomes instead of only API call wiring.
- Confirm every AI workflow has explicit timeout, upstream failure, missing configuration, and retry/regenerate behavior.

**Exit Result**

- AI assists processing but remains optional and bounded by explicit user action.

**Implementation Notes**

- 2026-04-21: Added mockable OpenRouter chat completions client with configurable model and API key authorization.
- 2026-04-21: Added backend AI service for summary generation and tag suggestions.
- 2026-04-21: V1 article context strategy is metadata-only: title, URL, domain, and current summary. Full article extraction remains out of scope until a later explicit task.
- 2026-04-21: `POST /items/:itemId/summary` now generates and stores one current AI summary; regeneration replaces the current summary.
- 2026-04-21: `POST /items/:itemId/tag-suggestions` returns suggestions without persisting tags.
- 2026-04-21: Web UI now includes OpenRouter API key/model controls, generate/regenerate summary, suggest tags, and confirm suggested tag flow.
- 2026-04-21: AI actions save current OpenRouter settings before generation/suggestion to avoid hidden Save-before-action ordering.
- 2026-04-21: AI failures are shown as visible final states; API keys remain write-only and are not rendered after save.

**Verification Evidence**

- 2026-04-21: Backend RED confirmed:
  - AI summary generation tests failed while endpoints still returned `409 ai_not_configured`.
  - Tag suggestion and upstream failure tests failed while endpoints were placeholders.
- 2026-04-21: Backend GREEN confirmed:
  - `npm run test --workspace @my-web-bookmarks/desktop-api`: 33 tests passed.
- 2026-04-21: Frontend RED confirmed:
  - API client test failed because AI client methods did not exist.
  - App workflow tests failed because OpenRouter controls and AI action buttons did not exist.
- 2026-04-21: Frontend GREEN confirmed:
  - `npm run test --workspace @my-web-bookmarks/web`: 8 tests passed.
- 2026-04-21: Full workspace verification passed:
  - `npm run typecheck`: passed for all workspaces.
  - `npm run lint`: passed for all workspaces.
  - `npm test`: backend 33 tests passed, web 8 tests passed, shared 3 tests passed.

**Tester Review Status**

- Pending QA review.
- Suggested QA checks:
  - With no API key, confirm the app still loads bookmarks and AI actions show a visible failure.
  - Enter an OpenRouter API key/model and immediately generate a summary without pressing Save AI first.
  - Regenerate a summary and confirm the visible current summary is replaced.
  - Suggest tags and confirm a suggestion; verify the tag is not attached until confirmation.
  - Confirm the raw API key is not shown after save or generation.
  - Confirm AI failures do not block manual bookmark processing.

**Team Review Status**

- Pending review of OpenRouter boundary, prompt/context scope, secret handling, AI lifecycle completeness, and whether metadata-only article context is acceptable for V1.

## Iteration 6: Reliability, Observability, Packaging Readiness

**Status:** planned

**Objective:** Harden the V1 app for daily local use and prepare a repeatable release path.

**Scope**

- [ ] Add structured local logs under `data/logs`.
- [ ] Add defensive handling for database corruption, migration failure, missing Chrome profile, network timeouts, and OpenRouter failures.
- [ ] Add backup/export guidance for SQLite data.
- [ ] Add smoke test script covering backend start, health, database init, and basic API calls.
- [ ] Extend smoke coverage to include a frontend/backend lifecycle workflow with visible final state and before/after data assertion.
- [ ] Add release checklist for local Windows usage.
- [ ] Review whether desktop packaging is required for V1 or whether a local web/backend launch script is enough.
- [ ] Update product and architecture docs with implementation decisions.

**Primary Files**

- `apps/desktop-api/src/logging/*`
- `apps/desktop-api/src/config/*`
- `scripts/*`
- `docs/development/*`
- `docs/release/*`
- `dev_management/*`

**Automated Verification**

- Smoke test script passes on a clean local checkout.
- Failure-mode tests cover missing profile, failed migration, invalid settings, and upstream timeout.
- Logging tests or assertions confirm secrets are not written to logs.
- End-to-end smoke test or documented manual script verifies at least one full lifecycle workflow: action starts, reaches final state, data refreshes, and errors are visible when forced.
- Full test suite, lint, and typecheck pass.

**Tester Review**

- Execute the release checklist on Windows.
- Simulate common failure modes and confirm messages are actionable.
- Confirm existing data survives app restart and repeated sync.
- Confirm no main workflow can remain indefinitely in `running`/loading state without timeout, retry, or visible failure.
- Confirm documented manual smoke scenarios include realistic local paths and realistic user inputs.

**Team Review**

- Confirm V1 is operationally supportable.
- Confirm known limitations are documented.
- Confirm remaining backlog is split into post-V1 work rather than hidden inside V1.
- Confirm all accepted iterations since Iteration 4 include lessons-learned gates in their QA/team review notes.

**Exit Result**

- V1 is ready for regular local use and structured feedback.

## Cross-Cutting Backlog

These items should be pulled into iterations only when they become necessary for the V1 outcome.

- [ ] Decide package manager and lockfile policy.
- [ ] Decide backend HTTP framework.
- [ ] Decide SQLite driver and migration tool.
- [ ] Decide frontend test runner and browser automation stack.
- [ ] Decide whether to add Electron/Tauri packaging after V1 or before first user trial.
- [ ] Define fixture strategy for Chrome bookmark files.
- [ ] Define sanitized sample data for demos and tests.
- [ ] Define AI prompt templates and cost guardrails.

## Risk Register

| Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- |
| Chrome bookmark file shape differs across versions or profiles | Sync may miss bookmarks | Use fixture coverage and real Windows profile testing | open |
| OpenRouter costs or failures degrade UX | User may avoid AI features | Make AI optional, explicit, and failure-tolerant | open |
| SQLite schema changes during early development | Rework and data loss risk | Add migrations from Iteration 1 and test them | open |
| Frontend couples to backend internals | Future remote/local boundary becomes expensive | Shared DTOs and API-client-only frontend access | open |
| Secrets leak into responses or logs | Security/privacy issue | Redaction tests and logging review | open |

## Status History

| Date | Change |
| --- | --- |
| 2026-04-21 | Initial development management plan created from existing project documentation. |
