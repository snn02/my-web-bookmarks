# V2-I1 Launcher Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reliable Windows launcher command surface (`start`, `stop`, `restart`, `status`) for the local app with deterministic final states.

**Architecture:** Implement a PowerShell entry script as the runtime orchestrator and keep process state in `data/runtime` as the launcher source of truth. Validate readiness through HTTP checks for backend (`/api/v1/health`) and web URL availability. Use Node-based integration tests to execute launcher commands from Windows PowerShell and assert observable outcomes.

**Tech Stack:** PowerShell 5+, Node.js test runner (`node --test`), existing workspace npm scripts, HTTP health checks.

---

## Scope Check

This plan intentionally covers only **V2-I1 Launcher Core**. Browser E2E smoke and desktop shortcut polish are separate subsystems and should be planned in follow-up docs (`V2-I2+`).

## File Structure (Planned)

- Create: `scripts/launcher.ps1`
  - Single command entrypoint with subcommands: `start|stop|restart|status`.
- Create: `scripts/launcher-test-utils.mjs`
  - Test helpers for invoking launcher commands and parsing text output.
- Create: `scripts/launcher.test.mjs`
  - Integration tests for launcher lifecycle behavior.
- Modify: `package.json`
  - Add launcher scripts and launcher test script.
- Modify: `dev_management/v2_plan.md`
  - Mark `V2-I1` status updates and verification evidence after implementation.
- Modify: `dev_management/action_log_v2.md`
  - Add short evidence-focused implementation notes.

## Task 1: Add Launcher Command Skeleton With Shared State Paths

**Files:**
- Create: `scripts/launcher.ps1`
- Test: `scripts/launcher.test.mjs`

- [ ] **Step 1: Write the failing test for launcher command discovery**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { runLauncher } from './launcher-test-utils.mjs';

test('launcher without command exits with usage text', async () => {
  const result = await runLauncher([]);
  assert.equal(result.exitCode, 1);
  assert.match(result.stdout + result.stderr, /start\|stop\|restart\|status/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/launcher.test.mjs --test-name-pattern "launcher without command exits with usage text"`
Expected: FAIL because launcher script/helper do not exist yet.

- [ ] **Step 3: Write minimal launcher skeleton**

```powershell
param(
  [Parameter(Position=0)]
  [string]$Command
)

$validCommands = @("start", "stop", "restart", "status")
if (-not $Command -or -not ($validCommands -contains $Command)) {
  Write-Output "Usage: launcher.ps1 <start|stop|restart|status>"
  exit 1
}

Write-Output "Command accepted: $Command"
exit 0
```

- [ ] **Step 4: Add minimal test helper and run test to verify it passes**

```js
import { spawn } from 'node:child_process';
import { join } from 'node:path';

export function runLauncher(args = []) {
  const scriptPath = join(process.cwd(), 'scripts', 'launcher.ps1');
  return new Promise((resolve) => {
    const child = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += String(chunk)));
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('close', (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout, stderr }));
  });
}
```

Run: `node --test scripts/launcher.test.mjs --test-name-pattern "launcher without command exits with usage text"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/launcher.ps1 scripts/launcher-test-utils.mjs scripts/launcher.test.mjs
git commit -m "test(launcher): add command skeleton and usage contract"
```

## Task 2: Implement `status` With Deterministic State Model

**Files:**
- Modify: `scripts/launcher.ps1`
- Modify: `scripts/launcher.test.mjs`

- [ ] **Step 1: Write failing tests for `status` output**

```js
test('status reports stopped when no runtime state exists', async () => {
  const result = await runLauncher(['status']);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /launcher:\s*stopped/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/launcher.test.mjs --test-name-pattern "status reports stopped"`
Expected: FAIL because `status` currently returns generic placeholder text.

- [ ] **Step 3: Implement runtime state resolution in launcher**

```powershell
$runtimeDir = Join-Path $PSScriptRoot "..\\data\\runtime"
$statePath = Join-Path $runtimeDir "launcher-state.json"

function Get-LauncherState {
  if (-not (Test-Path $statePath)) {
    return @{ launcher = "stopped"; api = "stopped"; web = "stopped" }
  }
  try {
    return Get-Content -Raw $statePath | ConvertFrom-Json -AsHashtable
  } catch {
    return @{ launcher = "failed"; reason = "state_file_invalid_json" }
  }
}

if ($Command -eq "status") {
  $state = Get-LauncherState
  Write-Output ("launcher: " + $state.launcher)
  if ($state.reason) { Write-Output ("reason: " + $state.reason) }
  exit 0
}
```

- [ ] **Step 4: Run tests to verify `status` passes**

Run: `node --test scripts/launcher.test.mjs --test-name-pattern "status reports stopped"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/launcher.ps1 scripts/launcher.test.mjs
git commit -m "feat(launcher): add status command and state file parsing"
```

## Task 3: Implement `start` With Health Checks And State Persistence

**Files:**
- Modify: `scripts/launcher.ps1`
- Modify: `scripts/launcher.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for `start` happy path**

```js
test('start launches services and reaches running state', async () => {
  const start = await runLauncher(['start']);
  assert.equal(start.exitCode, 0);

  const status = await runLauncher(['status']);
  assert.match(status.stdout, /launcher:\s*running/i);
  assert.match(status.stdout, /api:\s*running/i);
  assert.match(status.stdout, /web:\s*running/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/launcher.test.mjs --test-name-pattern "start launches services"`
Expected: FAIL because `start` behavior is not implemented.

- [ ] **Step 3: Implement minimal `start` orchestration**

```powershell
function Save-State($state) {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $json = $state | ConvertTo-Json -Depth 6
  Set-Content -Path $statePath -Value $json -Encoding UTF8
}

function Wait-HttpOk([string]$url, [int]$timeoutMs = 15000) {
  $deadline = (Get-Date).AddMilliseconds($timeoutMs)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 250
  }
  return $false
}

if ($Command -eq "start") {
  Save-State @{ launcher = "starting"; api = "starting"; web = "starting" }
  $apiProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev:api" -WindowStyle Hidden -PassThru
  $webProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev:web" -WindowStyle Hidden -PassThru

  $apiReady = Wait-HttpOk "http://127.0.0.1:4321/api/v1/health"
  $webReady = Wait-HttpOk "http://127.0.0.1:5173/"
  if ($apiReady -and $webReady) {
    Save-State @{
      launcher = "running"
      api = "running"
      web = "running"
      apiPid = $apiProcess.Id
      webPid = $webProcess.Id
      startedAt = (Get-Date).ToString("o")
    }
    exit 0
  }

  if ($apiProcess) { Stop-ManagedProcess $apiProcess.Id }
  if ($webProcess) { Stop-ManagedProcess $webProcess.Id }
  Save-State @{
    launcher = "failed"
    api = if ($apiReady) { "running" } else { "failed" }
    web = if ($webReady) { "running" } else { "failed" }
    reason = "startup_timeout"
  }
  exit 1
}
```

- [ ] **Step 4: Add package scripts and run focused tests**

```json
{
  "scripts": {
    "launcher:start": "powershell -ExecutionPolicy Bypass -File scripts/launcher.ps1 start",
    "launcher:stop": "powershell -ExecutionPolicy Bypass -File scripts/launcher.ps1 stop",
    "launcher:restart": "powershell -ExecutionPolicy Bypass -File scripts/launcher.ps1 restart",
    "launcher:status": "powershell -ExecutionPolicy Bypass -File scripts/launcher.ps1 status",
    "test:launcher": "node --test scripts/launcher.test.mjs"
  }
}
```

Run: `npm run test:launcher`
Expected: PASS for start/status happy path test.

- [ ] **Step 5: Commit**

```bash
git add scripts/launcher.ps1 scripts/launcher.test.mjs package.json
git commit -m "feat(launcher): implement start command with readiness checks"
```

## Task 4: Implement `stop` As Idempotent And Safe

**Files:**
- Modify: `scripts/launcher.ps1`
- Modify: `scripts/launcher.test.mjs`

- [ ] **Step 1: Write failing tests for idempotent stop**

```js
test('stop is idempotent and leaves stopped state', async () => {
  await runLauncher(['start']);
  const firstStop = await runLauncher(['stop']);
  const secondStop = await runLauncher(['stop']);

  assert.equal(firstStop.exitCode, 0);
  assert.equal(secondStop.exitCode, 0);
  const status = await runLauncher(['status']);
  assert.match(status.stdout, /launcher:\s*stopped/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/launcher.test.mjs --test-name-pattern "stop is idempotent"`
Expected: FAIL because `stop` behavior is not implemented.

- [ ] **Step 3: Implement `stop` with PID-aware cleanup**

```powershell
function Stop-ManagedProcess([int]$pidValue) {
  if ($pidValue -le 0) { return }
  $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($null -ne $proc) {
    Stop-Process -Id $pidValue -Force
  }
}

if ($Command -eq "stop") {
  $state = Get-LauncherState
  Stop-ManagedProcess $state.apiPid
  Stop-ManagedProcess $state.webPid
  Save-State @{ launcher = "stopped"; api = "stopped"; web = "stopped" }
  Write-Output "launcher: stopped"
  exit 0
}
```

- [ ] **Step 4: Run focused launcher tests**

Run: `npm run test:launcher`
Expected: PASS for stop idempotency and no unhandled errors on repeated stop.

- [ ] **Step 5: Commit**

```bash
git add scripts/launcher.ps1 scripts/launcher.test.mjs
git commit -m "feat(launcher): add idempotent stop command"
```

## Task 5: Implement `restart` And Double-Start Guard

**Files:**
- Modify: `scripts/launcher.ps1`
- Modify: `scripts/launcher.test.mjs`

- [ ] **Step 1: Write failing tests for restart and concurrent start guard**

```js
test('restart returns launcher to running state', async () => {
  await runLauncher(['start']);
  const restart = await runLauncher(['restart']);
  assert.equal(restart.exitCode, 0);
  const status = await runLauncher(['status']);
  assert.match(status.stdout, /launcher:\s*running/i);
});

test('second start does not spawn duplicate stack', async () => {
  const first = await runLauncher(['start']);
  const second = await runLauncher(['start']);
  assert.equal(first.exitCode, 0);
  assert.equal(second.exitCode, 0);
  assert.match(second.stdout + second.stderr, /already running|start skipped/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/launcher.test.mjs --test-name-pattern "restart returns launcher to running state|second start does not spawn duplicate stack"`
Expected: FAIL because `restart` and start-guard logic do not exist yet.

- [ ] **Step 3: Implement restart and lock semantics**

```powershell
if ($Command -eq "restart") {
  & $PSCommandPath stop | Out-Null
  & $PSCommandPath start
  exit $LASTEXITCODE
}

if ($Command -eq "start") {
  $state = Get-LauncherState
  if ($state.launcher -eq "running") {
    Write-Output "launcher already running; start skipped"
    exit 0
  }
  Save-State @{ launcher = "starting"; api = "starting"; web = "starting" }
  $apiProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev:api" -WindowStyle Hidden -PassThru
  $webProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev:web" -WindowStyle Hidden -PassThru
  $apiReady = Wait-HttpOk "http://127.0.0.1:4321/api/v1/health"
  $webReady = Wait-HttpOk "http://127.0.0.1:5173/"
  if ($apiReady -and $webReady) {
    Save-State @{ launcher = "running"; api = "running"; web = "running"; apiPid = $apiProcess.Id; webPid = $webProcess.Id }
    exit 0
  }
  Stop-ManagedProcess $apiProcess.Id
  Stop-ManagedProcess $webProcess.Id
  Save-State @{ launcher = "failed"; api = "failed"; web = "failed"; reason = "startup_timeout" }
  exit 1
}
```

- [ ] **Step 4: Run full launcher verification**

Run: `npm run test:launcher`
Expected: PASS for usage, status, start, stop, restart, and double-start guard tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/launcher.ps1 scripts/launcher.test.mjs
git commit -m "feat(launcher): add restart command and start guard"
```

## Task 6: Final V2-I1 Verification And Plan Tracking Updates

**Files:**
- Modify: `dev_management/v2_plan.md`
- Modify: `dev_management/action_log_v2.md`

- [ ] **Step 1: Run required project checks**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS including smoke helper tests and workspace tests.

Run: `npm run test:launcher`
Expected: PASS.

- [ ] **Step 2: Update V2 control docs with evidence**

```md
## V2-I1: Launcher Core
**Status:** accepted
**Verification evidence:**
- npm run typecheck (date)
- npm run lint (date)
- npm test (date)
- npm run test:launcher (date)
```

```md
## YYYY-MM-DD - V2-I1 Launcher Core Completed
**Change**
- Added launcher command surface and deterministic state model.
**What failed first**
- restart/double-start tests failed before implementation.
**What passed after**
- launcher and workspace verification commands passed.
**Lesson**
- Explicit state files reduced ambiguity in process lifecycle behavior.
```

- [ ] **Step 3: Commit documentation and verification updates**

```bash
git add dev_management/v2_plan.md dev_management/action_log_v2.md
git commit -m "docs(v2): record launcher core verification evidence"
```

## Self-Review

- Spec coverage check: This plan covers V2-I1 requirements only (`start`, `stop`, `restart`, `status`, deterministic states, test-first execution).
- Placeholder scan: removed ambiguous implementation placeholders; each command step now includes concrete process and health-check wiring.
- Type/signature consistency: command names and state labels are consistently `start|stop|restart|status` and `running|stopped|failed|starting`.
