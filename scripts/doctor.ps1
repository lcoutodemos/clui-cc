# Clui CC — Windows doctor
# Quick environment check for running Clui CC on Windows.
#   powershell -ExecutionPolicy Bypass -File scripts\doctor.ps1

Write-Host '== Clui CC doctor (Windows) ==' -ForegroundColor Cyan

function Show-Tool($label, $name, $versionArgs) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($cmd) {
    $ver = ''
    try { $ver = (& $name @versionArgs 2>$null | Select-Object -First 1) } catch {}
    Write-Host ("[ ok ] {0,-8}: {1}  ({2})" -f $label, $ver, $cmd.Source) -ForegroundColor Green
  } else {
    Write-Host ("[fail] {0,-8}: not found on PATH" -f $label) -ForegroundColor Red
  }
}

Show-Tool 'node'   'node'   @('--version')
Show-Tool 'npm'    'npm'    @('--version')
Show-Tool 'claude' 'claude' @('--version')

# Auth check
$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($claude) {
  Write-Host '--- claude auth status ---' -ForegroundColor Cyan
  try { claude auth status } catch { Write-Warning 'Could not read claude auth status. Run `claude` once to sign in.' }
}

# Build output check
$root = Split-Path -Parent $PSScriptRoot
if (Test-Path (Join-Path $root 'dist\main\index.js')) {
  Write-Host '[ ok ] build : dist\main\index.js present' -ForegroundColor Green
} else {
  Write-Host '[warn] build : not built yet — run commands\setup.ps1' -ForegroundColor Yellow
}

$exe = Join-Path $root 'release\win-unpacked\Clui CC.exe'
if (Test-Path $exe) {
  Write-Host '[ ok ] package: release\win-unpacked\Clui CC.exe present' -ForegroundColor Green
} else {
  Write-Host '[warn] package: not packaged yet — run npm run dist:win' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Toggle the overlay with Ctrl+Shift+Space (or Ctrl+Shift+K).' -ForegroundColor Cyan
