import process from 'node:process';
import { runFailureSmoke } from './e2e-smoke-failure.mjs';
import { runHappySmoke } from './e2e-smoke-happy.mjs';

async function run() {
  const checks = [];

  try {
    await runHappySmoke();
    checks.push({ name: 'happy-path', ok: true });
  } catch (error) {
    checks.push({ name: 'happy-path', ok: false, detail: error instanceof Error ? error.message : String(error) });
  }

  try {
    await runFailureSmoke();
    checks.push({ name: 'failure-path', ok: true });
  } catch (error) {
    checks.push({ name: 'failure-path', ok: false, detail: error instanceof Error ? error.message : String(error) });
  }

  for (const check of checks) {
    console.log(`- ${check.name}: ${check.ok ? 'ok' : 'failed'}`);
    if (check.detail) {
      console.log(`  ${check.detail}`);
    }
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    throw new Error(`e2e smoke failed: ${failed.map((check) => check.name).join(', ')}`);
  }

  console.log('e2e smoke: pass');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
