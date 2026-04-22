param(
  [string]$ShortcutPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$launcherPath = Join-Path $repoRoot 'scripts\launcher.ps1'
$powerShellPath = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'

if (-not (Test-Path $launcherPath)) {
  throw "Launcher script not found: $launcherPath"
}

if ([string]::IsNullOrWhiteSpace($ShortcutPath)) {
  $desktopDir = [Environment]::GetFolderPath('Desktop')
  $ShortcutPath = Join-Path $desktopDir 'My Web Bookmarks.lnk'
}

$shortcutDir = Split-Path -Parent $ShortcutPath
if (-not [string]::IsNullOrWhiteSpace($shortcutDir)) {
  New-Item -ItemType Directory -Path $shortcutDir -Force | Out-Null
}

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = $powerShellPath
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`" start"
$shortcut.WorkingDirectory = [string]$repoRoot
$shortcut.Description = 'Start My Web Bookmarks locally'
$shortcut.IconLocation = "$powerShellPath,0"
$shortcut.Save()

Write-Output "Shortcut created: $ShortcutPath"

