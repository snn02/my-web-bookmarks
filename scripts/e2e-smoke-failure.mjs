import { pathToFileURL } from 'node:url';
import { delay, startLauncher, stopLauncher, waitForAppReady, withBrowserPage } from './e2e-smoke-lib.mjs';

async function waitForSyncFailed(page, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const bodyText = (await page.textContent('body')) ?? '';
    if (bodyText.includes('Sync: failed')) {
      return;
    }
    await delay(400);
  }

  throw new Error('Expected Sync to reach failed final state, but it did not.');
}

export async function runFailureSmoke() {
  await startLauncher();

  try {
    await withBrowserPage(async (page) => {
      await waitForAppReady(page);

      const invalidProfilePath = `C:\\definitely-missing-smoke-${Date.now()}`;
      await page.getByRole('button', { name: 'Open settings view', exact: true }).click();
      await page.getByRole('textbox', { name: 'Chrome profile path', exact: true }).fill(invalidProfilePath);
      await page.getByRole('button', { name: 'Save Chrome profile path', exact: true }).click();
      await page.getByRole('button', { name: 'Open inbox view', exact: true }).click();
      await page.getByRole('button', { name: 'Sync bookmarks', exact: true }).click();

      await waitForSyncFailed(page);

      const syncErrorText = (await page.locator('.sync-error').textContent())?.trim() ?? '';
      if (!syncErrorText) {
        throw new Error('Expected readable sync error text for failure path, but none was shown.');
      }
    });

    console.log('e2e failure: pass');
  } finally {
    await stopLauncher();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runFailureSmoke().catch((error) => {
    console.error(`e2e failure: fail\n${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
