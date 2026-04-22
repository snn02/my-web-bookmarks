---
name: docs-sync
description: Update project docs with strict ownership boundaries after accepted behavior changes. Use when product behavior, API contract, manual QA flow, release checks, or process lessons change.
---

# Docs Sync

## Ownership Map

- Product behavior: `docs/product/user-stories.md`
- API contract: `docs/api/local-api.md`
- Manual QA flows: `docs/development/manual-smoke-scenarios.md`
- Release readiness: `docs/release/windows-release-checklist.md`
- Version roadmap and iteration status: `dev_management/v3_plan.md`
- Process decisions and lessons: active version log `dev_management/action_log_v<version>.md`

## Workflow

1. Identify changed behavior.
2. Update only owner documents affected by that behavior.
3. Keep entries compact and operational (expected outcome, not long narrative).
4. Avoid duplicate design text across multiple docs.
5. Keep execution-status updates in GitHub Issues; do not duplicate operational status logs in docs.
6. If no behavior/API/process change exists, do not edit docs.
7. On version close, freeze `action_log_v<current>.md` and initialize `action_log_v<next>.md` with a short carry-forward summary.

## Required Quality Checks

- Docs reflect actual implemented behavior (not planned behavior).
- Global vs item-scoped semantics are explicitly correct.
- AI error handling expectations are readable and specific.
