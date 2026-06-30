# Clui CC — Windows setup
# Installs dependencies, builds the renderer/main/preload bundles, and packages
# an unpacked Windows app you can launch with commands\start.cmd.
#
# Run from an elevated-not-required PowerShell:
#   powershell -ExecutionPolicy Bypass -File commands\setup.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '== Clui CC Windows setup ==' -ForegroundColor Cyan

# --- Prerequisite checks ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 18+ is required. Install from https://nodejs.org and re-run.' }
Write-Host ("node     : " + (node --version))

$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) {
  Write-Warning 'The `claude` CLI was not found on PATH. Install Claude Code and run `claude` once to sign in, otherwise Clui CC cannot start sessions.'
} else {
  Write-Host ("claude   : " + (claude --version))
}

# --- Install ---
Write-Host 'Installing dependencies (npm install)...' -ForegroundColor Cyan
npm install

# --- Build ---
Write-Host 'Building bundles (npm run build)...' -ForegroundColor Cyan
npm run build

# --- Package (unpacked) ---
Write-Host 'Packaging unpacked Windows app (npm run dist:win)...' -ForegroundColor Cyan
npm run dist:win

Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host 'Launch Clui CC by double-clicking commands\start.cmd' -ForegroundColor Green
Write-Host 'Toggle the overlay anytime with Ctrl+Shift+Space (or Ctrl+Shift+K).' -ForegroundColor Green
