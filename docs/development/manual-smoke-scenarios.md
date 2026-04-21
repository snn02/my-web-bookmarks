# Manual Smoke Scenarios

These scenarios mirror the lifecycle checks introduced after Iteration 4 and Iteration 5.

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

## AI Lifecycle

- Leave OpenRouter API key empty.
- Press `Generate summary`.
- Expected result: AI action reaches a visible failure state and manual bookmark workflows still work.
- Enter OpenRouter API key and model.
- Press `Generate summary` without pressing `Save AI` first.
- Expected result: settings are saved or validated as part of the action, then the UI shows a generated summary or a visible upstream error.
- Press `Suggest tags`.
- Expected result: suggestions appear but are not persisted.
- If OpenRouter returns an upstream failure, expected result: the UI shows a readable troubleshooting message, not a raw JSON error payload.
- Confirm one suggestion.
- Expected result: the tag appears on the item.

## No-Indefinite-State Rule

No main workflow should remain indefinitely in `running`, `loading`, or `generating`. Each workflow must end in success, failure, retryable error, or a clearly visible blocked state.
