#!/usr/bin/env node
// Cross-platform postinstall.
// - macOS: rebuild native modules against Electron's ABI + patch the dev icon.
// - Windows: skip the native rebuild. The only native dependency is node-pty,
//   which the Windows v1 build does not use (control-plane spawns Claude via
//   child_process, not a PTY). Skipping avoids requiring VS Build Tools.
// - Linux/other: rebuild native modules.
import { execSync } from 'node:child_process'

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

try {
  if (process.platform === 'darwin') {
    run('electron-builder install-app-deps')
    run('bash scripts/patch-dev-icon.sh')
  } else if (process.platform === 'win32') {
    console.log('[postinstall] Windows detected — skipping native rebuild (node-pty is unused in the Windows v1 build).')
  } else {
    run('electron-builder install-app-deps')
  }
} catch (err) {
  // Native rebuild is best-effort; the app still runs without it on v1.
  console.warn('[postinstall] non-fatal:', err && err.message ? err.message : err)
}
