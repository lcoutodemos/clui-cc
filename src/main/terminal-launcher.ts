import { execFile } from 'child_process'
import type { DetectedTerminal } from './terminal-detector'

export interface LaunchOptions {
  terminal: DetectedTerminal
  projectPath: string
  sessionId?: string | null
}

function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Wrap a string in single quotes safe for bash -c, escaping any internal single quotes. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

function launchViaAppleScript(
  terminal: DetectedTerminal,
  projectPath: string,
  sessionId: string | null,
  claudeBin: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Escape for AppleScript string context (outer quotes are AppleScript's)
    // then escape the inner shell double-quotes around the directory.
    const dir = escapeAppleScript(projectPath)
    // sessionId from Claude is a UUID — no shell-special chars possible
    const cmd = sessionId
      ? `cd \\"${dir}\\" && ${claudeBin} --resume ${sessionId}`
      : `cd \\"${dir}\\" && ${claudeBin}`

    const script = terminal.name === 'iTerm2'
      ? `tell application "iTerm2"
  activate
  create window with default profile
  tell current session of current window
    write text "${cmd}"
  end tell
end tell`
      : `tell application "Terminal"
  activate
  do script "${cmd}"
end tell`

    execFile('/usr/bin/osascript', ['-e', script], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function resolveGhosttyBin(terminal: DetectedTerminal): string {
  // If detected as .app bundle, use the binary inside it
  if (terminal.path.endsWith('.app')) {
    return `${terminal.path}/Contents/MacOS/ghostty`
  }
  return terminal.path
}

function launchGhostty(
  terminal: DetectedTerminal,
  projectPath: string,
  sessionId: string | null,
  claudeBin: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use shell quoting so paths with spaces or special chars are safe
    const cmd = sessionId
      ? `cd ${shellQuote(projectPath)} && ${claudeBin} --resume ${sessionId}`
      : `cd ${shellQuote(projectPath)} && ${claudeBin}`
    const bin = resolveGhosttyBin(terminal)
    // Ghostty supports -e to run a program in the new window
    execFile(bin, ['-e', 'bash', '-c', cmd], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function launchWarp(terminal: DetectedTerminal, projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Warp doesn't support running an arbitrary command on launch via CLI.
    // Open the app at the project directory; the user can run claude manually.
    execFile('/usr/bin/open', ['-a', 'Warp', projectPath], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export function launchTerminal(options: LaunchOptions, claudeBin = 'claude'): Promise<void> {
  const { terminal, projectPath, sessionId } = options
  if (terminal.method === 'applescript') {
    return launchViaAppleScript(terminal, projectPath, sessionId ?? null, claudeBin)
  }
  if (terminal.name === 'Ghostty') {
    return launchGhostty(terminal, projectPath, sessionId ?? null, claudeBin)
  }
  if (terminal.name === 'Warp') {
    return launchWarp(terminal, projectPath)
  }
  // Unknown CLI terminal: open the app bundle or binary
  return launchGhostty(terminal, projectPath, sessionId ?? null, claudeBin)
}
