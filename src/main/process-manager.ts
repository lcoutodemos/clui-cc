import { spawn, execSync, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { homedir } from 'os'
import { appendFileSync } from 'fs'
import { join } from 'path'
import { StreamParser } from './stream-parser'
import { getCliEnv } from './cli-env'
import type { ClaudeEvent, RunOptions } from '../shared/types'

const LOG_FILE = join(homedir(), '.clui-debug.log')

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { appendFileSync(LOG_FILE, line) } catch {}
}

export interface RunHandle {
  runId: string
  sessionId: string | null
  process: ChildProcess
  parser: StreamParser
}

/**
 * Manages Claude Code subprocesses.
 */
export class ProcessManager extends EventEmitter {
  private activeRuns = new Map<string, RunHandle>()
  private claudeBinary: string

  constructor() {
    super()
    // Find the real claude binary — Electron doesn't inherit shell aliases or full PATH
    this.claudeBinary = this.findClaudeBinary()
    log(`Claude binary: ${this.claudeBinary}`)
  }

  private findClaudeBinary(): string {
    // Try common locations
    const candidates = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      join(homedir(), '.npm-global/bin/claude'),
      join(homedir(), '.nvm/versions/node', '**', 'bin/claude'),
    ]

    for (const c of candidates) {
      try {
        execSync(`test -x "${c}"`, { stdio: 'ignore' })
        return c
      } catch {}
    }

    // Fallback: ask a login shell
    try {
      const result = execSync('/bin/zsh -ilc "whence -p claude"', { encoding: 'utf-8', env: getCliEnv() }).trim()
      if (result) return result
    } catch {}

    try {
      const result = execSync('/bin/bash -lc "which claude"', { encoding: 'utf-8', env: getCliEnv() }).trim()
      if (result) return result
    } catch {}

    // Last resort
    return 'claude'
  }

  startRun(options: RunOptions): RunHandle {
    const runId = crypto.randomUUID()
    const cwd = options.projectPath === '~' ? homedir() : options.projectPath

    const args: string[] = [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode', 'acceptEdits',
      '--chrome',
    ]

    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    }

    if (options.allowedTools?.length) {
      args.push('--allowedTools', options.allowedTools.join(','))
    }

    if (options.maxTurns) {
      args.push('--max-turns', String(options.maxTurns))
    }

    if (options.maxBudgetUsd) {
      args.push('--max-budget-usd', String(options.maxBudgetUsd))
    }

    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt)
    }

    log(`Starting run ${runId}: ${this.claudeBinary} ${args.join(' ')}`)
    log(`Prompt: ${options.prompt.substring(0, 200)}`)

    // Build environment: merge login shell PATH with Electron's env
    // Electron doesn't source ~/.zshrc so PATH is often incomplete
    const env = getCliEnv()

    // Ensure our claude binary's directory is in PATH
    const binDir = this.claudeBinary.substring(0, this.claudeBinary.lastIndexOf('/'))
    if (env.PATH && !env.PATH.includes(binDir)) {
      env.PATH = `${binDir}:${env.PATH}`
    }

    const child = spawn(this.claudeBinary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env,
    })

    log(`Spawned PID: ${child.pid}`)

    const parser = StreamParser.fromStream(child.stdout!)

    const handle: RunHandle = {
      runId,
      sessionId: null,
      process: child,
      parser,
    }

    parser.on('event', (event: ClaudeEvent) => {
      log(`Event [${runId}]: ${event.type}`)
      if (event.type === 'system' && 'subtype' in event && event.subtype === 'init') {
        handle.sessionId = (event as any).session_id
      }
      this.emit('event', runId, event)
    })

    parser.on('parse-error', (line: string) => {
      log(`Parse error [${runId}]: ${line.substring(0, 200)}`)
      this.emit('parse-error', runId, line)
    })

    child.on('close', (code) => {
      log(`Process closed [${runId}]: code=${code}`)
      this.activeRuns.delete(runId)
      this.emit('exit', runId, code, handle.sessionId)
    })

    child.on('error', (err) => {
      log(`Process error [${runId}]: ${err.message}`)
      this.activeRuns.delete(runId)
      this.emit('error', runId, err)
    })

    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (data: string) => {
      log(`Stderr [${runId}]: ${data.trim().substring(0, 500)}`)
      this.emit('stderr', runId, data)
    })

    child.stdin!.write(options.prompt)
    child.stdin!.end()

    this.activeRuns.set(runId, handle)
    return handle
  }

  cancelRun(runId: string): boolean {
    const handle = this.activeRuns.get(runId)
    if (!handle) return false

    log(`Cancelling run ${runId}`)
    handle.process.kill('SIGINT')

    setTimeout(() => {
      if (handle.process.exitCode === null) {
        handle.process.kill('SIGTERM')
      }
    }, 5000)

    return true
  }

  isRunning(runId: string): boolean {
    return this.activeRuns.has(runId)
  }

  getActiveRunIds(): string[] {
    return Array.from(this.activeRuns.keys())
  }
}
