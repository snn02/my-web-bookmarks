# My Web Bookmarks V5 Plan

## Version Goal

Deliver grounded AI generation by summarizing real page content (not only metadata), improve tag suggestion grounding, and introduce separate model controls for summary and tags.

## Process Rules For V5

- `dev_management/v5_plan.md` is the roadmap source with slice status and issue links.
- Detailed execution notes and evidence updates are tracked in linked GitHub Issues.
- `dev_management/action_log_v5.md` is the only active implementation log for V5 lessons and decisions.
- Product/API/release docs in `docs/` are updated only when behavior or contract changes and only in owner-boundary files.

## Version Status

In progress on 2026-04-23.

## Iterations

## V5-I1: Grounded Summary From Extracted Page Content

**Status:** implemented (ready for review)  
**Issue:** #5 ([URL](https://github.com/snn02/my-web-bookmarks/issues/5))

**User-visible outcome (before/after)**

- Before: summary generation may rely on minimal metadata and can drift from actual page content.
- After: summary generation uses extracted page text with preprocessing and a strict grounding prompt.

**Scope**

- Add hybrid page-content extraction (primary + fallback algorithm).
- Add preprocessing to reduce context size while preserving key content.
- Add extraction guardrails: protocol allowlist (`http`/`https`), redirect limit, response size cap, timeout, and private-network denylist.
- Update summary prompt to prohibit unsupported guesses and require content-grounded output.
- Preserve readable error semantics for extraction/upstream failures.

**Acceptance criteria**

- Summary request includes extracted page content context.
- Prompt enforces grounded summarization behavior.
- Prompt-injection hardening is applied when embedding extracted content into model input.
- Empty/unreadable page content paths end in explicit readable failure states.
- Extraction failures use stable API error semantics distinct from provider upstream failures.
- Existing AI error safety rules remain intact (no secret leakage, no raw JSON in UI).

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

**Execution notes**

- Implemented extraction-first summary flow with readable `content_unavailable` failure mapping.
- Added extraction hardening: timeout, response size cap, redirect cap, and private/local host blocking.

## V5-I2: Tag Suggestions Use Summary-First Grounding

**Status:** implemented (ready for review)  
**Issue:** #6 ([URL](https://github.com/snn02/my-web-bookmarks/issues/6))

**User-visible outcome (before/after)**

- Before: tag suggestions are generated without a strict summary-first policy.
- After: tag suggestion generation uses stored summary first; if missing, it uses the same extraction/preprocessing pipeline without persisting a new summary.

**Scope**

- Use existing summary as primary context for tag suggestions.
- If summary is missing, run extraction + preprocessing and pass that context to the model.
- Do not auto-create or persist summary in tag-only flow.
- Add short-lived item-scoped extraction cache to avoid repeated fetch/extract on rapid retries.
- Keep tag confirmation behavior unchanged (user must confirm before persistence).

**Acceptance criteria**

- Existing summary is preferred for tag suggestion input.
- Missing summary path still generates suggestions via extracted content.
- Tag flow does not create/update stored summary implicitly.
- Final AI states remain visible and readable in UI.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

**Execution notes**

- Implemented summary-first tag context selection.
- Added no-summary extraction fallback without summary persistence side effects.
- Added anti-hallucination wording to tag prompt context usage.

## V5-I3: Dual AI Model Settings With Ranked Dropdowns And Defaults

**Status:** implemented (ready for review)  
**Issue:** #7 ([URL](https://github.com/snn02/my-web-bookmarks/issues/7))

**User-visible outcome (before/after)**

- Before: one model field controls all AI operations.
- After: Settings contains two model selectors (summary model, tags model), both ranked by feature fit scores and saved with one AI Save action.

**Scope**

- Read preferred model table from product doc source.
- Add separate stored settings for summary and tag model selection.
- Define migration order from legacy single-model key to operation-scoped model keys.
- Extend settings API and frontend state for two model fields.
- Render two dropdowns sorted by relevant score (max 5), with one shared Save button.
- If model is not selected, resolve to highest-fit default per operation.
- Update DB/docs to reflect new persisted keys and settings contract.

**Acceptance criteria**

- Settings UI shows two model dropdowns with correct sorting.
- Single Save action persists both model settings.
- Defaults resolve to top-rated model when explicit selection is missing.
- Legacy single-model setting fallback behavior is deterministic and covered by tests.
- API and docs clearly describe dual-model settings behavior.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

**Execution notes**

- Added operation-scoped model settings in backend (`summaryModel`, `tagsModel`) with legacy `model` fallback compatibility.
- Added shared runtime model table and deterministic sorting/default helpers.
- Added Settings UI dual dropdowns (summary/tags) with one shared Save AI action.
- Updated owner docs for API contract and settings storage keys.

## Execution Order

1. V5-I1
2. V5-I2
3. V5-I3

## Tracking Notes

- Issue links are already populated for all V5 slices (`#5`, `#6`, `#7`).
- Keep issue status in GitHub and mirror concise status here.
