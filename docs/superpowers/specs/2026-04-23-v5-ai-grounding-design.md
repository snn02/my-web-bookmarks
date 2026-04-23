# V5 AI Grounding Design

Date: 2026-04-23  
Status: Ready for review  
Related roadmap: `dev_management/v5_plan.md`  
Related issues: `#5`, `#6`, `#7`

## Goal

Improve AI reliability by grounding summary and tag generation in extracted page content, and split model settings by operation (summary vs tags) with ranked defaults.

## Confirmed Decisions

1. Content extraction strategy is `hybrid` (primary + fallback algorithm).
2. Tag generation uses stored summary when available.
3. If summary is missing in tag flow, extraction/preprocessing is run for context only and does not persist a summary.
4. Settings has two model selectors (summary model and tags model) with one shared save action.
5. If model selection is missing, backend resolves to the top-rated model for that operation from the product model table.

## Architecture Changes

## A. AI Context Pipeline

- Add a content extraction unit in backend domain/integration layer:
  - input: item URL;
  - output: normalized page content text with metadata about extraction quality.
- Add network safety/performance guardrails for extraction:
  - allow only `http`/`https`;
  - block localhost/private-network targets;
  - enforce timeout and max-response-size limits;
  - cap redirect count.
- Extraction is hybrid:
  - primary algorithm for main-content extraction;
  - fallback algorithm when primary fails or returns low-quality output.
- Add preprocessing unit:
  - remove boilerplate/noise;
  - normalize whitespace and duplicate segments;
  - preserve heading and paragraph structure where useful;
  - enforce context size limits deterministically.

## B. Summary Generation Flow

- `POST /api/v1/items/:itemId/summary`:
  1. load item;
  2. extract + preprocess page content;
  3. build grounded summary prompt with extracted content;
  4. call OpenRouter with summary model;
  5. persist returned summary via existing single-summary upsert.
- Prompt instruction must explicitly prohibit unsupported assumptions and require summary from provided content only.
- Extracted content must be embedded as quoted/clearly delimited context so page text cannot override system instructions.

## C. Tag Suggestion Flow

- `POST /api/v1/items/:itemId/tag-suggestions`:
  1. load item;
  2. if stored summary exists -> use it as tag-context;
  3. else extract + preprocess content and use that context;
  4. call OpenRouter with tags model;
  5. return suggestions only (no automatic persistence).

## D. Settings Model Split

- Replace single model setting with operation-scoped model settings:
  - summary model;
  - tags model.
- Keep API key handling and single Save action unchanged.
- UI renders two dropdowns populated from model table sorted by relevant fit score.

## API Contract Impact

- `GET /settings` and `PATCH /settings` expand `openRouter` payload to include both model fields.
- Backward compatibility:
  - existing saved single-model setting is read only as fallback when operation-specific key is absent;
  - operation-specific keys always take precedence when present.
- AI error contract remains structured:
  - `ai_not_configured`;
  - `upstream_error`;
  - `content_unavailable` for extraction/processing failures before provider call;
  - readable final messages in UI.

## Data/Storage Impact

- Continue using `settings` key-value storage; add operation-specific keys for models.
- No new SQL table required.
- DB documentation must reflect new settings keys and defaults behavior.
- Add explicit migration notes:
  - legacy key: `openrouter_model`;
  - new keys: operation-scoped model keys for summary/tags;
  - migration policy must be deterministic and covered by tests.

## Prompting Rules

- Summary prompt:
  - use only extracted content;
  - do not invent facts outside context;
  - when context is insufficient, state limitation clearly instead of hallucinating.
- Tag prompt:
  - generate concise normalized tags from provided context only;
  - keep output format parser-friendly.

## Ranking And Defaults

- Source of truth for runtime ranking/default logic: versioned code config in backend.
- `docs/product/openrouter-free-ai-models.md` is documentation of the same table, not runtime parser input.
- Summary dropdown sort:
  - `Summary rating` desc;
  - `Priority` asc;
  - model id asc.
- Tags dropdown sort:
  - `Tag suggestion rating` desc;
  - `Priority` asc;
  - model id asc.
- Default selection when unset:
  - choose highest-ranked model for that operation (rating first, priority tie-break).

## Error Handling

- Extraction failure and empty-content outcomes must map to readable AI failure states.
- Upstream/provider failures keep existing safe semantics and secret redaction.
- UI must always end operations in explicit final phase (`success` or `failure`).

## Testing Strategy

- Unit:
  - extraction primary success;
  - fallback trigger path;
  - preprocessing bounds and deterministic truncation;
  - model ranking and default resolution logic.
- API integration:
  - summary flow with extracted content;
  - extraction guardrails (`timeout`, oversized response, blocked host/protocol);
  - tag flow with stored summary;
  - tag flow without summary (no summary persistence side effect);
  - deterministic error mapping for extraction vs provider upstream failures.
- Web:
  - two model dropdowns + one Save action;
  - sorted options;
  - summary/tags AI operations end in visible final states.
- Full gates:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run smoke`

## Rollout Order

1. V5-I1 (`#5`)
2. V5-I2 (`#6`)
3. V5-I3 (`#7`)
