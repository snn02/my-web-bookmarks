import { spawn } from 'node:child_process';
import process from 'node:process';
import { join } from 'node:path';
import { chromium } from 'playwright';

export const APP_URL = 'http://127.0.0.1:5173';

export function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runCommand(command, args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGTERM');
      resolve({ exitCode: 124, stdout, stderr: `${stderr}\nTimed out after ${timeoutMs}ms.` });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

export async function runNpmScript(scriptName, options) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = await runCommand(npmCommand, ['run', scriptName], options);
  if (result.exitCode !== 0) {
    throw new Error(
      `npm run ${scriptName} failed with code ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  return result;
}

export async function startLauncher() {
  const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  const launcherScript = join(process.cwd(), 'scripts', 'launcher.ps1');
  const result = await runCommand(
    powershell,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcherScript, 'start'],
    { timeoutMs: 180_000 }
  );
  if (result.exitCode !== 0) {
    throw new Error(`launcher:start failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

export async function stopLauncher() {
  try {
    const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    const launcherScript = join(process.cwd(), 'scripts', 'launcher.ps1');
    await runCommand(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcherScript, 'stop'], {
      timeoutMs: 120_000
    });
  } catch {
    // Best-effort cleanup for test flows.
  }
}

export async function withBrowserPage(run) {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  try {
    const page = await browser.newPage();
    return await run(page);
  } finally {
    await browser.close();
  }
}

export async function waitForAppReady(page, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      await page.goto(APP_URL, { timeout: 4000, waitUntil: 'domcontentloaded' });
      await page.getByText('Backend: available').waitFor({ timeout: 3000 });
      return;
    } catch (error) {
      lastError = error;
      await delay(400);
    }
  }

  throw new Error(`App did not become ready at ${APP_URL}. Last error: ${String(lastError)}`);
}
