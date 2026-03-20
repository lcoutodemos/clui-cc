import { execFileSync } from 'child_process'
import { accessSync, constants } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { getCliEnv } from '../cli-env'

/**
 * Locate the Claude Code CLI binary.
 *
 * Priority order:
 *  1. Native installer path (~/.local/bin/claude) — the officially recommended
 *     install method. Checked first so a stale Homebrew or npm-global binary
 *     never shadows a current native install.
 *  2. Shell-resolved path (whence / which via a login shell) — respects the
 *     user's PATH and picks up nvm, mise, asdf, etc.
 *  3. Well-known fallback locations (/usr/local/bin, /opt/homebrew/bin,
 *     ~/.npm-global/bin).
 *  4. Bare 'claude' — last resort, relies on Electron's inherited PATH.
 */
export function findClaudeBinary(): string {
  // 1. Native installer (official recommended method)
  const nativePath = join(homedir(), '.local/bin/claude')
  if (isExecutable(nativePath)) return nativePath

  // 2. Resolve via the user's login shell (picks up PATH from .zshrc/.bashrc)
  const shellResolved = resolveViaShell()
  if (shellResolved) return shellResolved

  // 3. Well-known fallback locations
  const fallbacks = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(homedir(), '.npm-global/bin/claude'),
  ]
  for (const p of fallbacks) {
    if (isExecutable(p)) return p
  }

  // 4. Bare command — let the OS resolve it
  return 'claude'
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function resolveViaShell(): string | null {
  const env = getCliEnv()

  try {
    const result = execFileSync('/bin/zsh', ['-ilc', 'whence -p claude'], {
      encoding: 'utf-8',
      env,
    }).trim()
    if (result) return result
  } catch {}

  try {
    const result = execFileSync('/bin/bash', ['-lc', 'which claude'], {
      encoding: 'utf-8',
      env,
    }).trim()
    if (result) return result
  } catch {}

  return null
}
