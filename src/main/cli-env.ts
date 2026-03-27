import { execSync } from 'child_process'

let cachedPath: string | null = null

export function clearCliPathCache(): void {
  cachedPath = null
}

function appendPathEntries(target: string[], seen: Set<string>, rawPath: string | undefined, forceSep?: string): void {
  if (!rawPath) return
  const sep = forceSep || (process.platform === 'win32' ? ';' : ':')
  for (const entry of rawPath.split(sep)) {
    const p = entry.trim()
    if (!p || seen.has(p)) continue
    seen.add(p)
    target.push(p)
  }
}

export function getCliPath(): string {
  if (cachedPath) return cachedPath

  const ordered: string[] = []
  const seen = new Set<string>()

  // Start from current process PATH.
  appendPathEntries(ordered, seen, process.env.PATH)

  // Add common binary locations used on macOS (Homebrew + system).
  if (process.platform === 'darwin') {
    appendPathEntries(ordered, seen, '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', ':')
  }

  // Context-aware shell probing
  const pathCommands = process.platform === 'win32'
    ? [] // Windows handles PATH differently, process.env.PATH is usually sufficient
    : [
        '/bin/zsh -ilc "echo $PATH"',
        '/bin/zsh -lc "echo $PATH"',
        '/bin/bash -lc "echo $PATH"',
      ]

  for (const cmd of pathCommands) {
    try {
      const discovered = execSync(cmd, { encoding: 'utf-8', timeout: 3000 }).trim()
      appendPathEntries(ordered, seen, discovered)
    } catch {
      // Keep trying fallbacks.
    }
  }

  const sep = process.platform === 'win32' ? ';' : ':'
  cachedPath = ordered.join(sep)
  return cachedPath
}

export function findClaudeBinary(): string {
  const { existsSync } = require('fs')
  const { join } = require('path')
  const { homedir } = require('os')

  const candidates = process.platform === 'win32'
    ? [
        join(homedir(), 'AppData/Roaming/npm/claude.cmd'),
        join(process.env.PROGRAMFILES || 'C:/Program Files', 'nodejs/claude.cmd'),
      ]
    : [
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        join(homedir(), '.npm-global/bin/claude'),
      ]

  for (const c of candidates) {
    if (existsSync(c)) return c
  }

  try {
    const { execSync } = require('child_process')
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude'
    const result = execSync(cmd, { encoding: 'utf-8', env: getCliEnv() }).trim()
    if (result) return result.split(/\r?\n/)[0].trim()
  } catch {}

  return 'claude'
}

export function getCliEnv(extraEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...extraEnv,
    PATH: getCliPath(),
  }
  delete env.CLAUDECODE
  return env
}

