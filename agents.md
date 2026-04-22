# Agents Guide

## Goal

Ship small, testable slices for a local-first bookmarks app without repeating V1 mistakes.

## Core Rules (From V1)

1. Define observable user outcome before coding.
2. Keep one source of truth for editable UI state.
3. Separate global resource creation from item-scoped assignment.
4. Preserve provider-specific AI failures end-to-end (no raw JSON in UI, no secret leaks).
5. Keep docs in existing ownership boundaries only.

## V3 Tracking Model

- Master plan lives in `dev_management/v3_plan.md`.
- Every planned slice must link to a GitHub Issue (`#<id>` plus URL).
- Execution status is tracked in GitHub Issues (labels and concise status comments).
- Lessons learned are tracked only in `dev_management/action_log_v3.md`.

## Agent Roles

- Feature Agent: implement vertical behavior slice (UI + API + tests + docs).
- API Agent: enforce `/api/v1` contract, validation, and stable error semantics.
- QA/Release Agent: run verification and manual smoke gates.
- Docs Agent: update only relevant owner docs after behavior change.

## Standard Flow

1. Define user-visible before/after behavior.
2. Create or link the GitHub Issue for the slice and add initial status labels.
3. Write or update failing tests first.
4. Implement minimal change.
5. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run smoke` when relevant.
6. Sync status in both places:
   - Issue = execution status and evidence updates.
   - `dev_management/v3_plan.md` = roadmap and decisions.
7. Update docs by ownership:
   - Product behavior -> `docs/product/user-stories.md`
   - API contract -> `docs/api/local-api.md`
   - Manual QA/release -> `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-release-checklist.md`
   - Process/lessons -> active version log `dev_management/action_log_v<version>.md`

## Definition Of Done

- User-visible outcome is explicit and matched by implementation.
- No duplicate editable surfaces for the same value.
- Global vs item-scoped behavior is unambiguous.
- AI failure paths end in readable final states.
- Required automated checks pass.
- Required docs are updated once, in the right place.
- Each completed slice has a linked GitHub Issue in `done` state.
- `dev_management/v3_plan.md` contains final status and Issue link for the slice.
- `dev_management/action_log_v3.md` captures lesson learned when applicable.
- Implementation notes are recorded in the active version log only.

## Escalation Triggers

- Behavior touches async lifecycle states and they are not specified (`idle/running/success/failure`).
- Change can blur global vs item ownership.
- AI provider behavior is uncertain: run direct diagnostics before changing product logic.
- Proposed docs introduce new ownership roots.
