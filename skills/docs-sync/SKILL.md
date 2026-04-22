---
name: docs-sync
description: Update project docs with strict ownership boundaries after accepted behavior changes. Use when product behavior, API contract, manual QA flow, release checks, or process lessons change.
---

# Docs Sync

## Ownership Map

- Product behavior: `docs/product/user-stories.md`
- API contract: `docs/api/local-api.md`
- Manual QA flows: `docs/development/manual-smoke-scenarios.md`
- Release readiness: `docs/release/windows-v1-checklist.md`
- Process decisions and lessons: `dev_management/action_log.md`

## Workflow

1. Identify changed behavior.
2. Update only owner documents affected by that behavior.
3. Keep entries compact and operational (expected outcome, not long narrative).
4. Avoid duplicate design text across multiple docs.
5. If no behavior/API/process change exists, do not edit docs.

## Required Quality Checks

- Docs reflect actual implemented behavior (not planned behavior).
- Global vs item-scoped semantics are explicitly correct.
- AI error handling expectations are readable and specific.
