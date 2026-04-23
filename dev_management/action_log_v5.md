# Development Action Log V5

This log is the active implementation journal for V5.

## Bootstrap Summary From V4

- V4 closed as a visual-only cycle over stable V3 UX.
- V5 focus shifts from presentation to AI grounding and reliability:
  - extract real page content before summary generation;
  - reduce hallucination risk via preprocessing and stricter prompts;
  - separate model controls for summary and tag generation.

## 2026-04-23 - V5 Log Initialized

**Change**

- Opened active V5 action log.
- Created `dev_management/v5_plan.md` as roadmap source for V5 slices.

**Why**

- Keep version-scoped planning and lessons isolated from V4 closure artifacts.

**Next**

- Create and link V5 GitHub Issues for I1/I2/I3.
- Start V5-I1 with test-first extraction + preprocessing boundaries.

## 2026-04-23 - V5 Design Decisions Confirmed

**Decision**

- Page content extraction strategy for summary pipeline: `hybrid` (primary + fallback algorithm).
- Tag suggestion flow when summary is missing: run extraction/preprocessing for context only; do not persist summary.

**Why**

- Hybrid extraction improves robustness across page structures.
- Avoid hidden data mutations in tag-only flows and preserve explicit user control of summary persistence.

**Implementation impact**

- AI service contract will need operation-scoped context building.
- Tests must cover both summary-present and summary-missing paths for tags.
- Settings/API model selection must become operation-specific.

## 2026-04-23 - V5 Issues Created And Linked

**Change**

- Created and linked V5 GitHub slices:
  - `#5` https://github.com/snn02/my-web-bookmarks/issues/5
  - `#6` https://github.com/snn02/my-web-bookmarks/issues/6
  - `#7` https://github.com/snn02/my-web-bookmarks/issues/7
- Updated `dev_management/v5_plan.md` with issue references.

**Why**

- Keep execution status issue-driven with explicit traceability from roadmap slices to GitHub.

**Next**

- Move each slice through test-first implementation in execution order V5-I1 -> V5-I2 -> V5-I3.

## 2026-04-23 - Lead Risk Review Integrated Into V5 Plan

**Change**

- Updated V5 planning/design docs with explicit risk controls:
  - extraction security and performance guardrails;
  - prompt-injection hardening for extracted content context;
  - distinct extraction error semantics from provider upstream failures;
  - deterministic settings migration precedence (legacy single-model key fallback only);
  - runtime model-ranking source of truth moved to code config (docs are descriptive);
  - short-lived extraction cache requirement for tag flow without summary.

**Why**

- Reduce ambiguity and prevent hidden reliability/security regressions during implementation.

**Next**

- Reflect these controls in issue execution checklists before coding V5-I1.

## 2026-04-23 - V5 Re-Scoped After Manual Testing

**Decision**

- Roll back page-extraction-based summary generation to metadata-grounded generation.
- Keep summary max length at 5 sentences.
- Roll back dual-model settings to one shared OpenRouter model for both summary and tags.
- For tag suggestion when summary is missing, use cleaned metadata fallback only and do not persist summary.

**Why**

- Manual testing showed extraction instability and unreadable-content outcomes for valid pages.
- Shared model control is simpler and aligns with observed user workflow.

**Implementation impact**

- Remove extraction-dependent code paths and `content_unavailable` behavior from AI summary/tag flows.
- Simplify settings repository/API/UI contract back to one model field.
- Update tests and docs to the metadata-only grounding behavior.

## 2026-04-24 - Metadata Enrichment Scope Approved

**Decision**

- Keep metadata-first summary/tag generation.
- Add best-effort lightweight page-signal enrichment to AI context:
  - `meta description`, `og:title`, `og:description`, `keywords`, `author`, published-time fields;
  - all visible `h1`/`h2` headings.
- Do not reintroduce full article extraction.

**Why**

- Metadata-only context can be too sparse for some models and trigger low-information refusals.
- Lightweight signals improve grounding without returning to brittle full-content extraction.

**Implementation impact**

- AI context builder needs optional network fetch + HTML signal parsing with graceful fallback.
- Prompt should explicitly instruct concise, uncertainty-aware summary when signals are sparse.
- Tests should verify signal extraction wiring and fallback behavior when signal fetch fails.

## 2026-04-24 - Prompt Templates Exposed In Settings

**Decision**

- Add two user-editable settings fields:
  - summary generation prompt template;
  - tag suggestion prompt template.
- Prefill both fields with current built-in defaults.
- Keep backend defaults as fallback when saved value is empty.

**Why**

- Prompt tuning must be debuggable without code edits.
- Fast iteration on weak-context behavior is easier when prompts are visible and editable in UI.

**Implementation impact**

- Extend settings API contract and repository keys for prompt templates.
- Use saved prompt templates in AI service request composition.
- Update manual smoke and API docs for new settings fields and fallback behavior.

## 2026-04-24 - Suggest Tags UX Unified With Item Tag Editor

**Decision**

- Move `Suggest tags` control into item tag editor flow (before `Find existing tag` input).
- Render suggested tags as chip-style elements under tag search, consistent with assigned tag chip styling.
- Hide suggested tags that are already attached to the current item.
- Support two explicit suggestion actions:
  - click chip body -> attach tag and remove suggestion;
  - click chip `x` -> dismiss suggestion only.

**Why**

- Current split rendering increased context switching and made confirm/dismiss semantics unclear.
- Unified chip interaction matches user mental model and speeds manual triage.

**Implementation impact**

- Frontend-only changes in item card template/state styling; no API contract change.
- Added/updated web tests for placement, filtering, confirm, and dismiss behavior.
- Updated manual smoke and user-story docs for the new interaction flow.

## 2026-04-24 - Iteration Summary And Lessons Learned (Tech Lead)

**Iteration outcomes**

- V5 moved from extraction-heavy AI context to metadata-grounded generation with lightweight page signals.
- Model selection was simplified from split (summary/tags) back to one shared model setting.
- Prompt templates for summary and tags were exposed in Settings with safe defaults and reset behavior.
- Tag suggestion UX was unified into one item-scoped flow with explicit confirm/dismiss actions.

**Lessons learned**

1. Validate AI context quality before expanding architecture:
   - Full extraction added complexity and instability faster than value.
   - Metadata + lightweight signals gave a more controllable reliability baseline.
2. Keep user controls simple unless dual control is clearly necessary:
   - One shared model selector fit real workflow better than two separate selectors.
3. Prompt configurability is a debugging tool, not only a feature:
   - Exposed prompts reduced iteration cycle time when model behavior changed.
4. AI actions must remain explicitly user-confirmed:
   - Suggestion flows should never mutate item data without a clear per-item user action.
5. UI consistency directly reduces operational mistakes:
   - Unified chip patterns for assigned/suggested/search tags lowered interaction ambiguity.
6. Manual smoke feedback must be treated as first-class input:
   - Several high-impact corrections were discovered only during interactive checks.
7. Require deterministic fallback semantics in settings:
   - Empty values should map to documented defaults, and UI must reflect resolved state after save.
8. Keep docs-first discipline for behavior changes:
   - Updating user stories/smoke/API docs before coding improved scope clarity and reduced rework.

**Planning guidance for next iterations**

- Start each AI slice with a smallest-reliable baseline and explicit rollback criteria.
- Add a dedicated UI polish checkpoint after functional acceptance for every settings/inbox interaction change.
- Define "auto/default" behavior contract (save/read/display) in API docs and tests before implementation.
- Keep issue slices narrow: one behavioral outcome per slice, with separate UX polish slice if needed.
