---
name: ai-reliability
description: Handle AI summary/tag-suggestion behavior with reliable diagnostics and UX-safe failures. Use when changing OpenRouter integration, prompts, AI error mapping, or AI UI states.
---

# AI Reliability

## Rules

1. Treat AI provider as an external dependency that can fail independently.
2. Preserve specific provider failure messages across backend and frontend.
3. Never expose secrets in API responses or logs.
4. Keep AI optional: core bookmark workflows must remain usable.

## Workflow

1. Reproduce with evidence (logs and endpoint behavior).
2. Distinguish failure class:
   - configuration (`ai_not_configured`);
   - provider/upstream (`upstream_error`);
   - rate limit/quota/model-specific constraints.
3. Keep diagnostics minimal and safe (status/reason, no key/payload leaks).
4. Ensure frontend renders readable error text, not raw JSON.
5. Verify lifecycle final state is visible (`success`, `failure`, or retryable error).
6. Run:
   - `npm run test --workspace @my-web-bookmarks/desktop-api`
   - `npm run test --workspace @my-web-bookmarks/web`
   - `npm run typecheck`
   - `npm run lint`

## Large File Anti-Hallucination Rules

1. Use bounded chunking and explicit extraction traces for large inputs.
2. Do not make confident claims without grounded extracted evidence.
3. If grounding is insufficient, return a final readable failure state (for example `not_enough_grounded_context`) instead of speculative content.
4. Keep provider-specific diagnostics visible end-to-end without exposing secrets.
5. Record the failure class and mitigation in the linked GitHub Issue when this path is triggered.

## Prompt Constraints (V1-Compatible)

- Summary generation: Russian output.
- Tag suggestions: tolerate model output formats (line-based, JSON, comma-separated).
