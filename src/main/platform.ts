/**
 * Cross-platform utilities for binary detection, PATH management,
 * and login shell PATH resolution.
 *
 * Replaces the duplicated Unix-only logic previously in:
 *  - process-manager.ts
 *  - run-manager.ts
 *  - pty-run-manager.ts
 *
 * All functions read process.platform at call time (not module load time)
 * so that tests can mock the platform per-test.
 */

import { execSync } from 'child_process'
import { existsSync, accessSync, constants } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'

function isWin(): boolean {
  return process.platform === 'win32'
}

function pathSep(): string {
  return isWin() ? ';' : ':'
}

/**
 * Find a binary by name using platform-appropriate lookup.
 *
 * - Windows: `where <name>` (returns first match)
 * - POSIX: tries `/bin/zsh -lc "whence -p <name>"`, then `/bin/bash -lc "which <name>"`
 *
 * Returns the full path or the bare name as fallback.
 */
export function findBinary(name: string): string {
  if (isWin()) {
    try {
      const result = execSync(`where ${name}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] })
      // `where` can return multiple lines; take the first
      const firstLine = result.split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0]
      if (firstLine) return firstLine
    } catch {}
    return name
  }

  // POSIX: try login shells
  try {
    const result = execSync(`/bin/zsh -lc "whence -p ${name}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    if (result) return result
  } catch {}

  try {
    const result = execSync(`/bin/bash -lc "which ${name}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    if (result) return result
  } catch {}

  return name
}

/**
 * Get the full login shell PATH.
 *
 * On macOS/Linux, Electron doesn't source ~/.zshrc so PATH is often incomplete.
 * On Windows, the system PATH is already complete — returns empty string.
 */
export function getLoginShellPath(): string {
  if (isWin()) return ''

  try {
    return execSync('/bin/zsh -lc "echo $PATH"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
  } catch {}

  try {
    return execSync('/bin/bash -lc "echo $PATH"', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
  } catch {}

  return ''
}

/**
 * Ensure the directory containing `binaryPath` is in `env.PATH`.
 *
 * Uses `path.dirname()` (cross-platform) instead of `lastIndexOf('/')`.
 * Uses the correct PATH separator per platform (`;` on Windows, `:` on POSIX).
 */
export function ensureBinDirInPath(binaryPath: string, env: NodeJS.ProcessEnv): void {
  const binDir = dirname(binaryPath)

  // If binary is a bare name (no directory component), dirname returns '.'.
  // Don't prepend '.' to PATH.
  if (binDir === '.') return

  // On Windows, process.env may carry the path variable as 'Path' (not 'PATH').
  // Resolve the actual key to avoid creating a duplicate entry.
  const pathKey = resolvePathKey(env)

  const sep = pathSep()
  const currentPath = env[pathKey] || ''

  // Check if binDir is already in PATH
  if (currentPath) {
    const dirs = currentPath.split(sep)
    if (dirs.includes(binDir)) return
    env[pathKey] = `${binDir}${sep}${currentPath}`
  } else {
    env[pathKey] = binDir
  }
}

/**
 * Resolve the actual environment key for PATH.
 * On Windows, it can be 'Path', 'PATH', or 'path' — case varies.
 */
function resolvePathKey(env: NodeJS.ProcessEnv): string {
  if (isWin()) {
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === 'path') return key
    }
  }
  return 'PATH'
}

/**
 * Find the Claude Code CLI binary using platform-appropriate candidate
 * paths and shell lookups.
 *
 * Candidate paths differ per platform:
 * - macOS: /usr/local/bin, /opt/homebrew/bin, ~/.npm-global/bin
 * - Windows: %APPDATA%\npm, %LOCALAPPDATA%\Programs, %PROGRAMFILES%
 * - Both: ~/.npm-global/bin
 */
export function findClaudeBinary(): string {
  const home = homedir()

  const candidates: string[] = isWin()
    ? [
        join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        join(home, 'AppData', 'Roaming', 'npm', 'claude'),
        join(home, '.npm-global', 'bin', 'claude.cmd'),
        join(home, '.npm-global', 'bin', 'claude'),
      ]
    : [
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        join(home, '.npm-global/bin/claude'),
      ]

  for (const c of candidates) {
    try {
      if (existsSync(c)) {
        // On POSIX, also check execute permission
        if (!isWin()) {
          accessSync(c, constants.X_OK)
        }
        return c
      }
    } catch {}
  }

  // Fall back to PATH-based lookup
  return findBinary('claude')
}
