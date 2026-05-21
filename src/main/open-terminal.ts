import type { CliTerminalApp } from '../shared/types'

/** Escape a string for embedding inside an AppleScript double-quoted literal */
export function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Shell-safe single-quote escaping for paths/commands passed to the shell */
export function shellSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

export function buildCliCommand(projectPath: string, sessionId: string | null, claudeBin = 'claude'): string {
  const safeDir = shellSingleQuote(projectPath)
  if (sessionId) {
    return `cd ${safeDir} && ${claudeBin} --resume ${sessionId}`
  }
  return `cd ${safeDir} && ${claudeBin}`
}

export function buildOpenTerminalAppleScript(terminalApp: CliTerminalApp, cmd: string): string {
  const escaped = escapeAppleScript(cmd)
  if (terminalApp === 'iterm') {
    return `tell application "iTerm"
  activate
  set newWindow to (create window with default profile)
  tell current session of newWindow
    write text "${escaped}"
  end tell
end tell`
  }
  return `tell application "Terminal"
  activate
  do script "${escaped}"
end tell`
}
