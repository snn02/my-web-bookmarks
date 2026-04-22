param(
  [Parameter(Position = 0)]
  [string]$Command
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$validCommands = @('start', 'stop', 'restart', 'status')
if (-not $Command -or -not ($validCommands -contains $Command)) {
  Write-Output 'Usage: launcher.ps1 <start|stop|restart|status>'
  exit 1
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$runtimeDir = Join-Path $repoRoot 'data\runtime'
$statePath = Join-Path $runtimeDir 'launcher-state.json'

function Get-EnvInt([string]$name, [int]$defaultValue) {
  $raw = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $defaultValue
  }
  try {
    return [int]$raw
  } catch {
    return $defaultValue
  }
}

$apiPort = Get-EnvInt -name 'LAUNCHER_API_PORT' -defaultValue 4321
$webPort = Get-EnvInt -name 'LAUNCHER_WEB_PORT' -defaultValue 5173
$startupTimeoutMs = Get-EnvInt -name 'LAUNCHER_START_TIMEOUT_MS' -defaultValue 30000
$isTestMode = [Environment]::GetEnvironmentVariable('LAUNCHER_TEST_MODE') -eq '1'

function Ensure-RuntimeDir {
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}

function Get-HashValue([hashtable]$source, [string]$key, $defaultValue) {
  if ($null -eq $source) {
    return $defaultValue
  }
  if ($source.ContainsKey($key)) {
    return $source[$key]
  }
  return $defaultValue
}

function ConvertTo-Hashtable([object]$value) {
  if ($null -eq $value) {
    return $null
  }

  if ($value -is [System.Collections.IDictionary]) {
    $hash = @{}
    foreach ($entry in $value.GetEnumerator()) {
      $hash[[string]$entry.Key] = ConvertTo-Hashtable -value $entry.Value
    }
    return $hash
  }

  if ($value -is [System.Collections.IEnumerable] -and -not ($value -is [string])) {
    $list = @()
    foreach ($item in $value) {
      $list += ,(ConvertTo-Hashtable -value $item)
    }
    return $list
  }

  if ($value -is [System.Management.Automation.PSCustomObject]) {
    $hash = @{}
    foreach ($prop in $value.PSObject.Properties) {
      $hash[$prop.Name] = ConvertTo-Hashtable -value $prop.Value
    }
    return $hash
  }

  return $value
}

function New-StoppedState {
  return @{
    launcher = 'stopped'
    api = 'stopped'
    web = 'stopped'
  }
}

function Save-State([hashtable]$state) {
  Ensure-RuntimeDir
  $json = $state | ConvertTo-Json -Depth 8
  Set-Content -Path $statePath -Value $json -Encoding utf8
}

function Get-State {
  if (-not (Test-Path $statePath)) {
    return New-StoppedState
  }

  try {
    $raw = Get-Content -Path $statePath -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return @{
        launcher = 'failed'
        api = 'failed'
        web = 'failed'
        reason = 'state_file_empty'
      }
    }
    $parsedObject = ConvertFrom-Json -InputObject $raw
    $parsed = ConvertTo-Hashtable -value $parsedObject
    if ($null -eq $parsed) {
      return @{
        launcher = 'failed'
        api = 'failed'
        web = 'failed'
        reason = 'state_file_invalid_json'
      }
    }
    return $parsed
  } catch {
    return @{
      launcher = 'failed'
      api = 'failed'
      web = 'failed'
      reason = ('state_file_invalid_json: ' + $_.Exception.Message)
    }
  }
}

function Test-ProcessAlive([int]$pidValue) {
  if ($pidValue -le 0) {
    return $false
  }
  $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  return $null -ne $proc
}

function Stop-ManagedProcess([int]$pidValue) {
  if ($pidValue -le 0) {
    return
  }

  try {
    taskkill /PID $pidValue /T /F 2>$null 1>$null
  } catch {
    # Fall back to direct process stop below.
  }

  $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($null -ne $proc) {
    Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
  }
}

function Test-HttpOk([string]$url) {
  try {
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

function Wait-HttpOk([string]$url, [int]$timeoutMs) {
  $deadline = (Get-Date).AddMilliseconds($timeoutMs)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpOk -url $url) {
      return $true
    }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Get-EffectiveStatus {
  $state = Get-State
  $launcher = [string](Get-HashValue -source $state -key 'launcher' -defaultValue 'stopped')
  if ($launcher -eq 'stopped') {
    return New-StoppedState
  }

  if ($launcher -eq 'failed') {
    return @{
      launcher = 'failed'
      api = [string](Get-HashValue -source $state -key 'api' -defaultValue 'failed')
      web = [string](Get-HashValue -source $state -key 'web' -defaultValue 'failed')
      reason = [string](Get-HashValue -source $state -key 'reason' -defaultValue 'startup_failed')
    }
  }

  $apiPid = [int](Get-HashValue -source $state -key 'apiPid' -defaultValue 0)
  $webPid = [int](Get-HashValue -source $state -key 'webPid' -defaultValue 0)
  $apiAlive = Test-ProcessAlive -pidValue $apiPid
  $webAlive = Test-ProcessAlive -pidValue $webPid
  $apiHealthy = $apiAlive -and (Test-HttpOk -url ("http://127.0.0.1:{0}/api/v1/health" -f $apiPort))
  $webHealthy = $webAlive -and (Test-HttpOk -url ("http://127.0.0.1:{0}/" -f $webPort))

  if ($apiHealthy -and $webHealthy) {
    return @{
      launcher = 'running'
      api = 'running'
      web = 'running'
      apiPid = $apiPid
      webPid = $webPid
      mode = [string](Get-HashValue -source $state -key 'mode' -defaultValue 'normal')
      startedAt = [string](Get-HashValue -source $state -key 'startedAt' -defaultValue '')
    }
  }

  return @{
    launcher = 'failed'
    api = $(if ($apiHealthy) { 'running' } else { 'failed' })
    web = $(if ($webHealthy) { 'running' } else { 'failed' })
    reason = 'component_unhealthy'
    apiPid = $apiPid
    webPid = $webPid
    mode = [string](Get-HashValue -source $state -key 'mode' -defaultValue 'normal')
    startedAt = [string](Get-HashValue -source $state -key 'startedAt' -defaultValue '')
  }
}

function Write-Status([hashtable]$status) {
  Write-Output ("launcher: " + $status.launcher)
  Write-Output ("api: " + $status.api)
  Write-Output ("web: " + $status.web)
  if ($status.ContainsKey('reason') -and -not [string]::IsNullOrWhiteSpace([string]$status.reason)) {
    Write-Output ("reason: " + [string]$status.reason)
  }
}

function Start-TestServer([string]$kind) {
  Ensure-RuntimeDir

  if ($kind -eq 'api') {
    $apiScriptPath = Join-Path $runtimeDir 'launcher-test-api-server.cjs'
    $apiScript = @"
const http = require('node:http');
const port = Number(process.env.LAUNCHER_API_PORT || '4321');
const server = http.createServer((req, res) => {
  if (req.url === '/api/v1/health') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});
server.listen(port, '127.0.0.1');
setInterval(() => {}, 1 << 30);
"@
    Set-Content -Path $apiScriptPath -Value $apiScript -Encoding utf8
    return Start-Process -FilePath 'node' -ArgumentList @($apiScriptPath) -PassThru -WindowStyle Hidden
  }

  $webScriptPath = Join-Path $runtimeDir 'launcher-test-web-server.cjs'
  $webScript = @"
const http = require('node:http');
const port = Number(process.env.LAUNCHER_WEB_PORT || '5173');
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<!doctype html><title>my-web-bookmarks</title>');
});
server.listen(port, '127.0.0.1');
setInterval(() => {}, 1 << 30);
"@
  Set-Content -Path $webScriptPath -Value $webScript -Encoding utf8
  return Start-Process -FilePath 'node' -ArgumentList @($webScriptPath) -PassThru -WindowStyle Hidden
}

function Start-LauncherStack {
  $effective = Get-EffectiveStatus
  if ($effective.launcher -eq 'running') {
    return @{
      exitCode = 0
      message = 'launcher already running; start skipped'
      status = $effective
    }
  }

  Save-State @{
    launcher = 'starting'
    api = 'starting'
    web = 'starting'
    mode = $(if ($isTestMode) { 'test' } else { 'normal' })
  }

  $apiProcess = $null
  $webProcess = $null

  try {
    if ($isTestMode) {
      $apiProcess = Start-TestServer -kind 'api'
      $webProcess = Start-TestServer -kind 'web'
    } else {
      $apiProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:api') -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden
      $webProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:web') -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden
    }

    $apiReady = Wait-HttpOk -url ("http://127.0.0.1:{0}/api/v1/health" -f $apiPort) -timeoutMs $startupTimeoutMs
    $webReady = Wait-HttpOk -url ("http://127.0.0.1:{0}/" -f $webPort) -timeoutMs $startupTimeoutMs

    if ($apiReady -and $webReady) {
      $runningState = @{
        launcher = 'running'
        api = 'running'
        web = 'running'
        apiPid = $apiProcess.Id
        webPid = $webProcess.Id
        mode = $(if ($isTestMode) { 'test' } else { 'normal' })
        startedAt = (Get-Date).ToString('o')
      }
      Save-State $runningState
      return @{
        exitCode = 0
        status = $runningState
      }
    }

    if ($null -ne $apiProcess) { Stop-ManagedProcess -pidValue $apiProcess.Id }
    if ($null -ne $webProcess) { Stop-ManagedProcess -pidValue $webProcess.Id }
    $failedState = @{
      launcher = 'failed'
      api = $(if ($apiReady) { 'running' } else { 'failed' })
      web = $(if ($webReady) { 'running' } else { 'failed' })
      reason = 'startup_timeout'
      mode = $(if ($isTestMode) { 'test' } else { 'normal' })
    }
    Save-State $failedState
    return @{
      exitCode = 1
      status = $failedState
    }
  } catch {
    if ($null -ne $apiProcess) { Stop-ManagedProcess -pidValue $apiProcess.Id }
    if ($null -ne $webProcess) { Stop-ManagedProcess -pidValue $webProcess.Id }
    $errorState = @{
      launcher = 'failed'
      api = 'failed'
      web = 'failed'
      reason = 'startup_exception'
      mode = $(if ($isTestMode) { 'test' } else { 'normal' })
    }
    Save-State $errorState
    return @{
      exitCode = 1
      status = $errorState
    }
  }
}

function Stop-LauncherStack {
  $state = Get-State
  $apiPid = [int](Get-HashValue -source $state -key 'apiPid' -defaultValue 0)
  $webPid = [int](Get-HashValue -source $state -key 'webPid' -defaultValue 0)
  Stop-ManagedProcess -pidValue $apiPid
  Stop-ManagedProcess -pidValue $webPid
  $stopped = New-StoppedState
  Save-State $stopped
  return @{
    exitCode = 0
    status = $stopped
  }
}

function Restart-LauncherStack {
  $stopResult = Stop-LauncherStack
  if ($stopResult.exitCode -ne 0) {
    return $stopResult
  }
  return Start-LauncherStack
}

$result = $null
switch ($Command) {
  'status' { $result = @{ exitCode = 0; status = Get-EffectiveStatus } }
  'start' { $result = Start-LauncherStack }
  'stop' { $result = Stop-LauncherStack }
  'restart' { $result = Restart-LauncherStack }
}

if ($result.ContainsKey('message') -and -not [string]::IsNullOrWhiteSpace([string]$result.message)) {
  Write-Output ([string]$result.message)
}
Write-Status -status $result.status
exit ([int]$result.exitCode)
