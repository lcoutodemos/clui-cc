import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { homedir } from 'os'
import { appendFileSync } from 'fs'
import { join } from 'path'
import { StreamParser } from './stream-parser'
import { findClaudeBinary, getClaudeLaunchPrefixArgs, getLoginShellPath, ensureBinDirInPath } from './platform'
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
  private _loginShellPath: string = ''

  constructor() {
    super()
    this.claudeBinary = findClaudeBinary()
    log(`Claude binary: ${this.claudeBinary}`)
  }

  startRun(options: RunOptions): RunHandle {
    const runId = crypto.randomUUID()
    const cwd = options.projectPath === '~' ? homedir() : options.projectPath

    const args: string[] = [
      ...getClaudeLaunchPrefixArgs(),
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
    const env = { ...process.env }
    delete env.CLAUDECODE

    if (!this._loginShellPath) {
      this._loginShellPath = getLoginShellPath()
    }
    if (this._loginShellPath) {
      env.PATH = this._loginShellPath
    }

    ensureBinDirInPath(this.claudeBinary, env)

    const child = spawn(this.claudeBinary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env,
      shell: process.platform === 'win32',
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
