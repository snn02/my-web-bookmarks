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
