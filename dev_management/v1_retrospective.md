# V1 Retrospective And V2 Working Improvements

## V1 Outcome

V1 reached an accepted local-first state:

- Iterations 0-6 are accepted.
- V1 feedback fixes `V1-FIX-001` through `V1-FIX-007` are accepted.
- Core workflows are covered by automated tests and manual QA:
  - Chrome bookmark sync from a saved profile path.
  - Status changes.
  - Global tag creation.
  - Item-scoped tag assignment and removal.
  - Search and filters.
  - Russian AI summaries with editable textarea workflow.
  - AI tag suggestions.
  - OpenRouter failure diagnostics.
  - Durable SQLite storage, backup guidance, structured logs, and smoke tests.

## Main Lessons

### 1. Define Observable User Outcomes Before Coding

The biggest V1 rework came from workflows that were technically wired but not specific enough from the user's perspective:

- `Sync` could run but the visible lifecycle was unclear.
- Status buttons changed data but did not show the current state.
- Summary generation stored data but displayed it in the wrong place.
- Top-level tag creation attached to the first item because item ownership was not explicit.

V2 improvement:

- Every workflow spec must state the visible before/after outcome.
- Async workflows must define idle, running, success, failure, and refresh behavior.
- UI controls that mutate state must show the current state, not only perform the mutation.

### 2. Keep One Source Of Truth For Editable UI State

The summary preview plus textarea created ambiguity. The accepted fix made the textarea the obvious working surface.

V2 improvement:

- Avoid duplicate representations of editable data.
- If content is editable, the editable control should be the primary display.
- Separate preview modes only when the user explicitly switches modes.

### 3. Separate Global Resources From Item-Scoped Assignment

Tags exposed a common product mistake: creating a reusable tag and assigning it to an item are different actions.

V2 improvement:

- Name and design resource creation separately from relationship creation.
- In docs and tests, distinguish `create tag` from `attach tag to item`.
- Require tests that prove a global action does not mutate an unrelated item.

### 4. Investigate External Provider Failures Directly

The OpenRouter `429` issue looked like a bad key or app bug until a direct diagnostic request showed upstream Google AI Studio rate limiting for one free model.

V2 improvement:

- Keep provider diagnostics small, safe, and repeatable.
- Log provider status/reason metadata without secrets or full payloads.
- Preserve provider-specific messages through backend and frontend boundaries.
- Treat AI models as operational dependencies that can fail independently from our code.

### 5. Documentation Should Follow The Project's Existing Control System

The separate `docs/superpowers/specs` file was technically valid for the brainstorming workflow, but it did not match the project's documentation style.

V2 improvement:

- Project management decisions stay in `dev_management`.
- Product behavior goes in `docs/product`.
- API contracts go in `docs/api`.
- QA scenarios go in `docs/development` and `docs/release`.
- Avoid introducing new documentation roots unless the team explicitly wants them.

## Documentation Model For V2

Use fewer documents with clearer ownership:

- `dev_management/v2_plan.md`: iteration plan, current status, acceptance gates.
- `dev_management/action_log.md`: append-only decisions, verification evidence, lessons.
- `dev_management/v2_feedback_fixes.md`: only if V2 enters a structured bug-fix/adaptation phase.
- `docs/product/user-stories.md`: user-facing behavior only.
- `docs/api/local-api.md`: HTTP contract only.
- `docs/development/manual-smoke-scenarios.md`: manual QA flows.
- `docs/release/windows-v1-checklist.md` or a V2 equivalent: release readiness checklist.

Avoid duplicating the same detailed design in multiple places. Link from one control document to the relevant product/API/QA docs instead.

## Token-Efficient Working Rules For V2

### Keep Context Small

- Read targeted files instead of broad logs unless diagnosing process history.
- Summarize long historical logs into a short retrospective before planning.
- Use `rg` first, then open only the relevant sections.
- Prefer updating one canonical management file instead of creating parallel specs.

### Use Compact Status Tables

For iteration and bug-fix tracking, keep one row per item:

- ID
- status
- summary
- touched files
- verification
- notes

Put detailed reasoning in `action_log.md` only when it changes future behavior.

### Batch Documentation Updates By Ownership

For each behavior change:

- Product expectation: update `docs/product`.
- API shape: update `docs/api`.
- Manual test: update `docs/development` or `docs/release`.
- Implementation lesson: update `action_log.md`.

Do not repeat the full feature design in all four places.

### Prefer Evidence Over Narrative

Action log entries should be shorter:

- What changed.
- What failed first.
- What passed after.
- What lesson changes future work.

Avoid restating full test output when counts and commands are enough.

### Decide And Record Out Of Scope Early

V1 benefited from explicit decisions:

- no default Chrome profile detection;
- no tag rename UI;
- no bulk tag assignment;
- no packaging for V1;
- no full article extraction.

V2 should keep this discipline. Out-of-scope decisions prevent accidental product expansion and reduce token churn.

## Recommended V2 Process

1. Start with a short V2 charter:
   - goal;
   - non-goals;
   - success metrics;
   - target workflows.
2. Break V2 into small vertical iterations.
3. For each iteration, define:
   - user-visible outcome;
   - data/API changes;
   - failure modes;
   - automated tests;
   - manual QA script.
4. Implement with TDD where behavior changes.
5. Run automated verification before any completion claim.
6. Run one realistic manual smoke per accepted user workflow.
7. Update docs once per behavior slice, in the right document owner.
8. Keep a separate feedback-fix tracker only after V2 enters hands-on user testing.

## High-Value V2 Candidates

These are candidates, not committed scope:

- Browser-level frontend smoke tests.
- Better OpenRouter model fallback and cost/limit policy.
- Full article extraction for better summaries.
- Desktop packaging or simpler launcher.
- Bulk tag assignment.
- Tag rename UI if manual taxonomy work becomes frequent.
- Demo dataset and screenshots for repeatable reviews.
- Revisit SQLite driver/package strategy before packaging.

## Final Leadership Takeaway

V1 succeeded because the team kept narrowing scope, tested behavior before implementation, and used manual QA feedback quickly. The main cost came from documentation spread and from not always specifying user-visible outcomes before coding.

For V2, the lead discipline should be: one canonical plan, one append-only action log, explicit workflow outcomes, short feedback batches, and provider diagnostics that turn external uncertainty into evidence.
