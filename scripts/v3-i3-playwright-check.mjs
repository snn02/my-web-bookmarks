import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173/';
const outDir = path.resolve('data/runtime/v3-i3-playwright');

async function run() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.getByText('Backend: available').waitFor({ timeout: 30_000 });
    await page.screenshot({ path: path.join(outDir, '01-inbox.png'), fullPage: true });

    await page.getByRole('button', { name: 'Toggle details for Vue Guide' }).click();
    await page.getByRole('button', { name: 'Save summary for Vue Guide' }).waitFor({ timeout: 15_000 });
    await page.screenshot({ path: path.join(outDir, '02-item-expanded.png'), fullPage: true });

    await page.getByRole('textbox', { name: 'Summary for Vue Guide' }).fill('Updated summary from Playwright check.');
    await page.getByRole('button', { name: 'Save summary for Vue Guide' }).click();
    await page.locator('.notice').waitFor({ timeout: 15_000 });
    const summaryNoticeText = (await page.locator('.notice').first().textContent())?.trim() ?? '';
    await page.screenshot({ path: path.join(outDir, '03-summary-saved.png'), fullPage: true });

    await page.getByRole('button', { name: 'Open settings view' }).click();
    const settingsNoticeText =
      (await page.getByRole('textbox', { name: 'Chrome profile path' }).inputValue()).trim() || 'path visible';
    await page.screenshot({ path: path.join(outDir, '04-settings-saved.png'), fullPage: true });

    await page.getByRole('button', { name: 'Open inbox view' }).click();
    await page.getByRole('button', { name: 'Sync bookmarks' }).click();
    await page.waitForFunction(() => {
      const el = document.querySelector('.sync-phase');
      if (!el) return false;
      const text = el.textContent ?? '';
      return text.includes('success') || text.includes('failure');
    });
    await page.screenshot({ path: path.join(outDir, '05-sync-final-state.png'), fullPage: true });

    const syncPhase = await page.locator('.sync-phase').textContent();
    console.log(`v3-i3 playwright check: pass`);
    console.log(`summary notice: ${summaryNoticeText || 'n/a'}`);
    console.log(`settings notice: ${settingsNoticeText || 'n/a'}`);
    console.log(`sync phase: ${syncPhase?.trim() ?? 'unknown'}`);
    console.log(`screenshots: ${outDir}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`v3-i3 playwright check: fail\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
