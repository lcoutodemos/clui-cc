import { spawn, execSync, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { StreamParser } from '../stream-parser'
import { normalize } from './event-normalizer'
import { log as _log } from '../logger'
import { getCliEnv } from '../cli-env'
import type { ClaudeEvent, NormalizedEvent, RunOptions, EnrichedError } from '../../shared/types'

const MAX_RING_LINES = 100
const DEBUG = process.env.CLUI_DEBUG === '1'
const LAST_RUN_DIAGNOSTICS_FILE = join(homedir(), '.clui-last-run.json')

// Default to native Claude Code behavior. Set CLUI_SYSTEM_HINT to append an
// explicit, measurable wrapper hint for local experiments.
const CLUI_SYSTEM_HINT = (process.env.CLUI_SYSTEM_HINT || '').trim()

// Tools auto-approved via --allowedTools (never trigger the permission card).
// Includes routine internal agent mechanics (Agent, Task, TaskOutput, TodoWrite,
// Notebook) — prompting for these would make UX terrible without adding meaningful
// safety. This is a deliberate CLUI policy choice, not native Claude parity.
// If runtime evidence shows any of these create real user-facing approval moments,
// they should be moved to the hook matcher in permission-server.ts instead.
const SAFE_TOOLS = [
  'Read', 'Glob', 'Grep', 'LS',
  'TodoRead', 'TodoWrite',
  'Agent', 'Task', 'TaskOutput',
  'Notebook',
  'WebSearch', 'WebFetch',
]

// All tools to pre-approve when NO hook server is available (fallback path).
// Includes safe + dangerous tools so nothing is silently denied.
const DEFAULT_ALLOWED_TOOLS = [
  'Bash', 'Edit', 'Write', 'MultiEdit',
  ...SAFE_TOOLS,
]

function log(msg: string): void {
  _log('RunManager', msg)
}

export interface RunHandle {
  runId: string
  sessionId: string | null
  process: ChildProcess
  pid: number | null
  startedAt: number
  spawnedAt: number
  diagnostics: RunDiagnostics
  /** Ring buffer of last N stderr lines */
  stderrTail: string[]
  /** Ring buffer of last N stdout lines */
  stdoutTail: string[]
  /** Count of tool calls seen during this run */
  toolCallCount: number
  /** Whether any permission_request event was seen during this run */
  sawPermissionRequest: boolean
  /** Permission denials from result event */
  permissionDenials: Array<{ tool_name: string; tool_use_id: string }>
}

interface RunDiagnostics {
  schemaVersion: 1
  runId: string
  claudeBinary: string
  cwd: string
  args: string[]
  promptChars: number
  promptBytes: number
  usedResume: boolean
  model: string | null
  permissionMode: string
  effort: string | null
  addDirCount: number
  appendedSystemPromptChars: number
  appendedSystemPromptApproxTokens: number
  timings: {
    clientSentAt: number | null
    ipcReceivedAt: number | null
    runManagerStartAt: number
    spawnedAt: number | null
    stdinWrittenAt: number | null
    firstRawEventAt: number | null
    firstTextChunkAt: number | null
    resultAt: number | null
    processClosedAt: number | null
    clientToIpcMs: number | null
    ipcToSpawnMs: number | null
    spawnToFirstRawEventMs: number | null
    spawnToFirstTextChunkMs: number | null
    wallTimeMs: number | null
    claudeDurationMs: number | null
  }
  sessionId: string | null
  usage: Record<string, unknown> | null
  costUsd: number | null
  numTurns: number | null
  toolCallCount: number
  sawPermissionRequest: boolean
  permissionDenials: Array<{ tool_name: string; tool_use_id: string }>
  exitCode: number | null
  signal: NodeJS.Signals | null
  updatedAt: string
}

/**
 * RunManager: spawns one `claude -p` process per run, parses NDJSON,
 * emits normalized events, handles cancel, and keeps diagnostic ring buffers.
 *
 * Events emitted:
 *  - 'normalized' (runId, NormalizedEvent)
 *  - 'raw' (runId, ClaudeEvent)  — for logging/debugging
 *  - 'exit' (runId, code, signal, sessionId)
 *  - 'error' (runId, Error)
 */
export class RunManager extends EventEmitter {
  private activeRuns = new Map<string, RunHandle>()
  /** Holds recently-finished runs so diagnostics survive past process exit */
  private _finishedRuns = new Map<string, RunHandle>()
  private claudeBinary: string

  constructor() {
    super()
    this.claudeBinary = this._findClaudeBinary()
    log(`Claude binary: ${this.claudeBinary}`)
  }

  private _findClaudeBinary(): string {
    const candidates = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      join(homedir(), '.npm-global/bin/claude'),
    ]

    for (const c of candidates) {
      try {
        execSync(`test -x "${c}"`, { stdio: 'ignore' })
        return c
      } catch {}
    }

    try {
      return execSync('/bin/zsh -ilc "whence -p claude"', { encoding: 'utf-8', env: getCliEnv() }).trim()
    } catch {}

    try {
      return execSync('/bin/bash -lc "which claude"', { encoding: 'utf-8', env: getCliEnv() }).trim()
    } catch {}

    return 'claude'
  }

  private _getEnv(): NodeJS.ProcessEnv {
    const env = getCliEnv()
    const binDir = this.claudeBinary.substring(0, this.claudeBinary.lastIndexOf('/'))
    if (env.PATH && !env.PATH.includes(binDir)) {
      env.PATH = `${binDir}:${env.PATH}`
    }

    return env
  }

  startRun(requestId: string, options: RunOptions): RunHandle {
    const cwd = options.projectPath === '~' ? homedir() : options.projectPath

    const args: string[] = [
      '-p',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode', options.permissionMode || 'default',
    ]

    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    }
    if (options.model) {
      args.push('--model', options.model)
    }
    if (options.effort) {
      args.push('--effort', options.effort)
    }
    if (options.addDirs && options.addDirs.length > 0) {
      for (const dir of options.addDirs) {
        args.push('--add-dir', dir)
      }
    }

    if (options.hookSettingsPath) {
      // CLUI-scoped hook settings: the PreToolUse HTTP hook handles permissions
      // for dangerous tools (Bash, Edit, Write, MultiEdit).
      // Auto-approve safe tools so they don't trigger the permission card.
      args.push('--settings', options.hookSettingsPath)
      const safeAllowed = [
        ...SAFE_TOOLS,
        ...(options.allowedTools || []),
      ]
      args.push('--allowedTools', safeAllowed.join(','))
    } else {
      // Fallback: no hook server available.
      // Pre-approve common tools so they run without being silently denied.
      const allAllowed = [
        ...DEFAULT_ALLOWED_TOOLS,
        ...(options.allowedTools || []),
      ]
      args.push('--allowedTools', allAllowed.join(','))
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
    if (CLUI_SYSTEM_HINT) {
      args.push('--append-system-prompt', CLUI_SYSTEM_HINT)
    }

    if (DEBUG) {
      log(`Starting run ${requestId}: ${this.claudeBinary} ${args.join(' ')}`)
      log(`Prompt: ${options.prompt.substring(0, 200)}`)
    } else {
      log(`Starting run ${requestId}`)
    }

    const runManagerStartAt = Date.now()
    const child = spawn(this.claudeBinary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
      env: this._getEnv(),
    })

    const spawnedAt = Date.now()
    log(`Spawned PID: ${child.pid}`)

    const handle: RunHandle = {
      runId: requestId,
      sessionId: options.sessionId || null,
      process: child,
      pid: child.pid || null,
      startedAt: runManagerStartAt,
      spawnedAt,
      diagnostics: {
        schemaVersion: 1,
        runId: requestId,
        claudeBinary: this.claudeBinary,
        cwd,
        args: this._redactArgs(args),
        promptChars: options.prompt.length,
        promptBytes: Buffer.byteLength(options.prompt, 'utf-8'),
        usedResume: !!options.sessionId,
        model: options.model || null,
        permissionMode: options.permissionMode || 'default',
        effort: options.effort || null,
        addDirCount: options.addDirs?.length || 0,
        appendedSystemPromptChars: CLUI_SYSTEM_HINT.length,
        appendedSystemPromptApproxTokens: this._approxTokens(CLUI_SYSTEM_HINT),
        timings: {
          clientSentAt: options.clientSentAt || null,
          ipcReceivedAt: options.ipcReceivedAt || null,
          runManagerStartAt,
          spawnedAt,
          stdinWrittenAt: null,
          firstRawEventAt: null,
          firstTextChunkAt: null,
          resultAt: null,
          processClosedAt: null,
          clientToIpcMs: this._delta(options.clientSentAt, options.ipcReceivedAt),
          ipcToSpawnMs: this._delta(options.ipcReceivedAt, spawnedAt),
          spawnToFirstRawEventMs: null,
          spawnToFirstTextChunkMs: null,
          wallTimeMs: null,
          claudeDurationMs: null,
        },
        sessionId: options.sessionId || null,
        usage: null,
        costUsd: null,
        numTurns: null,
        toolCallCount: 0,
        sawPermissionRequest: false,
        permissionDenials: [],
        exitCode: null,
        signal: null,
        updatedAt: new Date().toISOString(),
      },
      stderrTail: [],
      stdoutTail: [],
      toolCallCount: 0,
      sawPermissionRequest: false,
      permissionDenials: [],
    }

    // ─── stdout → NDJSON parser → normalizer → events ───
    const parser = StreamParser.fromStream(child.stdout!)

    parser.on('event', (raw: ClaudeEvent) => {
      // Track session ID
      if (raw.type === 'system' && 'subtype' in raw && raw.subtype === 'init') {
        handle.sessionId = (raw as any).session_id
        handle.diagnostics.sessionId = handle.sessionId
      }
      if (!handle.diagnostics.timings.firstRawEventAt) {
        handle.diagnostics.timings.firstRawEventAt = Date.now()
        handle.diagnostics.timings.spawnToFirstRawEventMs = this._delta(handle.spawnedAt, handle.diagnostics.timings.firstRawEventAt)
      }

      // Track permission_request events
      if (raw.type === 'permission_request' || (raw.type === 'system' && 'subtype' in raw && (raw as any).subtype === 'permission_request')) {
        handle.sawPermissionRequest = true
        handle.diagnostics.sawPermissionRequest = true
        log(`Permission request seen [${requestId}]`)
      }

      // Extract permission_denials from result event
      if (raw.type === 'result') {
        const denials = (raw as any).permission_denials
        if (Array.isArray(denials) && denials.length > 0) {
          handle.permissionDenials = denials.map((d: any) => ({
            tool_name: d.tool_name || '',
            tool_use_id: d.tool_use_id || '',
          }))
          handle.diagnostics.permissionDenials = handle.permissionDenials
          log(`Permission denials [${requestId}]: ${JSON.stringify(handle.permissionDenials)}`)
        }
        handle.diagnostics.timings.resultAt = Date.now()
        handle.diagnostics.timings.wallTimeMs = this._delta(handle.startedAt, handle.diagnostics.timings.resultAt)
        handle.diagnostics.timings.claudeDurationMs = (raw as any).duration_ms || null
        handle.diagnostics.usage = (raw as any).usage || null
        handle.diagnostics.costUsd = (raw as any).total_cost_usd ?? null
        handle.diagnostics.numTurns = (raw as any).num_turns ?? null
      }

      // Ring buffer stdout lines (raw JSON for diagnostics)
      this._ringPush(handle.stdoutTail, JSON.stringify(raw).substring(0, 300))

      // Emit raw event for debugging
      this.emit('raw', requestId, raw)

      // Normalize and emit canonical events
      const normalized = normalize(raw)
      for (const evt of normalized) {
        if (evt.type === 'tool_call') handle.toolCallCount++
        if (evt.type === 'text_chunk' && !handle.diagnostics.timings.firstTextChunkAt) {
          handle.diagnostics.timings.firstTextChunkAt = Date.now()
          handle.diagnostics.timings.spawnToFirstTextChunkMs = this._delta(handle.spawnedAt, handle.diagnostics.timings.firstTextChunkAt)
        }
        this.emit('normalized', requestId, evt)
      }
      handle.diagnostics.toolCallCount = handle.toolCallCount
      this._writeDiagnostics(handle)

      // Close stdin after result event — with stream-json input the process
      // stays alive waiting for more input; closing stdin triggers clean exit.
      if (raw.type === 'result') {
        log(`Run complete [${requestId}]: sawPermissionRequest=${handle.sawPermissionRequest}, denials=${handle.permissionDenials.length}`)
        try { child.stdin?.end() } catch {}
      }
    })

    parser.on('parse-error', (line: string) => {
      log(`Parse error [${requestId}]: ${line.substring(0, 200)}`)
      this._ringPush(handle.stderrTail, `[parse-error] ${line.substring(0, 200)}`)
    })

    // ─── stderr ring buffer ───
    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (data: string) => {
      const lines = data.split('\n').filter((l: string) => l.trim())
      for (const line of lines) {
        this._ringPush(handle.stderrTail, line)
      }
      log(`Stderr [${requestId}]: ${data.trim().substring(0, 500)}`)
    })

    // ─── Process lifecycle ───
    // Snapshot diagnostics BEFORE deleting the handle so callers can still read them.
    child.on('close', (code, signal) => {
      log(`Process closed [${requestId}]: code=${code} signal=${signal}`)
      handle.diagnostics.exitCode = code
      handle.diagnostics.signal = signal
      handle.diagnostics.timings.processClosedAt = Date.now()
      handle.diagnostics.timings.wallTimeMs = this._delta(handle.startedAt, handle.diagnostics.timings.processClosedAt)
      this._writeDiagnostics(handle)
      // Move handle to finished map so getEnrichedError still works after exit
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('exit', requestId, code, signal, handle.sessionId)
      // Clean up finished run after a short delay (gives callers time to read diagnostics)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    child.on('error', (err) => {
      log(`Process error [${requestId}]: ${err.message}`)
      handle.diagnostics.timings.processClosedAt = Date.now()
      handle.diagnostics.timings.wallTimeMs = this._delta(handle.startedAt, handle.diagnostics.timings.processClosedAt)
      this._writeDiagnostics(handle)
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('error', requestId, err)
      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    // ─── Write prompt to stdin (stream-json format, keep open) ───
    // Using --input-format stream-json for bidirectional communication.
    // Stdin stays open so follow-up messages can be sent.
    const userMessage = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: options.prompt }],
      },
    })
    child.stdin!.write(userMessage + '\n')
    handle.diagnostics.timings.stdinWrittenAt = Date.now()
    this._writeDiagnostics(handle)

    this.activeRuns.set(requestId, handle)
    return handle
  }

  /**
   * Write a message to a running process's stdin (for follow-up prompts, etc.)
   */
  writeToStdin(requestId: string, message: object): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false
    if (!handle.process.stdin || handle.process.stdin.destroyed) return false

    const json = JSON.stringify(message)
    log(`Writing to stdin [${requestId}]: ${json.substring(0, 200)}`)
    handle.process.stdin.write(json + '\n')
    return true
  }

  /**
   * Cancel a running process: SIGINT, then SIGKILL after 5s.
   */
  cancel(requestId: string): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false

    log(`Cancelling run ${requestId}`)
    handle.process.kill('SIGINT')

    // Fallback: SIGKILL if process hasn't exited after 5s.
    // Only check exitCode — process.killed is set true by the SIGINT call above,
    // so checking !killed would prevent the fallback from ever firing.
    setTimeout(() => {
      if (handle.process.exitCode === null) {
        log(`Force killing run ${requestId} (SIGINT did not terminate)`)
        handle.process.kill('SIGKILL')
      }
    }, 5000)

    return true
  }

  /**
   * Get an enriched error object for a failed run.
   */
  getEnrichedError(requestId: string, exitCode: number | null): EnrichedError {
    const handle = this.activeRuns.get(requestId) || this._finishedRuns.get(requestId)
    return {
      message: `Run failed with exit code ${exitCode}`,
      stderrTail: handle?.stderrTail.slice(-20) || [],
      stdoutTail: handle?.stdoutTail.slice(-20) || [],
      exitCode,
      elapsedMs: handle ? Date.now() - handle.startedAt : 0,
      toolCallCount: handle?.toolCallCount || 0,
      sawPermissionRequest: handle?.sawPermissionRequest || false,
      permissionDenials: handle?.permissionDenials || [],
    }
  }

  isRunning(requestId: string): boolean {
    return this.activeRuns.has(requestId)
  }

  getHandle(requestId: string): RunHandle | undefined {
    return this.activeRuns.get(requestId)
  }

  getActiveRunIds(): string[] {
    return Array.from(this.activeRuns.keys())
  }

  private _delta(start?: number | null, end?: number | null): number | null {
    if (!start || !end) return null
    return end - start
  }

  private _approxTokens(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length / 4)
  }

  private _redactArgs(args: string[]): string[] {
    const redactValueAfter = new Set(['--settings'])
    const redacted: string[] = []
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      redacted.push(arg)
      if (redactValueAfter.has(arg) && i + 1 < args.length) {
        redacted.push('[redacted-path]')
        i++
      }
    }
    return redacted
  }

  private _writeDiagnostics(handle: RunHandle): void {
    try {
      handle.diagnostics.updatedAt = new Date().toISOString()
      writeFileSync(LAST_RUN_DIAGNOSTICS_FILE, JSON.stringify(handle.diagnostics, null, 2))
    } catch (err) {
      if (DEBUG) log(`Failed to write diagnostics: ${(err as Error).message}`)
    }
  }

  private _ringPush(buffer: string[], line: string): void {
    buffer.push(line)
    if (buffer.length > MAX_RING_LINES) {
      buffer.shift()
    }
  }
}
