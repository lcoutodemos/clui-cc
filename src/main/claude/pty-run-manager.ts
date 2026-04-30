/**
 * PtyRunManager: Persistent PTY session transport for Claude Code.
 *
 * Spawns one `claude` process per tab (no -p) and keeps it alive for the
 * lifetime of the tab. Each user message is written to the running PTY
 * stdin rather than spawning a new process. This gives the full interactive
 * Claude Code experience: slash commands persist, /compact works, /vim mode
 * survives across turns, etc.
 *
 * Lifecycle:
 *   startOrSend(tabId, requestId, options) — spawns session if needed, then
 *     sends the prompt (buffered until the initial ❯ prompt appears).
 *   endSession(tabId)  — writes /exit and kills the process.
 *   cancelMessage(tabId) — sends Ctrl+C to interrupt the current message.
 *
 * Events emitted:
 *   'normalized'       (requestId, NormalizedEvent) — message-level events
 *   'message-complete' (requestId, sessionId | null) — message done, process alive
 *   'session-exit'     (tabId, exitCode, signal, sessionId | null) — process died
 *   'error'            (requestId, Error) — message-level error
 */

import { EventEmitter } from 'events'
import { homedir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { appendFileSync, chmodSync, existsSync, statSync } from 'fs'
import type { NormalizedEvent, RunOptions, EnrichedError } from '../../shared/types'
import { getCliEnv } from '../cli-env'

// node-pty is a native module — require at runtime to avoid Vite bundling issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
let pty: typeof import('node-pty')
try {
  pty = require('node-pty')
} catch (err) {
  // Will fail at startOrSend() time, not import time
}

const LOG_FILE = join(homedir(), '.clui-debug.log')
const MAX_RING_LINES = 100
const PTY_BUFFER_SIZE = 50
const PERMISSION_TIMEOUT_MS = 5 * 60 * 1000
const QUIESCENCE_MS = 2000

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] [PtyRunManager] ${msg}\n`
  try { appendFileSync(LOG_FILE, line) } catch {}
}

// ─── ANSI Stripping ───

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[()][0-9A-Za-z]/g, '')
    .replace(/\x1b[#=>\[\]]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
}

// ─── Permission Prompt Detection ───

interface ParsedPermission {
  toolName: string
  rawPrompt: string
  options: Array<{ optionId: string; label: string; terminalValue: string }>
}

function detectPermissionPrompt(lines: string[]): ParsedPermission | null {
  const joined = lines.join('\n')

  let confidence = 0
  let toolName = ''

  const toolMatch = joined.match(/(?:wants?\s+to\s+(?:use|run|execute)|Tool:\s*|tool_name:\s*)(\w+)/i)
  if (toolMatch) {
    toolName = toolMatch[1]
    confidence += 3
  }

  const permissionKeywords = [/\ballow\b/i, /\bdeny\b/i, /\breject\b/i, /\bpermission\b/i, /\bapprove\b/i]
  for (const kw of permissionKeywords) {
    if (kw.test(joined)) confidence++
  }

  const hasOptions = /(?:❯|›|>)\s*(?:Allow|Deny|Yes|No)/i.test(joined)
    || /\b(?:Allow\s+(?:once|always|for\s+(?:this\s+)?(?:project|session)))\b/i.test(joined)
  if (hasOptions) confidence += 2

  if (confidence < 4) return null

  const options: ParsedPermission['options'] = []
  const optionPatterns = [
    { pattern: /Allow\s+(?:for\s+(?:this\s+)?(?:project|session)|always)/i, label: 'Allow for this project', kind: 'allow' },
    { pattern: /Allow\s+once/i, label: 'Allow once', kind: 'allow' },
    { pattern: /\bAlways\s+allow\b/i, label: 'Always allow', kind: 'allow' },
    { pattern: /(?:^|\s)Allow(?:\s|$)/i, label: 'Allow', kind: 'allow' },
    { pattern: /\bDeny\b/i, label: 'Deny', kind: 'deny' },
    { pattern: /\bReject\b/i, label: 'Reject', kind: 'deny' },
  ]

  let optIdx = 0
  for (const op of optionPatterns) {
    if (op.pattern.test(joined)) {
      optIdx++
      options.push({ optionId: `opt-${optIdx}`, label: op.label, terminalValue: String(optIdx) })
    }
  }

  if (options.length === 0 && confidence >= 4) {
    options.push(
      { optionId: 'opt-1', label: 'Allow', terminalValue: '1' },
      { optionId: 'opt-2', label: 'Deny', terminalValue: '2' },
    )
  }

  const rawPrompt = lines.slice(-10).join('\n')
  return { toolName: toolName || 'Unknown', rawPrompt, options }
}

function extractSessionId(text: string): string | null {
  const match = text.match(/(?:session[_ ]?id|Session|Resuming session)[:\s]+([a-f0-9-]{36})/i)
  return match ? match[1] : null
}

function isInputPrompt(line: string): boolean {
  const cleaned = line.trim()
  if (cleaned === '❯' || cleaned === '>' || cleaned === '$') return true
  if (/^[❯>]\s*(?:\?\s*for\s*shortcuts)?$/.test(cleaned)) return true
  return false
}

function isUiChrome(line: string): boolean {
  const cleaned = line.trim()
  if (!cleaned) return true
  if (/^[╭│╰─┌└┃┏┗┐┘┤├┬┴┼]/.test(cleaned)) return true
  if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✢✳✶✻✽]/.test(cleaned)) return true
  if (/^\s*(?:Medium|Low|High)\s/.test(cleaned) && /model/i.test(cleaned)) return true
  if (/^[❯>$]\s*$/.test(cleaned)) return true
  if (/^\$[\d.]+\s+·/.test(cleaned)) return true
  if (/for\s*shortcuts/i.test(cleaned)) return true
  if (/zigzagging|thinking|processing|nebulizing|Boondoggling/i.test(cleaned)) return true
  if (/^esctointerrupt/i.test(cleaned)) return true
  if (/^[❯>]\s*\?\s*for\s*shortcuts/i.test(cleaned)) return true
  if (/Opus\s*[\d.]+\s*·/i.test(cleaned)) return true
  if (/Claude\s*Max/i.test(cleaned)) return true
  if (/settings?\s*issue|\/doctor/i.test(cleaned)) return true
  if (/^[─━▪\-=]{4,}/.test(cleaned)) return true
  if (/^[▗▖▘▝▀▄▌▐█░▒▓■□▪▫●○◆◇◈]+$/.test(cleaned)) return true
  return false
}

function parseToolCallLine(line: string): { toolName: string; input: string } | null {
  const match = line.match(/(?:⏳|⏳|✓|✗|⚡|🔧|Running|Executing)\s+(\w+)\s*(.*)/i)
    || line.match(/(?:Tool|Using):\s*(\w+)\s*(.*)/i)
  if (match) {
    return { toolName: match[1], input: match[2].trim() }
  }
  return null
}

// ─── Session Handle ───

export interface PtySessionHandle {
  tabId: string
  sessionId: string | null
  pty: import('node-pty').IPty
  pid: number
  startedAt: number
  // Session-level state
  sessionReady: boolean
  emittedSessionInit: boolean
  rawOutputTail: string[]
  ptyBuffer: string[]
  // Buffered first message (sent when session becomes ready)
  pendingRequestId: string | null
  pendingPrompt: string | null
  // First-launch trust dialog state
  trustPromptSeen: boolean
  trustConfirmed: boolean
  // Per-message state — reset by _resetMessageState()
  currentRequestId: string | null
  collectingResponse: boolean
  sawPromptEcho: boolean
  isSlashCommand: boolean
  slashOverlayDismissed: boolean
  toolCallCount: number
  pendingPermission: ParsedPermission | null
  permissionPhase: 'idle' | 'detecting' | 'waiting_user' | 'answered'
  permissionTimeout: ReturnType<typeof setTimeout> | null
  textAccumulator: string
  promptSnippet: string
  runCompleteEmitted: boolean
  quiescenceTimer: ReturnType<typeof setTimeout> | null
  lastOutputAt: number
  selectorOptions: string[]
  currentOptionIndex: number
}

// ─── PtyRunManager ───

export class PtyRunManager extends EventEmitter {
  private activeSessions = new Map<string, PtySessionHandle>()
  /** Maps requestId → tabId for event routing */
  private requestToTab = new Map<string, string>()
  private claudeBinary: string

  constructor() {
    super()
    this.claudeBinary = this._findClaudeBinary()
    this._ensureSpawnHelperExecutable()
    log(`Claude binary: ${this.claudeBinary}`)
  }

  private _ensureSpawnHelperExecutable(): void {
    try {
      const pkgPath = require.resolve('node-pty/package.json')
      const path = require('path') as typeof import('path')
      const helperPath = path.join(
        path.dirname(pkgPath),
        'prebuilds',
        `${process.platform}-${process.arch}`,
        'spawn-helper',
      )
      const unpackedHelperPath = helperPath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`)
      const targetPath = existsSync(unpackedHelperPath) ? unpackedHelperPath : helperPath
      if (!existsSync(targetPath)) return
      const st = statSync(targetPath)
      const isExecutable = (st.mode & 0o111) !== 0
      if (!isExecutable) {
        chmodSync(targetPath, 0o755)
        log(`Fixed spawn-helper permissions: ${targetPath}`)
      }
    } catch (err) {
      log(`spawn-helper permission check failed: ${(err as Error).message}`)
    }
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

  /**
   * Ensures a session exists for tabId and sends the prompt.
   * If the session process is not yet ready, the prompt is buffered and
   * sent automatically when the initial ❯ prompt appears.
   */
  startOrSend(tabId: string, requestId: string, options: RunOptions): { pid: number } {
    if (!pty) {
      throw new Error('node-pty is not available — cannot use PTY transport')
    }

    let handle = this.activeSessions.get(tabId)

    if (!handle) {
      handle = this._spawnSession(tabId, options)
    }

    this.requestToTab.set(requestId, tabId)

    if (!handle.sessionReady) {
      // Buffer — will be sent when _processLine sees the first ❯
      handle.pendingRequestId = requestId
      handle.pendingPrompt = options.prompt
      log(`Buffering prompt for tab ${tabId} [${requestId}] until session ready`)
    } else {
      this._startMessage(handle, requestId, options.prompt)
    }

    return { pid: handle.pid }
  }

  private _spawnSession(tabId: string, options: RunOptions): PtySessionHandle {
    const cwd = options.projectPath === '~' ? homedir() : options.projectPath

    const args: string[] = ['--permission-mode', options.permissionMode || 'default']

    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    } else if (options.newSessionId) {
      args.push('--session-id', options.newSessionId)
    }
    if (options.model) args.push('--model', options.model)
    if (options.effort) args.push('--effort', options.effort)
    if (options.addDirs?.length) {
      for (const dir of options.addDirs) args.push('--add-dir', dir)
    }
    if (options.allowedTools?.length) {
      args.push('--allowedTools', options.allowedTools.join(','))
    }
    if (options.systemPrompt) args.push('--system-prompt', options.systemPrompt)
    if (options.hookSettingsPath) args.push('--settings', options.hookSettingsPath)

    // No prompt argument — process waits at ❯ for input

    log(`Spawning persistent PTY session for tab ${tabId}: ${this.claudeBinary} ${args.join(' ')}`)

    const ptyProcess = pty.spawn(this.claudeBinary, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd,
      env: this._getEnv(),
    })

    log(`Spawned PTY PID: ${ptyProcess.pid}`)

    const handle: PtySessionHandle = {
      tabId,
      sessionId: options.sessionId || options.newSessionId || null,
      pty: ptyProcess,
      pid: ptyProcess.pid,
      startedAt: Date.now(),
      sessionReady: false,
      emittedSessionInit: false,
      rawOutputTail: [],
      ptyBuffer: [],
      pendingRequestId: null,
      pendingPrompt: null,
      trustPromptSeen: false,
      trustConfirmed: false,
      currentRequestId: null,
      collectingResponse: false,
      sawPromptEcho: false,
      isSlashCommand: false,
      slashOverlayDismissed: false,
      toolCallCount: 0,
      pendingPermission: null,
      permissionPhase: 'idle',
      permissionTimeout: null,
      textAccumulator: '',
      promptSnippet: '',
      runCompleteEmitted: false,
      quiescenceTimer: null,
      lastOutputAt: Date.now(),
      selectorOptions: [],
      currentOptionIndex: 0,
    }

    this.activeSessions.set(tabId, handle)

    // ─── PTY output parser pipeline ───
    let lineBuffer = ''

    ptyProcess.onData((data: string) => {
      this._ringPush(handle.rawOutputTail, data.substring(0, 500))
      handle.lastOutputAt = Date.now()

      if (handle.quiescenceTimer) clearTimeout(handle.quiescenceTimer)
      if (handle.currentRequestId && handle.collectingResponse) {
        handle.quiescenceTimer = setTimeout(
          () => this._checkQuiescenceCompletion(tabId, handle),
          QUIESCENCE_MS,
        )
      }

      const chars = data
      for (let ci = 0; ci < chars.length; ci++) {
        const ch = chars[ci]
        if (ch === '\n') {
          const completed = lineBuffer.endsWith('\r') ? lineBuffer.slice(0, -1) : lineBuffer
          lineBuffer = ''
          this._processLine(tabId, handle, completed)
        } else if (ch === '\r') {
          const next = ci + 1 < chars.length ? chars[ci + 1] : null
          if (next === '\n' || next === '\r') {
            lineBuffer += '\r'
          } else if (next === null) {
            lineBuffer += '\r'
          } else {
            lineBuffer = ''
          }
        } else {
          lineBuffer += ch
        }
      }

      if (lineBuffer.length > 0) {
        const cleaned = stripAnsi(lineBuffer).trim()
        if (cleaned.length > 0) {
          this._checkPermissionInBuffer(tabId, handle, cleaned)
        }
      }
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      log(`PTY exited [tab=${tabId}]: code=${exitCode} signal=${signal}`)

      if (handle.permissionTimeout) clearTimeout(handle.permissionTimeout)
      if (handle.quiescenceTimer) clearTimeout(handle.quiescenceTimer)

      this._flushText(handle)

      // If a message was in-flight, emit an error for it
      if (handle.currentRequestId && !handle.runCompleteEmitted) {
        handle.runCompleteEmitted = true
        // Emit task_complete so the inflight promise resolves (ControlPlane will handle dead state)
        this.emit('normalized', handle.currentRequestId, {
          type: 'task_complete',
          result: '',
          costUsd: 0,
          durationMs: Date.now() - handle.startedAt,
          numTurns: 1,
          usage: {},
          sessionId: handle.sessionId || '',
        } as NormalizedEvent)
      }

      // Clean up request tracking for current message
      if (handle.currentRequestId) {
        this.requestToTab.delete(handle.currentRequestId)
      }
      // Also clean up pending
      if (handle.pendingRequestId) {
        this.requestToTab.delete(handle.pendingRequestId)
      }

      this.activeSessions.delete(tabId)
      this.emit('session-exit', tabId, exitCode, signal, handle.sessionId)
    })

    return handle
  }

  private _startMessage(handle: PtySessionHandle, requestId: string, prompt: string): void {
    log(`Starting message [tab=${handle.tabId}] [req=${requestId}]: ${prompt.substring(0, 80)}`)

    handle.currentRequestId = requestId
    handle.collectingResponse = false
    handle.sawPromptEcho = false
    handle.isSlashCommand = prompt.trim().startsWith('/')
    handle.slashOverlayDismissed = false
    handle.toolCallCount = 0
    handle.pendingPermission = null
    handle.permissionPhase = 'idle'
    handle.textAccumulator = ''
    handle.promptSnippet = prompt.trim().toLowerCase().slice(0, 24)
    handle.runCompleteEmitted = false
    handle.selectorOptions = []
    handle.currentOptionIndex = 0
    handle.lastOutputAt = Date.now()

    // Write prompt to PTY stdin
    try {
      handle.pty.write(prompt + '\n')
    } catch (err) {
      log(`Failed to write prompt to PTY: ${(err as Error).message}`)
      this.emit('error', requestId, err as Error)
    }
  }

  private _resetMessageState(handle: PtySessionHandle): void {
    handle.currentRequestId = null
    handle.collectingResponse = false
    handle.sawPromptEcho = false
    handle.isSlashCommand = false
    handle.slashOverlayDismissed = false
    handle.toolCallCount = 0
    handle.pendingPermission = null
    handle.permissionPhase = 'idle'
    if (handle.permissionTimeout) {
      clearTimeout(handle.permissionTimeout)
      handle.permissionTimeout = null
    }
    handle.textAccumulator = ''
    handle.promptSnippet = ''
    handle.runCompleteEmitted = false
    if (handle.quiescenceTimer) {
      clearTimeout(handle.quiescenceTimer)
      handle.quiescenceTimer = null
    }
    handle.selectorOptions = []
    handle.currentOptionIndex = 0
  }

  private _processLine(tabId: string, handle: PtySessionHandle, rawLine: string): void {
    const cleaned = stripAnsi(rawLine).trim()
    if (cleaned.length === 0) return

    if (/^(?:\?[0-9;?]*[a-zA-Z])+$/i.test(cleaned)) return
    if (handle.ptyBuffer.length > 0 && handle.ptyBuffer[handle.ptyBuffer.length - 1] === cleaned) return

    this._ringPushBuffer(handle.ptyBuffer, cleaned)
    log(`PTY line [tab=${tabId}]: ${cleaned.substring(0, 200)}`)

    // ─── Phase 1: Session not yet ready — wait for first ❯ ───
    if (!handle.sessionReady) {
      // Try to capture session ID from startup output
      if (!handle.emittedSessionInit) {
        const sid = extractSessionId(cleaned)
        if (sid) handle.sessionId = sid
      }

      // Detect first-launch trust dialog and auto-confirm with Enter.
      // Pattern in cleaned output: "❯1.Yes,Itrustthisfolder" + "Entertoconfirm·Esctocancel"
      if (!handle.trustConfirmed) {
        if (/trust\s*this\s*folder/i.test(cleaned) || /^[❯>]\s*1\.\s*Yes/i.test(cleaned)) {
          handle.trustPromptSeen = true
        }
        if (handle.trustPromptSeen && /Enter\s*to\s*confirm/i.test(cleaned)) {
          log(`Trust dialog detected [tab=${tabId}] — auto-confirming with Enter`)
          handle.trustConfirmed = true
          handle.trustPromptSeen = false
          try { handle.pty.write('\r') } catch (err) {
            log(`Failed to send trust confirmation: ${(err as Error).message}`)
          }
          return
        }
      }

      if (isInputPrompt(cleaned)) {
        handle.sessionReady = true
        log(`Session ready [tab=${tabId}] sessionId=${handle.sessionId}`)

        // Emit session_init once, routed through the pending (or first) requestId
        if (!handle.emittedSessionInit) {
          handle.emittedSessionInit = true
          const initRequestId = handle.pendingRequestId || `session-${tabId}`
          this.emit('normalized', initRequestId, {
            type: 'session_init',
            sessionId: handle.sessionId || tabId,
            tools: [],
            model: '',
            mcpServers: [],
            skills: [],
            plugins: [],
            agents: [],
            permissionMode: null,
            fastModeState: null,
            version: '',
          } as NormalizedEvent)
        }

        // Send the buffered first message
        if (handle.pendingRequestId && handle.pendingPrompt !== null) {
          const reqId = handle.pendingRequestId
          const prompt = handle.pendingPrompt
          handle.pendingRequestId = null
          handle.pendingPrompt = null
          this._startMessage(handle, reqId, prompt)
        }
      }
      return
    }

    // ─── Phase 2: Session ready but no active message — ignore ───
    if (!handle.currentRequestId) return

    // ─── Phase 3: Active message — collect everything that isn't chrome ───
    // The previous design waited for a "❯ <user input>" echo line before
    // collecting. The current Claude TUI renders user input inside a box that
    // we filter as chrome, so that echo never arrives and the parser would
    // hang forever. Just collect any non-chrome line — isUiChrome already
    // filters status bars, box drawings, spinners, and prompts.
    if (!handle.collectingResponse) {
      if (isUiChrome(cleaned) || isInputPrompt(cleaned) || /^[❯>]\s+/.test(cleaned)) {
        return
      }
      handle.collectingResponse = true
      // Fall through to normal processing
    }

    // Detect rate-limit / quota notices and surface them as completion +
    // error so the UI clears the spinner instead of waiting forever.
    if (handle.currentRequestId && !handle.runCompleteEmitted &&
        /(used\s+\d+%\s+of\s+your\s+session\s+limit|\/upgrade\s+to\s+keep\s+using|usage\s+limit\s+reached)/i.test(cleaned)) {
      log(`Rate-limit notice detected [tab=${tabId}] — completing request`)
      const requestId = handle.currentRequestId
      handle.runCompleteEmitted = true
      this._flushText(handle)
      this.emit('normalized', requestId, {
        type: 'error',
        message: cleaned,
        isError: true,
        sessionId: handle.sessionId || tabId,
      } as NormalizedEvent)
      this.emit('normalized', requestId, {
        type: 'task_complete',
        result: cleaned,
        costUsd: 0,
        durationMs: Date.now() - handle.startedAt,
        numTurns: 0,
        usage: {},
        sessionId: handle.sessionId || tabId,
      } as NormalizedEvent)
      const sessionId = handle.sessionId
      this._resetMessageState(handle)
      this.requestToTab.delete(requestId)
      this.emit('message-complete', requestId, sessionId)
      return
    }

    // ─── Phase 4: Collecting response — normal processing ───

    // Permission phase
    if (handle.permissionPhase === 'detecting' || handle.permissionPhase === 'idle') {
      this._checkPermissionInBuffer(tabId, handle, cleaned)
      if (handle.permissionPhase === 'waiting_user') return
    }

    // Tool call detection
    const toolCall = parseToolCallLine(cleaned)
    if (toolCall) {
      handle.toolCallCount++
      this._flushText(handle)
      this.emit('normalized', handle.currentRequestId, {
        type: 'tool_call',
        toolName: toolCall.toolName,
        toolId: `pty-tool-${handle.toolCallCount}`,
        index: handle.toolCallCount - 1,
      } as NormalizedEvent)
      setTimeout(() => {
        if (handle.currentRequestId) {
          this.emit('normalized', handle.currentRequestId, {
            type: 'tool_call_complete',
            index: handle.toolCallCount - 1,
          } as NormalizedEvent)
        }
      }, 100)
      return
    }

    if (isUiChrome(cleaned)) return

    if (handle.textAccumulator.length > 0) handle.textAccumulator += '\n'
    const textLine = cleaned.startsWith('⏺') ? cleaned.replace(/^⏺\s*/, '') : cleaned
    handle.textAccumulator += textLine

    // Auto-dismiss slash command overlays (e.g. /help, /permissions) so the
    // run can complete rather than hanging on the interactive overlay.
    if (
      handle.isSlashCommand
      && !handle.slashOverlayDismissed
      && /(?:Esc\s*to\s*(?:cancel|exit)|Enter\s*to\s*confirm)/i.test(cleaned)
    ) {
      handle.slashOverlayDismissed = true
      setTimeout(() => {
        if (this.activeSessions.has(tabId)) {
          try { handle.pty.write('\x1b') } catch {}
        }
      }, 250)
    }

    this._scheduleTextFlush(tabId, handle)
  }

  private _checkQuiescenceCompletion(tabId: string, handle: PtySessionHandle): void {
    if (!this.activeSessions.has(tabId)) return
    if (!handle.currentRequestId || !handle.collectingResponse) return
    if (handle.permissionPhase === 'waiting_user') return
    if (Date.now() - handle.lastOutputAt < QUIESCENCE_MS - 50) return

    const lastLines = handle.ptyBuffer.slice(-3)
    const hasPromptMarker = lastLines.some((l) => isInputPrompt(l))
    if (!hasPromptMarker) return

    this._flushText(handle)

    const requestId = handle.currentRequestId

    if (!handle.runCompleteEmitted) {
      handle.runCompleteEmitted = true
      this.emit('normalized', requestId, {
        type: 'task_complete',
        result: '',
        costUsd: 0,
        durationMs: Date.now() - handle.startedAt,
        numTurns: 1,
        usage: {},
        sessionId: handle.sessionId || '',
      } as NormalizedEvent)
    }

    const sessionId = handle.sessionId
    this._resetMessageState(handle)
    this.requestToTab.delete(requestId)

    // Signal ControlPlane: message done, process still alive
    this.emit('message-complete', requestId, sessionId)
  }

  private _textFlushTimers = new Map<string, ReturnType<typeof setTimeout>>()

  private _scheduleTextFlush(tabId: string, handle: PtySessionHandle): void {
    if (this._textFlushTimers.has(tabId)) return
    const timer = setTimeout(() => {
      this._textFlushTimers.delete(tabId)
      this._flushText(handle)
    }, 50)
    this._textFlushTimers.set(tabId, timer)
  }

  private _flushText(handle: PtySessionHandle): void {
    const timer = this._textFlushTimers.get(handle.tabId)
    if (timer) {
      clearTimeout(timer)
      this._textFlushTimers.delete(handle.tabId)
    }
    if (handle.textAccumulator.length > 0 && handle.currentRequestId) {
      this.emit('normalized', handle.currentRequestId, {
        type: 'text_chunk',
        text: handle.textAccumulator,
      } as NormalizedEvent)
      handle.textAccumulator = ''
    }
  }

  private _checkPermissionInBuffer(tabId: string, handle: PtySessionHandle, currentLine: string): void {
    const detectionWindow = [...handle.ptyBuffer.slice(-10), currentLine]
    const permission = detectPermissionPrompt(detectionWindow)
    if (!permission) {
      const hasKeyword = /\b(?:permission|approve|allow|deny)\b/i.test(currentLine)
      if (hasKeyword && handle.permissionPhase === 'idle') handle.permissionPhase = 'detecting'
      return
    }

    log(`Permission prompt detected [tab=${tabId}]: tool=${permission.toolName}`)
    handle.pendingPermission = permission
    handle.permissionPhase = 'waiting_user'
    this._flushText(handle)

    const questionId = `pty-perm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    if (handle.currentRequestId) {
      this.emit('normalized', handle.currentRequestId, {
        type: 'permission_request',
        questionId,
        toolName: permission.toolName,
        toolDescription: permission.rawPrompt,
        options: permission.options.map((o) => ({
          id: o.optionId,
          label: o.label,
          kind: o.label.toLowerCase().includes('deny') || o.label.toLowerCase().includes('reject') ? 'deny' : 'allow',
        })),
      } as NormalizedEvent)
    }

    handle.permissionTimeout = setTimeout(() => {
      if (handle.permissionPhase === 'waiting_user') {
        log(`Permission timeout [tab=${tabId}] — auto-denying`)
        if (handle.currentRequestId) {
          this.emit('normalized', handle.currentRequestId, {
            type: 'text_chunk',
            text: '\n[Permission timed out — automatically denied after 5 minutes]\n',
          } as NormalizedEvent)
        }
        try { handle.pty.write('\x1b') } catch {}
        handle.permissionPhase = 'idle'
        handle.pendingPermission = null
      }
    }, PERMISSION_TIMEOUT_MS)
  }

  // ─── Public API ───

  /**
   * Respond to a permission prompt by sending keystrokes to the PTY.
   */
  respondToPermission(tabId: string, _questionId: string, optionId: string): boolean {
    const handle = this.activeSessions.get(tabId)
    if (!handle) return false
    if (handle.permissionPhase !== 'waiting_user' || !handle.pendingPermission) return false

    if (handle.permissionTimeout) {
      clearTimeout(handle.permissionTimeout)
      handle.permissionTimeout = null
    }

    const option = handle.pendingPermission.options.find((o) => o.optionId === optionId)
    if (!option) return false

    log(`respondToPermission [tab=${tabId}]: label=${option.label}`)

    const optionIndex = handle.pendingPermission.options.indexOf(option)
    const isDeny = option.label.toLowerCase().includes('deny') || option.label.toLowerCase().includes('reject')

    try {
      if (isDeny) {
        handle.pty.write('n')
      } else if (optionIndex === 0) {
        handle.pty.write('\r')
      } else {
        for (let i = 0; i < optionIndex; i++) handle.pty.write('\x1b[B')
        setTimeout(() => { try { handle.pty.write('\r') } catch {} }, 50)
      }
    } catch (err) {
      log(`respondToPermission write error: ${(err as Error).message}`)
      return false
    }

    handle.permissionPhase = 'answered'
    handle.pendingPermission = null
    setTimeout(() => {
      if (handle.permissionPhase === 'answered') handle.permissionPhase = 'idle'
    }, 500)

    return true
  }

  /**
   * Cancel the currently running message by sending Ctrl+C.
   * The process stays alive and returns to the ❯ prompt.
   */
  cancelMessage(tabId: string): boolean {
    const handle = this.activeSessions.get(tabId)
    if (!handle) return false

    log(`Cancelling message [tab=${tabId}]`)

    if (handle.permissionTimeout) {
      clearTimeout(handle.permissionTimeout)
      handle.permissionTimeout = null
    }
    if (handle.quiescenceTimer) {
      clearTimeout(handle.quiescenceTimer)
      handle.quiescenceTimer = null
    }

    try {
      handle.pty.write('\x03') // Ctrl+C
    } catch { return false }

    // Tell the UI the request is finished immediately — don't wait for Claude
    // to confirm. This unblocks the spinner even when Claude never emitted a
    // recognizable response (rate limit, quota exhausted, etc.).
    if (handle.currentRequestId && !handle.runCompleteEmitted) {
      handle.runCompleteEmitted = true
      const requestId = handle.currentRequestId
      this._flushText(handle)
      this.emit('normalized', requestId, {
        type: 'task_complete',
        result: 'Cancelled',
        costUsd: 0,
        durationMs: Date.now() - handle.startedAt,
        numTurns: 0,
        usage: {},
        sessionId: handle.sessionId || tabId,
      } as NormalizedEvent)
      const sessionId = handle.sessionId
      this._resetMessageState(handle)
      this.requestToTab.delete(requestId)
      this.emit('message-complete', requestId, sessionId)
    }

    return true
  }

  /**
   * End a tab's session: write /exit, then kill after 3s.
   * Called on tab close or session reset.
   */
  endSession(tabId: string): void {
    const handle = this.activeSessions.get(tabId)
    if (!handle) return

    log(`Ending session [tab=${tabId}]`)

    if (handle.permissionTimeout) clearTimeout(handle.permissionTimeout)
    if (handle.quiescenceTimer) clearTimeout(handle.quiescenceTimer)

    this._flushText(handle)
    this.activeSessions.delete(tabId)

    if (handle.currentRequestId) this.requestToTab.delete(handle.currentRequestId)
    if (handle.pendingRequestId) this.requestToTab.delete(handle.pendingRequestId)

    try { handle.pty.write('/exit\n') } catch {}
    setTimeout(() => {
      try { handle.pty.kill() } catch {}
    }, 3000)
  }

  getEnrichedError(requestId: string, exitCode: number | null): EnrichedError {
    const tabId = this.requestToTab.get(requestId)
    const handle = tabId ? this.activeSessions.get(tabId) : undefined
    return {
      message: `PTY session failed with exit code ${exitCode}`,
      stderrTail: [],
      stdoutTail: handle?.rawOutputTail.slice(-20) || [],
      exitCode,
      elapsedMs: handle ? Date.now() - handle.startedAt : 0,
      toolCallCount: handle?.toolCallCount || 0,
      sawPermissionRequest: handle?.permissionPhase !== 'idle' || false,
      permissionDenials: [],
    }
  }

  hasSession(tabId: string): boolean {
    return this.activeSessions.has(tabId)
  }

  isRunning(tabId: string): boolean {
    const handle = this.activeSessions.get(tabId)
    return !!handle?.currentRequestId
  }

  getSessionHandle(tabId: string): PtySessionHandle | undefined {
    return this.activeSessions.get(tabId)
  }

  getActiveTabIds(): string[] {
    return Array.from(this.activeSessions.keys())
  }

  private _ringPush(buffer: string[], line: string): void {
    buffer.push(line)
    if (buffer.length > MAX_RING_LINES) buffer.shift()
  }

  private _ringPushBuffer(buffer: string[], line: string): void {
    buffer.push(line)
    if (buffer.length > PTY_BUFFER_SIZE) buffer.shift()
  }
}
