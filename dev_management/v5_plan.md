# My Web Bookmarks V5 Plan

## Version Goal

Stabilize AI behavior by switching summary generation to cleaned metadata context (without page extraction), keep tag suggestions summary-first with metadata fallback, and return to one shared model selection for both summary and tags.

## Process Rules For V5

- `dev_management/v5_plan.md` is the roadmap source with slice status and issue links.
- Detailed execution notes and evidence updates are tracked in linked GitHub Issues.
- `dev_management/action_log_v5.md` is the only active implementation log for V5 lessons and decisions.
- Product/API/release docs in `docs/` are updated only when behavior or contract changes and only in owner-boundary files.

## Version Status

Re-scoped on 2026-04-23 after manual testing and rollback decision.

## Iterations

## V5-I1: Metadata-Grounded Summary (No Extraction)

**Status:** planned  
**Issue:** #5 ([URL](https://github.com/snn02/my-web-bookmarks/issues/5))

**User-visible outcome (before/after)**

- Before: summary generation depends on runtime page extraction and can fail with `content_unavailable`.
- After: summary generation uses cleaned item metadata only and remains available whenever item data exists.

**Scope**

- Remove runtime page extraction from summary generation pipeline.
- Build deterministic cleaned metadata context from item fields.
- Add best-effort lightweight page-signal enrichment (`meta/og` fields and `h1`/`h2`) without full article extraction.
- Update summary prompt to avoid guessing and constrain output to maximum 5 sentences in Russian.
- Expose editable summary/tag prompt templates in settings with default prefill and safe fallback.
- Keep readable OpenRouter upstream failures end-to-end.

**Acceptance criteria**

- Summary requests no longer fetch remote page content.
- Summary output is metadata-grounded (stored fields + lightweight page signals) and capped to 5 sentences.
- Settings returns editable `summaryPrompt` and `tagsPrompt` with default values when user has not overridden them.
- No `content_unavailable` path remains for summary generation.
- Existing AI error safety rules remain intact (no secret leakage, no raw JSON in UI).

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

## V5-I2: Summary-First Tag Suggestions With Metadata Fallback

**Status:** planned  
**Issue:** #6 ([URL](https://github.com/snn02/my-web-bookmarks/issues/6))

**User-visible outcome (before/after)**

- Before: tag suggestion fallback depended on page extraction when summary was missing.
- After: tag suggestions use stored summary first; if summary is missing, they use cleaned metadata fallback without persisting summary.

**Scope**

- Keep existing summary as primary tag context.
- Replace extraction fallback with cleaned metadata + lightweight page-signal fallback.
- Do not auto-create or persist summary in tag-only flow.
- Keep tag confirmation behavior unchanged (user must confirm before persistence).

**Acceptance criteria**

- Existing summary is preferred for tag suggestion input.
- Missing summary path still generates suggestions via metadata context.
- Tag flow does not create/update stored summary implicitly.
- Final AI states remain visible and readable in UI.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

## V5-I3: Single AI Model Setting With Ranked Dropdown

**Status:** planned  
**Issue:** #7 ([URL](https://github.com/snn02/my-web-bookmarks/issues/7))

**User-visible outcome (before/after)**

- Before: Settings has separate model selectors for summary and tags.
- After: Settings has one model selector used by both summary and tag generation, saved with one AI Save action.

**Scope**

- Restore single stored setting key `openrouter_model` as source of truth.
- Keep one dropdown in settings with model rating labels.
- Use selected model for both summary and tag requests.
- If model is not selected, resolve to top-rated default from model table.
- Update API/UI/docs/tests to remove operation-scoped model fields.

**Acceptance criteria**

- Settings UI shows one model dropdown.
- Save AI persists one shared model.
- Summary and tag requests use the same resolved model.
- API and docs clearly describe shared-model behavior.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

## V5-I4: Suggest Tags UX Unification In Item Card

**Status:** planned  
**Issue:** TBD (to be created)

**User-visible outcome (before/after)**

- Before: AI tag suggestions are rendered in a separate button group above the tag search input and may include tags already attached to the item.
- After: AI tag suggestions are rendered as chips in the same visual style zone as item tags under the search input, exclude already attached tags, and support explicit confirm/dismiss actions.

**Scope**

- Move `Suggest tags` trigger button to be located immediately before the item-level tag search input.
- Filter suggestion list to hide tags that are already assigned to the current item.
- Render suggested tags using the same chip styling pattern as assigned item tags.
- Add dismiss control (`x`) on each suggested chip that removes it from current suggestion list only.
- Keep confirm action by clicking suggestion chip body:
  - attach tag to item;
  - remove that tag from suggestion list.
- Keep persistence boundary unchanged: no automatic persistence without explicit user action.

**Acceptance criteria**

- `Suggest tags` appears before `Find existing tag` input in expanded item card.
- Suggested tags never include tags already attached to that item.
- Suggested chips and assigned chips use one consistent visual pattern.
- Clicking a suggested chip attaches it and removes it from suggested chips.
- Clicking `x` on suggested chip dismisses it without attaching.

**Verification**

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke`

## Execution Order

1. V5-I1
2. V5-I2
3. V5-I3
4. V5-I4

## Tracking Notes

- Issue links remain populated for all V5 slices (`#5`, `#6`, `#7`).
- Keep issue status in GitHub and mirror concise status here.
