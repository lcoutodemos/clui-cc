import { execSync } from 'child_process'
import { delimiter, join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'

const isWindows = process.platform === 'win32'

let cachedPath: string | null = null
let cachedClaude: string | null = null

function appendPathEntries(target: string[], seen: Set<string>, rawPath: string | undefined): void {
  if (!rawPath) return
  for (const entry of rawPath.split(delimiter)) {
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

  // Start from the current process PATH.
  appendPathEntries(ordered, seen, process.env.PATH)

  if (isWindows) {
    // Electron's PATH is usually complete on Windows (no login-shell sourcing),
    // but add the common locations where `claude` and npm global bins live.
    const home = homedir()
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
    const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
    appendPathEntries(ordered, seen, [
      join(home, '.local', 'bin'),
      join(appData, 'npm'),
      join(localAppData, 'Programs', 'claude'),
    ].join(delimiter))
  } else {
    // Common binary locations used on macOS/Linux (Homebrew + system).
    appendPathEntries(ordered, seen, '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin')

    // Try an interactive login shell so nvm/asdf/etc. PATH hooks are loaded.
    const pathCommands = [
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
  }

  cachedPath = ordered.join(delimiter)
  return cachedPath
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

/**
 * Locate the real `claude` binary.
 *
 * Electron doesn't inherit a login shell's full PATH or aliases, so probe the
 * well-known install locations first, then fall back to the platform's PATH
 * lookup tool (`where` on Windows, `whence`/`which` via a login shell elsewhere).
 *
 * On Windows the result is typically a native `claude.exe` (directly spawnable)
 * or, for npm installs, a `claude.cmd` shim.
 */
export function findClaudeBinary(): string {
  if (cachedClaude) return cachedClaude
  cachedClaude = resolveClaudeBinary()
  return cachedClaude
}

function resolveClaudeBinary(): string {
  const home = homedir()

  if (isWindows) {
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
    const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
    const candidates = [
      join(home, '.local', 'bin', 'claude.exe'),
      join(appData, 'npm', 'claude.cmd'),
      join(appData, 'npm', 'claude.exe'),
      join(localAppData, 'Programs', 'claude', 'claude.exe'),
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    // Fallback: PATH lookup. `where` prints one match per line.
    try {
      const out = execSync('where claude', { encoding: 'utf-8', env: getCliEnv() }).trim()
      const first = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0]
      if (first) return first
    } catch {}
    return 'claude'
  }

  const candidates = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(home, '.local/bin/claude'),
    join(home, '.npm-global/bin/claude'),
  ]
  for (const c of candidates) {
    try {
      execSync(`test -x "${c}"`, { stdio: 'ignore' })
      return c
    } catch {}
  }

  try {
    const r = execSync('/bin/zsh -ilc "whence -p claude"', { encoding: 'utf-8', env: getCliEnv() }).trim()
    if (r) return r
  } catch {}

  try {
    const r = execSync('/bin/bash -lc "which claude"', { encoding: 'utf-8', env: getCliEnv() }).trim()
    if (r) return r
  } catch {}

  return 'claude'
}
