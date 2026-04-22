$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$launcherPath = Join-Path $PSScriptRoot 'launcher.ps1'
$statePath = Join-Path $repoRoot 'data\runtime\launcher-state.json'

$env:LAUNCHER_TEST_MODE = '1'
$basePort = Get-Random -Minimum 24000 -Maximum 34000
$env:LAUNCHER_API_PORT = [string]$basePort
$env:LAUNCHER_WEB_PORT = [string]($basePort + 1)
$env:LAUNCHER_START_TIMEOUT_MS = '15000'

function Parse-Status([string]$output) {
  $result = @{}
  $lines = $output -split "(`r`n|`n)"
  foreach ($line in $lines) {
    if (-not $line.Contains(':')) {
      continue
    }
    $index = $line.IndexOf(':')
    $key = $line.Substring(0, $index).Trim()
    $value = $line.Substring($index + 1).Trim()
    if ($key.Length -gt 0) {
      $result[$key] = $value
    }
  }
  return $result
}

function Assert-Equal($actual, $expected, [string]$message) {
  if ($actual -ne $expected) {
    throw "$message`nExpected: $expected`nActual: $actual"
  }
}

function Assert-Match([string]$text, [string]$pattern, [string]$message) {
  if ($text -notmatch $pattern) {
    throw "$message`nPattern: $pattern`nText: $text"
  }
}

function Run-Launcher([string[]]$commandArgs) {
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $launcherPath @commandArgs 2>&1 | Out-String
  return @{
    exitCode = $LASTEXITCODE
    output = $output
  }
}

function Reset-LauncherState {
  $null = Run-Launcher @('stop')
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
}

try {
  Reset-LauncherState

  $usageResult = Run-Launcher @()
  Assert-Equal $usageResult.exitCode 1 'launcher without command should return exit code 1.'
  Assert-Match $usageResult.output 'start\|stop\|restart\|status' 'launcher usage text should list supported commands.'

  Reset-LauncherState
  $statusStopped = Run-Launcher @('status')
  Assert-Equal $statusStopped.exitCode 0 ("status should succeed when stopped.`nOutput:`n" + $statusStopped.output)
  $statusMap = Parse-Status $statusStopped.output
  Assert-Equal $statusMap['launcher'] 'stopped' 'status should report launcher=stopped with no state.'
  Assert-Equal $statusMap['api'] 'stopped' 'status should report api=stopped with no state.'
  Assert-Equal $statusMap['web'] 'stopped' 'status should report web=stopped with no state.'

  Reset-LauncherState
  $startResult = Run-Launcher @('start')
  Assert-Equal $startResult.exitCode 0 ("start should succeed.`nOutput:`n" + $startResult.output)
  $statusRunning = Run-Launcher @('status')
  $runningMap = Parse-Status $statusRunning.output
  Assert-Equal $runningMap['launcher'] 'running' 'status after start should report launcher=running.'
  Assert-Equal $runningMap['api'] 'running' 'status after start should report api=running.'
  Assert-Equal $runningMap['web'] 'running' 'status after start should report web=running.'

  $secondStart = Run-Launcher @('start')
  Assert-Equal $secondStart.exitCode 0 'second start should be accepted.'
  Assert-Match $secondStart.output 'already running|start skipped' 'second start should not spawn duplicate stack.'

  $restartResult = Run-Launcher @('restart')
  Assert-Equal $restartResult.exitCode 0 'restart should succeed.'
  $statusAfterRestart = Run-Launcher @('status')
  $restartMap = Parse-Status $statusAfterRestart.output
  Assert-Equal $restartMap['launcher'] 'running' 'status after restart should report launcher=running.'
  Assert-Equal $restartMap['api'] 'running' 'status after restart should report api=running.'
  Assert-Equal $restartMap['web'] 'running' 'status after restart should report web=running.'

  $firstStop = Run-Launcher @('stop')
  $secondStop = Run-Launcher @('stop')
  Assert-Equal $firstStop.exitCode 0 'first stop should succeed.'
  Assert-Equal $secondStop.exitCode 0 'second stop should be idempotent.'
  $statusStoppedAgain = Run-Launcher @('status')
  $stoppedMap = Parse-Status $statusStoppedAgain.output
  Assert-Equal $stoppedMap['launcher'] 'stopped' 'status after stop should report launcher=stopped.'
  Assert-Equal $stoppedMap['api'] 'stopped' 'status after stop should report api=stopped.'
  Assert-Equal $stoppedMap['web'] 'stopped' 'status after stop should report web=stopped.'

  Write-Output 'launcher tests: pass'
  exit 0
}
catch {
  Write-Error $_
  exit 1
}
finally {
  Reset-LauncherState
}
