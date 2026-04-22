# Agents Guide

## Goal

Ship small, testable slices for a local-first bookmarks app without repeating V1 mistakes.

## Core Rules (From V1)

1. Define observable user outcome before coding.
2. Keep one source of truth for editable UI state.
3. Separate global resource creation from item-scoped assignment.
4. Preserve provider-specific AI failures end-to-end (no raw JSON in UI, no secret leaks).
5. Keep docs in existing ownership boundaries only.

## Agent Roles

- Feature Agent: implement vertical behavior slice (UI + API + tests + docs).
- API Agent: enforce `/api/v1` contract, validation, and stable error semantics.
- QA/Release Agent: run verification and manual smoke gates.
- Docs Agent: update only relevant owner docs after behavior change.

## Standard Flow

1. Define user-visible before/after behavior.
2. Write or update failing tests first.
3. Implement minimal change.
4. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run smoke` when relevant.
5. Update docs by ownership:
   - Product behavior -> `docs/product/user-stories.md`
   - API contract -> `docs/api/local-api.md`
   - Manual QA/release -> `docs/development/manual-smoke-scenarios.md`, `docs/release/windows-v1-checklist.md`
   - Process/lessons -> active version log `dev_management/action_log_v<version>.md`

## Definition Of Done

- User-visible outcome is explicit and matched by implementation.
- No duplicate editable surfaces for the same value.
- Global vs item-scoped behavior is unambiguous.
- AI failure paths end in readable final states.
- Required automated checks pass.
- Required docs are updated once, in the right place.
- Implementation notes are recorded in the active version log only.

## Escalation Triggers

- Behavior touches async lifecycle states and they are not specified (`idle/running/success/failure`).
- Change can blur global vs item ownership.
- AI provider behavior is uncertain: run direct diagnostics before changing product logic.
- Proposed docs introduce new ownership roots.
