import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'

let cachedPath: string | null = null

/**
 * Strip terminal escape sequences (ANSI CSI, OSC, etc.) that interactive shells
 * may emit via shell integrations (e.g. iTerm2, VS Code terminal).
 *
 * NOTE: similar to stripAnsi in pty-run-manager.ts but with additional
 * patterns for bare OSC sequences common in captured shell output.
 */
function stripShellEscapes(str: string): string {
  return str
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')   // CSI sequences
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '') // OSC sequences (BEL or ST terminated)
    .replace(/\x1b[()][0-9A-Za-z]/g, '')           // character set selection
    .replace(/\x1b[#=>\[\]]/g, '')                  // misc escapes
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '') // control chars except \n \r \t
    .replace(/\][0-9]+;[^\x07\n]*(?:\x07)?/g, '')  // bare OSC without leading ESC (common in captured output)
}

/** Strip shell escape sequences and return the first absolute path found, or null. */
export function extractAbsoluteShellPath(str: string): string | null {
  const cleaned = stripShellEscapes(str).trim()
  if (!cleaned) return null

  for (const line of cleaned.split(/\r?\n/)) {
    const candidate = line.trim()
    if (candidate.startsWith('/')) return candidate
  }

  return null
}

function appendPathEntries(target: string[], seen: Set<string>, rawPath: string | undefined): void {
  if (!rawPath) return
  for (const entry of rawPath.split(':')) {
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

  // Add common binary locations used on macOS (Homebrew + system + user-local).
  appendPathEntries(ordered, seen, [
    join(homedir(), '.local/bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ].join(':'))

  // Try login shell (non-interactive) so nvm/asdf/etc. PATH hooks are loaded
  // without triggering shell integration escape sequences.
  const pathCommands = [
    '/bin/zsh -lc "echo $PATH"',
    '/bin/bash -lc "echo $PATH"',
  ]

  for (const cmd of pathCommands) {
    try {
      const raw = execSync(cmd, { encoding: 'utf-8', timeout: 3000 })
      const discovered = stripShellEscapes(raw).trim()
      appendPathEntries(ordered, seen, discovered)
    } catch {
      // Keep trying fallbacks.
    }
  }

  cachedPath = ordered.join(':')
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
