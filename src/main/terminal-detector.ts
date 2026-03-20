import { existsSync, statSync } from 'fs'
import type { DetectedTerminal, TerminalLaunchMethod } from '../shared/types'

export type { DetectedTerminal }

export type KnownTerminalName = 'Terminal' | 'iTerm2' | 'Ghostty' | 'Warp'

const KNOWN_TERMINALS: Array<{
  name: KnownTerminalName
  displayName: string
  appPath: string
  method: TerminalLaunchMethod
}> = [
  {
    name: 'Terminal',
    displayName: 'macOS Terminal',
    appPath: '/Applications/Utilities/Terminal.app',
    method: 'applescript',
  },
  {
    name: 'iTerm2',
    displayName: 'iTerm 2',
    appPath: '/Applications/iTerm.app',
    method: 'applescript',
  },
  {
    name: 'Ghostty',
    displayName: 'Ghostty',
    appPath: '/Applications/Ghostty.app',
    method: 'cli',
  },
  {
    name: 'Warp',
    displayName: 'Warp',
    appPath: '/Applications/Warp.app',
    method: 'cli',
  },
]

export function detectTerminals(): DetectedTerminal[] {
  return KNOWN_TERMINALS
    .filter((t) => existsSync(t.appPath))
    .map((t) => ({ name: t.name, displayName: t.displayName, path: t.appPath, method: t.method }))
}

export function isValidExecutable(filePath: string): boolean {
  try {
    const stat = statSync(filePath)
    return filePath.endsWith('.app') || (stat.isFile() && (stat.mode & 0o111) !== 0)
  } catch {
    return false
  }
}
