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
- Confirm the app opens in `Inbox` view and `Settings` is accessible from the top switch.
- Open `Settings` and verify `Chrome profile path`, OpenRouter API key field, and both model dropdowns are present.
- Return to `Inbox` and verify those settings controls are not present there.
- Leave Chrome profile path empty.
- Press `Sync`.
- Expected result: sync reaches a final failed state and displays an actionable error.
- Enter a real Chrome profile folder path.
- Press `Save path`.
- Expected result: a visible success confirmation appears.
- Return to `Inbox`.
- Press `Sync`.
- Expected result: sync button switches to `Syncing...` during run and then ends in a visible final state (`success` or `failure`).
- Expected result: imported items appear on success, or a visible error explains the failure.
- For an imported item, confirm the current status text is green and the matching `New`, `Read`, or `Archive` action button is green.
- Change the item status with `New`, `Read`, and `Archive`.
- Expected result: the visible status and green active button move to the selected status without requiring another sync.
- Expected result: a visible success confirmation appears for the status update.

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

- Open `Settings`.
- Leave OpenRouter API key empty.
- Return to `Inbox`.
- Press `Generate summary`.
- Expected result: AI action reaches a visible failure state and manual bookmark workflows still work.
- Return to `Settings`.
- Enter OpenRouter API key and choose summary/tags models.
- Press `Save AI`.
- Expected result: a visible success confirmation appears.
- Return to `Inbox`.
- Press `Generate summary`.
- Expected result: button shows `Generating...` while running, then generated Russian summary appears directly in the editable summary field, or the UI shows a visible upstream error.
- If OpenRouter returns `429`, expected result: the UI says the OpenRouter rate limit was reached and suggests waiting or choosing another model.
- Press `Suggest tags`.
- Expected result: button shows `Suggesting...` while running; short tag suggestions appear but are not persisted.
- If OpenRouter returns an upstream failure, expected result: the UI shows a readable troubleshooting message, not a raw JSON error payload.
- Confirm one suggestion.
- Expected result: the tag appears on the item through the same item-scoped tag area.

## No-Indefinite-State Rule

No main workflow should remain indefinitely in `running`, `loading`, or `generating`. Each workflow must end in success, failure, retryable error, or a clearly visible blocked state.

## Browser E2E Smoke

- Run `npm run e2e:smoke`.
- Expected result:
  - `happy-path: ok`
  - `failure-path: ok`
  - final line `e2e smoke: pass`

## V2 Gate

- Run `npm run smoke:v2`.
- Expected result:
  - launcher checks pass;
  - browser e2e smoke checks pass;
  - command exits with success status.
