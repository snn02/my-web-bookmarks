# Manual Smoke Scenarios

These scenarios mirror the lifecycle checks introduced after Iteration 4 and Iteration 5.

## Launcher Lifecycle

- Optional shortcut setup:
  - Run `npm run launcher:create-shortcut`.
  - Confirm `My Web Bookmarks.lnk` appears on Desktop.
  - Double-click it once and continue with the checks below.
- Run `npm run launcher:start`.
- Run `npm run launcher:status`.
- Expected result: launcher, api, and web are all shown as `running`.
- Run `npm run launcher:restart`.
- Run `npm run launcher:status`.
- Expected result: launcher returns to `running` without manual recovery steps.
- Run `npm run launcher:stop` twice.
- Run `npm run launcher:status`.
- Expected result: `stop` is idempotent and status remains `stopped`.

## Sync Lifecycle

- Start backend and web UI.
- Leave Chrome profile path empty.
- Press `Sync`.
- Expected result: sync reaches a final failed state and displays an actionable error.
- Enter a real Chrome profile folder path.
- Press `Sync`.
- Expected result: sync reaches a final state and imported items appear, or a visible error explains the failure.
- For an imported item, confirm the current status text is green and the matching `New`, `Read`, or `Archive` action button is green.
- Change the item status with `New`, `Read`, and `Archive`.
- Expected result: the visible status and green active button move to the selected status without requiring another sync.

## Manual Tag Lifecycle

- Enter a tag name in the top `New tag` field.
- Press `Create tag`.
- Expected result: the tag is created globally and appears in tag filters, but no bookmark item receives it automatically.
- In one item card, type part of an existing tag name in the item-level tag input.
- Expected result: a suggestion list shows existing tags that contain the typed substring and are not already attached to the item.
- Click one suggested tag.
- Expected result: the tag appears only on that item.
- Confirm another item did not receive the tag.
- Click `x` on the item tag block.
- Expected result: the tag is removed from that item but remains available globally.

## AI Lifecycle

- Leave OpenRouter API key empty.
- Press `Generate summary`.
- Expected result: AI action reaches a visible failure state and manual bookmark workflows still work.
- Enter OpenRouter API key and model.
- Press `Generate summary` without pressing `Save AI` first.
- Expected result: settings are saved or validated as part of the action, then the generated Russian summary appears directly in the editable summary field, or the UI shows a visible upstream error.
- If OpenRouter returns `429`, expected result: the UI says the OpenRouter rate limit was reached and suggests waiting or choosing another model.
- Press `Suggest tags`.
- Expected result: short tag suggestions appear but are not persisted.
- If OpenRouter returns an upstream failure, expected result: the UI shows a readable troubleshooting message, not a raw JSON error payload.
- Confirm one suggestion.
- Expected result: the tag appears on the item through the same item-scoped tag area.

## No-Indefinite-State Rule

No main workflow should remain indefinitely in `running`, `loading`, or `generating`. Each workflow must end in success, failure, retryable error, or a clearly visible blocked state.
