import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const deadlineMs = Date.now() + 60_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openPageWithRetry(page) {
  let lastError = null;
  while (Date.now() < deadlineMs) {
    try {
      await page.goto(baseUrl, { timeout: 4000, waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Backend:', { timeout: 4000 });
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw new Error(`UI did not become available at ${baseUrl}. Last error: ${String(lastError)}`);
}

async function run() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  try {
    const page = await browser.newPage();
    await openPageWithRetry(page);

    const bodyText = (await page.textContent('body')) ?? '';
    if (!bodyText.includes('Backend: available')) {
      throw new Error(`Expected "Backend: available" in UI. Actual body: ${bodyText.slice(0, 300)}`);
    }

    console.log('playwright check: pass');
    process.exitCode = 0;
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`playwright check: fail\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

