/**
 * TerminalManager — PTY-backed shell session lifecycle.
 *
 * Spawns interactive shell sessions via node-pty, manages write/resize/close,
 * and broadcasts output to the renderer via IPC. Output is buffered at 4ms
 * intervals to cap IPC throughput at ~250 sends/sec.
 *
 * node-pty is required for real terminal emulation (cursor, signals, vim, etc).
 * Graceful degradation: isAvailable() returns false if node-pty is not installed.
 */

import { randomUUID } from 'crypto'
import { homedir } from 'os'
import { log as _log } from '../logger'

function log(msg: string): void {
  _log('terminal', msg)
}

const MAX_TERMINAL_TABS = 8
const FLUSH_INTERVAL_MS = 4

interface TerminalSession {
  pty: any // IPty from node-pty (typed as any to avoid import when unavailable)
  shell: string
  cwd: string
  buffer: string
  flushTimer: ReturnType<typeof setTimeout> | null
  disposable: { dispose: () => void } | null
}

export class TerminalManager {
  private sessions = new Map<string, TerminalSession>()
  private broadcast: (channel: string, ...args: unknown[]) => void
  private ptyModule: any = null

  constructor(broadcast: (channel: string, ...args: unknown[]) => void) {
    this.broadcast = broadcast
    try {
      this.ptyModule = require('node-pty')
    } catch {
      log('node-pty not available — terminal feature disabled')
    }
  }

  isAvailable(): boolean {
    return this.ptyModule !== null
  }

  create(options: { shell?: string; cwd?: string; cols?: number; rows?: number } = {}): string {
    if (!this.ptyModule) {
      throw new Error('node-pty is not available. Terminal feature requires node-pty.')
    }

    if (this.sessions.size >= MAX_TERMINAL_TABS) {
      throw new Error(`Maximum ${MAX_TERMINAL_TABS} terminal tabs reached.`)
    }

    const termTabId = randomUUID()
    const shell = options.shell || this.getDefaultShell()
    const cwd = options.cwd || homedir()
    const cols = options.cols || 80
    const rows = options.rows || 24

    // Strip sensitive env vars
    const env = { ...process.env }
    delete env.CLAUDECODE
    delete env.ANTHROPIC_API_KEY

    log(`Creating terminal: shell=${shell} cwd=${cwd} cols=${cols} rows=${rows}`)

    let pty: any
    try {
      pty = this.ptyModule.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`PTY spawn failed: ${msg}`)
      throw new Error(`Failed to spawn shell "${shell}": ${msg}`)
    }

    const session: TerminalSession = {
      pty,
      shell,
      cwd,
      buffer: '',
      flushTimer: null,
      disposable: null,
    }

    // Output handler with 4ms buffering
    const disposable = pty.onData((data: string) => {
      session.buffer += data
      if (!session.flushTimer) {
        session.flushTimer = setTimeout(() => {
          if (session.buffer) {
            this.broadcast('clui:terminal-data', termTabId, session.buffer)
            session.buffer = ''
          }
          session.flushTimer = null
        }, FLUSH_INTERVAL_MS)
      }
    })
    session.disposable = disposable

    // Exit handler
    pty.onExit(({ exitCode }: { exitCode: number }) => {
      log(`Terminal exited: ${termTabId} code=${exitCode}`)
      this.broadcast('clui:terminal-exit', termTabId, exitCode)
      this.cleanup(termTabId)
    })

    this.sessions.set(termTabId, session)
    log(`Terminal created: ${termTabId} pid=${pty.pid}`)

    return termTabId
  }

  write(termTabId: string, data: string): void {
    const session = this.sessions.get(termTabId)
    if (session) {
      session.pty.write(data)
    }
  }

  resize(termTabId: string, cols: number, rows: number): void {
    const session = this.sessions.get(termTabId)
    if (session) {
      try {
        session.pty.resize(cols, rows)
      } catch {
        // Resize can fail if process already exited
      }
    }
  }

  close(termTabId: string): void {
    const session = this.sessions.get(termTabId)
    if (session) {
      log(`Closing terminal: ${termTabId}`)
      try {
        session.pty.kill()
      } catch {
        // May already be dead
      }
      this.cleanup(termTabId)
    }
  }

  shutdown(): void {
    log(`Shutting down ${this.sessions.size} terminal sessions`)
    for (const [id] of this.sessions) {
      this.close(id)
    }
  }

  private cleanup(termTabId: string): void {
    const session = this.sessions.get(termTabId)
    if (session) {
      if (session.flushTimer) clearTimeout(session.flushTimer)
      if (session.disposable) session.disposable.dispose()
      this.sessions.delete(termTabId)
    }
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      // Prefer PowerShell if available
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }
}
