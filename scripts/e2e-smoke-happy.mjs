import { pathToFileURL } from 'node:url';
import { startLauncher, stopLauncher, waitForAppReady, withBrowserPage } from './e2e-smoke-lib.mjs';

function uniqueTagName() {
  return `e2e-smoke-${Date.now()}`;
}

export async function runHappySmoke() {
  await startLauncher();

  try {
    await withBrowserPage(async (page) => {
      await waitForAppReady(page);

      const tagName = uniqueTagName();
      await page.getByLabel('New tag name').fill(tagName);
      await page.getByRole('button', { name: 'Create tag' }).click();

      await page.getByLabel('Tag filter').selectOption({ label: tagName });
      const selectedText = await page.locator('[aria-label="Tag filter"] option:checked').textContent();
      if (selectedText?.trim() !== tagName) {
        throw new Error(`Expected created tag to be selectable. Expected "${tagName}", got "${selectedText}".`);
      }
    });

    console.log('e2e happy: pass');
  } finally {
    await stopLauncher();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runHappySmoke().catch((error) => {
    console.error(`e2e happy: fail\n${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
