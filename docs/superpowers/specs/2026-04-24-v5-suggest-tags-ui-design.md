# V5 Suggest Tags UI Design

Date: 2026-04-24  
Status: Draft for review  
Related roadmap: `dev_management/v5_plan.md` (V5-I4)

## Goal

Make `Suggest tags` predictable and fast by unifying suggested-tag interaction with existing item tag UI, while preserving explicit user confirmation boundaries.

## Confirmed User Scenario

1. User clicks `Suggest tags`.
2. Suggested tags appear under `Find existing tag`.
3. User clicks a suggested tag chip body:
   - tag is attached to item;
   - tag disappears from suggested list.
4. User clicks `x` on a suggested tag chip:
   - tag is removed from suggestions only;
   - no item tag mutation.

## Current Gaps

- `Suggest tags` button is separated from item tag input flow.
- Suggested tags are rendered in a dedicated visual block that differs from assigned tags.
- Suggested list can include tags already assigned to the item.
- Suggested tags have no direct dismiss control.

## Approaches

### 1) Inline chip unification (recommended)

- Keep one item-level tag editor zone.
- Place `Suggest tags` button directly before `Find existing tag` input.
- Render suggested tags as chips in the same style family as assigned tags.
- Suggested chip interactions:
  - chip click -> confirm and attach;
  - `x` click -> dismiss only.
- Assigned chip interactions remain unchanged:
  - `x` click -> detach assigned tag from item.

Trade-offs:
- Pros: minimal cognitive load, closest to requested flow, low API impact.
- Cons: needs careful event handling to avoid `x` triggering chip confirm.

### 2) Two-row chip layout with style parity

- Keep separate rows:
  - `Assigned`;
  - `Suggested`.
- Both rows use same chip visuals and controls.

Trade-offs:
- Pros: explicit semantic separation.
- Cons: more vertical space and slightly slower scan.

### 3) Merge suggestions into autocomplete dropdown

- Show AI suggestions in the same dropdown as typed existing-tag matches.

Trade-offs:
- Pros: very compact.
- Cons: weak discoverability for dismiss action and less clear persistence boundary.

## Recommendation

Use Approach 1 (inline chip unification). It directly matches requested behavior and keeps interaction local to the item tag editor.

## UI/Interaction Design

## Layout (expanded item card)

1. Existing assigned tags row (unchanged pattern).
2. Controls row:
   - `Suggest tags` button;
   - `Find existing tag` input.
3. Suggested tags row (new/updated behavior):
   - same chip style as assigned tags;
   - each chip has text and `x`.

## Suggested chip semantics

- Chip body click:
  - attaches matched/created tag;
  - removes suggestion from current list.
- Chip `x` click:
  - removes from suggested list only;
  - does not call attach endpoint.

## Filtering rule

- Suggested tags are filtered per item by case-insensitive name match against assigned item tags.
- If already assigned, do not render in suggestion row.

## Data Flow/State Changes (frontend only)

1. `loadTagSuggestions(item)` receives API suggestions.
2. Normalize and filter suggestions against `item.tags`.
3. Save filtered list in `tagSuggestionsByItemId[item.id]`.
4. `applySuggestedTag(item, suggestion)`:
   - attach tag;
   - on success remove suggestion from list.
5. `dismissSuggestedTag(itemId, suggestionName)`:
   - remove suggestion from list only.

No backend contract change is required.

## Error Handling

- Existing AI error flow remains unchanged:
  - `Suggesting...` during run;
  - readable final error on failure.
- Dismiss action is local and silent unless state update fails unexpectedly.

## Testing Impact

## Web unit/component tests

- `Suggest tags` button renders before tag search input in expanded card.
- Suggested list excludes already assigned tags.
- Suggested chips render in unified chip container under tag search input.
- Clicking suggested chip attaches and removes suggestion.
- Clicking suggested chip `x` dismisses without attach request.

## Manual smoke updates

- Added scenario steps in `docs/development/manual-smoke-scenarios.md` for:
  - placement;
  - exclusion of already attached tags;
  - confirm vs dismiss actions.

## Out of scope

- Ranking/ordering logic changes for suggested tags.
- Backend/API schema changes.
- Global tag creation flow changes.
