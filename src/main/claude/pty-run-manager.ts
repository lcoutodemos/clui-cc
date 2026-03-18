/**
 * PtyRunManager: Interactive PTY transport for Claude Code.
 *
 * Spawns `claude` (without -p) via node-pty to get the full interactive
 * terminal experience, including permission prompts. Parses the PTY output
 * to extract text, tool calls, and permission requests, then emits
 * normalized events identical to RunManager.
 *
 * This module is behind the `CLUI_INTERACTIVE_PERMISSIONS_PTY` feature flag.
 *
 * Known limitations:
 * - Parsing depends on Claude CLI's terminal output format (Ink-based)
 * - ANSI stripping may lose some formatting nuance
 * - Permission prompt detection uses heuristics, not a formal grammar
 * - If the CLI's UI changes significantly, the parser may break
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
  // Will be set when first needed — fail at startRun() time, not import time
}

const LOG_FILE = join(homedir(), '.clui-debug.log')
const MAX_RING_LINES = 100
const PTY_BUFFER_SIZE = 50 // rolling window of cleaned lines for parser context
const PERMISSION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const QUIESCENCE_MS = 2000

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] [PtyRunManager] ${msg}\n`
  try { appendFileSync(LOG_FILE, line) } catch {}
}

// ─── ANSI Stripping ───

/**
 * Strip ANSI escape sequences (colors, cursor movement, clear line, etc.)
 */
function stripAnsi(str: string): string {
  // Covers CSI sequences including private modes like ?2004h
  return str.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')  // OSC sequences
    .replace(/\x1b[()][0-9A-Za-z]/g, '')  // character set selection
    .replace(/\x1b[#=>\[\]]/g, '')         // misc escapes
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '') // control chars except \n \r \t
}

// ─── Permission Prompt Detection ───

interface ParsedPermission {
  toolName: string
  rawPrompt: string
  options: Array<{ optionId: string; label: string; terminalValue: string }>
}

/**
 * Confidence-scored permission prompt detector.
 * Looks at a window of cleaned terminal lines and tries to identify
 * a Claude permission prompt.
 */
function detectPermissionPrompt(lines: string[]): ParsedPermission | null {
  const joined = lines.join('\n')

  // ─── Pattern 1: "Claude wants to use <ToolName>" or "Allow <ToolName>" ───
  // The interactive CLI typically shows something like:
  //   "Claude wants to use Bash"
  //   "Command: ls -la"
  //   "❯ Allow for this project  Allow once  Deny"

  let confidence = 0
  let toolName = ''
  let rawPrompt = ''

  // Check for tool permission keywords
  const toolMatch = joined.match(/(?:wants?\s+to\s+(?:use|run|execute)|Tool:\s*|tool_name:\s*)(\w+)/i)
  if (toolMatch) {
    toolName = toolMatch[1]
    confidence += 3
  }

  // Check for permission-specific keywords
  const permissionKeywords = [
    /\ballow\b/i,
    /\bdeny\b/i,
    /\breject\b/i,
    /\bpermission\b/i,
    /\bapprove\b/i,
  ]
  for (const kw of permissionKeywords) {
    if (kw.test(joined)) confidence++
  }

  // Check for option-like patterns (numbered or arrow-selected)
  const hasOptions = /(?:❯|›|>)\s*(?:Allow|Deny|Yes|No)/i.test(joined)
    || /\b(?:Allow\s+(?:once|always|for\s+(?:this\s+)?(?:project|session)))\b/i.test(joined)
  if (hasOptions) confidence += 2

  // Need at least 4 confidence to declare a permission prompt
  if (confidence < 4) return null

  // ─── Extract options ───
  const options: ParsedPermission['options'] = []

  // Try to find option labels. The interactive CLI typically shows:
  // ❯ Allow for this project  |  Allow once  |  Deny
  // Or vertically:
  // ❯ Allow for this project
  //   Allow once
  //   Deny

  // Pattern: Look for Allow/Deny variants
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
      options.push({
        optionId: `opt-${optIdx}`,
        label: op.label,
        // Terminal value: we'll use arrow key navigation + Enter
        // The position in the list determines how many down arrows to press
        terminalValue: String(optIdx),
      })
    }
  }

  // If we didn't find specific options but have high confidence,
  // add default Allow/Deny options
  if (options.length === 0 && confidence >= 4) {
    options.push(
      { optionId: 'opt-1', label: 'Allow', terminalValue: '1' },
      { optionId: 'opt-2', label: 'Deny', terminalValue: '2' },
    )
  }

  // Extract the raw prompt context (last 10 lines)
  rawPrompt = lines.slice(-10).join('\n')

  return { toolName: toolName || 'Unknown', rawPrompt, options }
}

/**
 * Try to extract a session ID from terminal output.
 * The interactive CLI may print session info at startup.
 */
function extractSessionId(text: string): string | null {
  // Pattern: "Session: <uuid>" or "session_id: <uuid>" or just a UUID in init context
  const match = text.match(/(?:session[_ ]?id|Session|Resuming session)[:\s]+([a-f0-9-]{36})/i)
  return match ? match[1] : null
}

/**
 * Detect if the CLI is showing its input prompt (ready for next message).
 * This indicates the current response is complete.
 *
 * The Ink-based CLI renders the prompt line as something like:
 *   "❯ "  or  "❯ ? for shortcuts"  or  "> "
 * After proper \r handling, the prompt should be a clean line.
 */
function isInputPrompt(line: string): boolean {
  const cleaned = line.trim()
  if (cleaned === '❯' || cleaned === '>' || cleaned === '$') return true
  // Match prompt with trailing hint text (e.g. "❯ ? for shortcuts")
  if (/^[❯>]\s*(?:\?\s*for\s*shortcuts)?$/.test(cleaned)) return true
  return false
}

function isUiChrome(line: string): boolean {
  const cleaned = line.trim()
  if (!cleaned) return true
  if (/^[╭│╰─┌└┃┏┗┐┘┤├┬┴┼]/.test(cleaned)) return true
  if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✢✳✶✻✽]/.test(cleaned)) return true
  if (/^\s*(?:Medium|Low|High)\s/.test(cleaned) && /model/i.test(cleaned)) return true
  if (/\/mcp|MCP server/i.test(cleaned)) return true
  if (/Claude\s*Code\s*v/i.test(cleaned) || /ClaudeCodev/i.test(cleaned)) return true
  if (/^[❯>$]\s*$/.test(cleaned)) return true
  if (/^\$[\d.]+\s+·/.test(cleaned)) return true
  if (/for\s*shortcuts/i.test(cleaned)) return true
  if (/zigzagging|thinking|processing|nebulizing|Boondoggling/i.test(cleaned)) return true
  if (/^esctointerrupt/i.test(cleaned)) return true
  // Prompt line with hint
  if (/^[❯>]\s*\?\s*for\s*shortcuts/i.test(cleaned)) return true
  // Status bar fragments: "Opus 4.6 · Claude Max" etc.
  if (/Opus\s*[\d.]+\s*·/i.test(cleaned)) return true
  if (/Claude\s*Max/i.test(cleaned)) return true
  // Settings issue / doctor notice
  if (/settings?\s*issue|\/doctor/i.test(cleaned)) return true
  // Horizontal rules (all dashes/box chars)
  if (/^[─━▪\-=]{4,}/.test(cleaned)) return true
  // Only box-drawing / decoration chars
  if (/^[▗▖▘▝▀▄▌▐█░▒▓■□▪▫●○◆◇◈]+$/.test(cleaned)) return true
  return false
}

/**
 * Detect if a line looks like a tool call header from the interactive CLI.
 * Example: "⏳ Bash ls -la" or "✓ Read file.ts"
 */
function parseToolCallLine(line: string): { toolName: string; input: string } | null {
  // Pattern: emoji/spinner + tool name + optional input
  const match = line.match(/(?:⏳|⏳|✓|✗|⚡|🔧|Running|Executing)\s+(\w+)\s*(.*)/i)
    || line.match(/(?:Tool|Using):\s*(\w+)\s*(.*)/i)
  if (match) {
    return { toolName: match[1], input: match[2].trim() }
  }
  return null
}

// ─── Run Handle ───

export interface PtyRunHandle {
  runId: string
  sessionId: string | null
  pty: import('node-pty').IPty
  pid: number
  startedAt: number
  /** Ring buffer of raw PTY output for diagnostics */
  rawOutputTail: string[]
  /** Ring buffer of stderr-like error lines */
  stderrTail: string[]
  /** Count of tool calls seen */
  toolCallCount: number
  /** Current pending permission prompt */
  pendingPermission: ParsedPermission | null
  /** Permission flow phase */
  permissionPhase: 'idle' | 'detecting' | 'waiting_user' | 'answered'
  /** Rolling window of cleaned lines for parser context */
  ptyBuffer: string[]
  /** Timer for permission timeout */
  permissionTimeout: ReturnType<typeof setTimeout> | null
  /** Accumulated text since last flush (for debounced text_chunk emission) */
  textAccumulator: string
  /** Whether we've seen the initial welcome/init output */
  pastInit: boolean
  /** Whether we've emitted session_init */
  emittedSessionInit: boolean
  /** Track which options are in the current selector for arrow-key navigation */
  selectorOptions: string[]
  /** Currently highlighted option index in the terminal selector */
  currentOptionIndex: number
  /** Whether task_complete has already been emitted for this run */
  runCompleteEmitted: boolean
  /** Quiescence timer used to avoid premature completion */
  quiescenceTimer: ReturnType<typeof setTimeout> | null
  /** Last PTY output timestamp */
  lastOutputAt: number
  /** Current prompt snippet used to detect the echoed user input */
  promptSnippet: string
  /** Whether we saw an echoed prompt for current request */
  sawPromptEcho: boolean
}

// ─── PtyRunManager ───

export class PtyRunManager extends EventEmitter {
  private activeRuns = new Map<string, PtyRunHandle>()
  private _finishedRuns = new Map<string, PtyRunHandle>()
  private claudeBinary: string

  constructor() {
    super()
    this.claudeBinary = this._findClaudeBinary()
    this._ensureSpawnHelperExecutable()
    log(`Claude binary: ${this.claudeBinary}`)
  }

  /**
   * node-pty prebuilt spawn-helper may lose execute bit depending on install/archive flow.
   * Ensure it's executable at runtime to avoid "posix_spawnp failed".
   */
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
      if (!existsSync(helperPath)) return
      const st = statSync(helperPath)
      const isExecutable = (st.mode & 0o111) !== 0
      if (!isExecutable) {
        chmodSync(helperPath, 0o755)
        log(`Fixed spawn-helper permissions: ${helperPath}`)
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

  startRun(requestId: string, options: RunOptions): PtyRunHandle {
    if (!pty) {
      throw new Error('node-pty is not available — cannot use PTY transport')
    }

    const cwd = options.projectPath === '~' ? homedir() : options.projectPath

    // Build args for interactive mode (no -p flag)
    const args: string[] = [
      '--permission-mode', 'default',
    ]

    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    }
    if (options.model) {
      args.push('--model', options.model)
    }
    if (options.allowedTools?.length) {
      args.push('--allowedTools', options.allowedTools.join(','))
    }
    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt)
    }

    // Pass prompt as positional argument
    args.push(options.prompt)

    log(`Starting PTY run ${requestId}: ${this.claudeBinary} ${args.join(' ')}`)
    log(`Prompt: ${options.prompt.substring(0, 200)}`)

    const ptyProcess = pty.spawn(this.claudeBinary, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd,
      env: this._getEnv(),
    })

    log(`Spawned PTY PID: ${ptyProcess.pid}`)

    const handle: PtyRunHandle = {
      runId: requestId,
      sessionId: options.sessionId || null,
      pty: ptyProcess,
      pid: ptyProcess.pid,
      startedAt: Date.now(),
      rawOutputTail: [],
      stderrTail: [],
      toolCallCount: 0,
      pendingPermission: null,
      permissionPhase: 'idle',
      ptyBuffer: [],
      permissionTimeout: null,
      textAccumulator: '',
      pastInit: false,
      emittedSessionInit: false,
      selectorOptions: [],
      currentOptionIndex: 0,
      runCompleteEmitted: false,
      quiescenceTimer: null,
      lastOutputAt: Date.now(),
      promptSnippet: options.prompt.trim().toLowerCase().slice(0, 24),
      sawPromptEcho: false,
    }

    // ─── PTY output parser pipeline ───
    let lineBuffer = ''

    ptyProcess.onData((data: string) => {
      // Raw diagnostics
      this._ringPush(handle.rawOutputTail, data.substring(0, 500))

      handle.lastOutputAt = Date.now()
      if (handle.quiescenceTimer) clearTimeout(handle.quiescenceTimer)
      handle.quiescenceTimer = setTimeout(() => this._checkQuiescenceCompletion(requestId, handle), QUIESCENCE_MS)

      // Ink/TUI uses \r to redraw the current line (cursor back to col 0).
      // PTY output commonly uses \r\r\n as line endings (Ink reset + newline).
      // Strategy: scan for \n to emit completed lines; treat \r immediately
      // before \n (or \r\n) as part of the line ending, not a redraw.
      // Only a \r followed by printable text is a true Ink redraw.
      const chars = data
      for (let ci = 0; ci < chars.length; ci++) {
        const ch = chars[ci]
        if (ch === '\n') {
          // Emit completed line (strip any trailing \r that was buffered)
          const completed = lineBuffer.endsWith('\r')
            ? lineBuffer.slice(0, -1)
            : lineBuffer
          lineBuffer = ''
          this._processLine(requestId, handle, completed)
        } else if (ch === '\r') {
          // Look ahead: if next char is \n or \r (part of \r\r\n), just
          // append \r to buffer so the \n branch can strip it.
          const next = ci + 1 < chars.length ? chars[ci + 1] : null
          if (next === '\n' || next === '\r') {
            // Part of line ending sequence — keep in buffer for \n to strip
            lineBuffer += '\r'
          } else if (next === null) {
            // End of chunk — we don't know what comes next, buffer it
            lineBuffer += '\r'
          } else {
            // \r followed by printable text → Ink redraw: reset line
            lineBuffer = ''
          }
        } else {
          lineBuffer += ch
        }
      }

      // Also process the current incomplete line for permission detection
      // (permission prompts may not end with newline)
      if (lineBuffer.length > 0) {
        const cleaned = stripAnsi(lineBuffer).trim()
        if (cleaned.length > 0) {
          this._checkPermissionInBuffer(requestId, handle, cleaned)
        }
      }
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      log(`PTY exited [${requestId}]: code=${exitCode} signal=${signal}`)

      // Clear permission timeout
      if (handle.permissionTimeout) {
        clearTimeout(handle.permissionTimeout)
        handle.permissionTimeout = null
      }
      if (handle.quiescenceTimer) {
        clearTimeout(handle.quiescenceTimer)
        handle.quiescenceTimer = null
      }

      // Flush any accumulated text
      this._flushText(requestId, handle)

      // Emit task_complete if we haven't already
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

      // Move to finished runs
      this._finishedRuns.set(requestId, handle)
      this.activeRuns.delete(requestId)
      this.emit('exit', requestId, exitCode, signal, handle.sessionId)

      setTimeout(() => this._finishedRuns.delete(requestId), 5000)
    })

    this.activeRuns.set(requestId, handle)
    return handle
  }

  /**
   * Process a single line of PTY output.
   */
  private _processLine(requestId: string, handle: PtyRunHandle, rawLine: string): void {
    const cleaned = stripAnsi(rawLine).trim()
    if (cleaned.length === 0) return

    // Ignore terminal mode toggles and redraw control fragments.
    if (/^(?:\?[0-9;?]*[a-zA-Z])+$/i.test(cleaned)) return

    // Deduplicate exact redraw duplicates.
    if (handle.ptyBuffer.length > 0 && handle.ptyBuffer[handle.ptyBuffer.length - 1] === cleaned) return

    // Push to rolling buffer
    this._ringPushBuffer(handle.ptyBuffer, cleaned)

    log(`PTY line [${requestId}]: ${cleaned.substring(0, 200)}`)

    // ─── Try to extract session ID ───
    if (!handle.emittedSessionInit) {
      const sid = extractSessionId(cleaned)
      if (sid) {
        handle.sessionId = sid
        handle.emittedSessionInit = true
        this.emit('normalized', requestId, {
          type: 'session_init',
          sessionId: sid,
          tools: [],
          model: '',
          mcpServers: [],
          skills: [],
          version: '',
        } as NormalizedEvent)
      }
    }

    // ─── Skip init/welcome output ───
    if (!handle.pastInit) {
      // Wait until we see the echoed prompt for this request.
      if (/^[❯>]\s+/.test(cleaned)) {
        // Resume sessions may echo prior context, not the exact current prompt text.
        // Any echoed input prompt means init shell is ready.
        handle.sawPromptEcho = true
      }
      // Start parsing actual response only after a message bullet appears post-echo.
      if (handle.sawPromptEcho && cleaned.startsWith('⏺')) {
        handle.pastInit = true
      } else {
        return
      }
    }

    // ─── Permission phase: collecting detection context ───
    if (handle.permissionPhase === 'detecting' || handle.permissionPhase === 'idle') {
      this._checkPermissionInBuffer(requestId, handle, cleaned)
      if (handle.permissionPhase === 'waiting_user') {
        return // Permission prompt detected and emitted
      }
    }

    // ─── Detect tool calls ───
    const toolCall = parseToolCallLine(cleaned)
    if (toolCall) {
      handle.toolCallCount++
      this._flushText(requestId, handle)
      this.emit('normalized', requestId, {
        type: 'tool_call',
        toolName: toolCall.toolName,
        toolId: `pty-tool-${handle.toolCallCount}`,
        index: handle.toolCallCount - 1,
      } as NormalizedEvent)

      // Also emit tool_call_complete shortly after (we can't know exact timing from PTY)
      setTimeout(() => {
        this.emit('normalized', requestId, {
          type: 'tool_call_complete',
          index: handle.toolCallCount - 1,
        } as NormalizedEvent)
      }, 100)
      return
    }

    // ─── Accumulate text output ───
    if (isUiChrome(cleaned)) return

    // Accumulate text for debounced emission
    if (handle.textAccumulator.length > 0) {
      handle.textAccumulator += '\n'
    }
    const textLine = cleaned.startsWith('⏺') ? cleaned.replace(/^⏺\s*/, '') : cleaned
    handle.textAccumulator += textLine

    // Emit text chunks periodically (debounce 50ms)
    this._scheduleTextFlush(requestId, handle)
  }

  private _checkQuiescenceCompletion(requestId: string, handle: PtyRunHandle): void {
    if (!this.activeRuns.has(requestId)) return
    if (!handle.pastInit || handle.permissionPhase === 'waiting_user') return
    if (Date.now() - handle.lastOutputAt < QUIESCENCE_MS - 50) return

    const lastLines = handle.ptyBuffer.slice(-3)
    const hasPromptMarker = lastLines.some((l) => isInputPrompt(l))
    if (!hasPromptMarker) return

    this._flushText(requestId, handle)
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

    try { handle.pty.write('/exit\n') } catch {}
    setTimeout(() => {
      if (this.activeRuns.has(requestId)) {
        try { handle.pty.kill() } catch {}
      }
    }, 3000)
  }

  private _textFlushTimers = new Map<string, ReturnType<typeof setTimeout>>()

  private _scheduleTextFlush(requestId: string, handle: PtyRunHandle): void {
    if (this._textFlushTimers.has(requestId)) return

    const timer = setTimeout(() => {
      this._textFlushTimers.delete(requestId)
      this._flushText(requestId, handle)
    }, 50)

    this._textFlushTimers.set(requestId, timer)
  }

  private _flushText(requestId: string, handle: PtyRunHandle): void {
    const timer = this._textFlushTimers.get(requestId)
    if (timer) {
      clearTimeout(timer)
      this._textFlushTimers.delete(requestId)
    }

    if (handle.textAccumulator.length > 0) {
      this.emit('normalized', requestId, {
        type: 'text_chunk',
        text: handle.textAccumulator,
      } as NormalizedEvent)
      handle.textAccumulator = ''
    }
  }

  /**
   * Check the current buffer for permission prompt patterns.
   */
  private _checkPermissionInBuffer(requestId: string, handle: PtyRunHandle, currentLine: string): void {
    // Add current line to detection context
    const detectionWindow = [...handle.ptyBuffer.slice(-10), currentLine]

    const permission = detectPermissionPrompt(detectionWindow)
    if (!permission) {
      // Check for permission-adjacent keywords to enter detecting phase
      const hasKeyword = /\b(?:permission|approve|allow|deny)\b/i.test(currentLine)
      if (hasKeyword && handle.permissionPhase === 'idle') {
        handle.permissionPhase = 'detecting'
      }
      return
    }

    // Permission prompt detected!
    log(`Permission prompt detected [${requestId}]: tool=${permission.toolName}, options=${permission.options.length}`)

    handle.pendingPermission = permission
    handle.permissionPhase = 'waiting_user'

    // Flush any accumulated text first
    this._flushText(requestId, handle)

    // Generate a unique question ID
    const questionId = `pty-perm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    // Emit permission_request event
    this.emit('normalized', requestId, {
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

    // Set timeout for user response
    handle.permissionTimeout = setTimeout(() => {
      if (handle.permissionPhase === 'waiting_user') {
        log(`Permission timeout [${requestId}] — auto-denying`)
        this.emit('normalized', requestId, {
          type: 'text_chunk',
          text: '\n[Permission timed out — automatically denied after 5 minutes]\n',
        } as NormalizedEvent)
        // Send Escape to dismiss the prompt
        try {
          handle.pty.write('\x1b')
        } catch {}
        handle.permissionPhase = 'idle'
        handle.pendingPermission = null
      }
    }, PERMISSION_TIMEOUT_MS)
  }

  /**
   * Respond to a permission prompt by sending keystrokes to the PTY.
   */
  respondToPermission(requestId: string, _questionId: string, optionId: string): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) {
      log(`respondToPermission: no active run for ${requestId}`)
      return false
    }

    if (handle.permissionPhase !== 'waiting_user' || !handle.pendingPermission) {
      log(`respondToPermission: not waiting for permission (phase=${handle.permissionPhase})`)
      return false
    }

    // Clear timeout
    if (handle.permissionTimeout) {
      clearTimeout(handle.permissionTimeout)
      handle.permissionTimeout = null
    }

    const option = handle.pendingPermission.options.find((o) => o.optionId === optionId)
    if (!option) {
      log(`respondToPermission: option ${optionId} not found`)
      return false
    }

    log(`respondToPermission [${requestId}]: optionId=${optionId}, label=${option.label}`)

    // ─── Send keystrokes to PTY ───
    // The Claude interactive CLI uses Ink's Select component.
    // The first option is typically "Allow for this project" and is pre-selected.
    // To select a different option, we press Down arrow keys then Enter.

    const optionIndex = handle.pendingPermission.options.indexOf(option)
    const isAllow = option.label.toLowerCase().includes('allow') || option.label.toLowerCase().includes('yes')
    const isDeny = option.label.toLowerCase().includes('deny') || option.label.toLowerCase().includes('reject')

    try {
      if (isDeny) {
        // Try sending 'n' first (common shortcut for deny)
        // If that doesn't work, navigate with arrow keys
        // Send Escape first to clear any state, then 'n'
        handle.pty.write('n')
      } else if (isAllow && optionIndex === 0) {
        // First option (typically already selected) — just press Enter
        handle.pty.write('\r')
      } else {
        // Navigate to the option with arrow keys then press Enter
        for (let i = 0; i < optionIndex; i++) {
          handle.pty.write('\x1b[B') // Down arrow
        }
        // Small delay then Enter
        setTimeout(() => {
          try { handle.pty.write('\r') } catch {}
        }, 50)
      }
    } catch (err) {
      log(`respondToPermission: write error: ${(err as Error).message}`)
      return false
    }

    handle.permissionPhase = 'answered'
    handle.pendingPermission = null

    // After answering, reset to idle for next potential permission
    setTimeout(() => {
      if (handle.permissionPhase === 'answered') {
        handle.permissionPhase = 'idle'
      }
    }, 500)

    return true
  }

  /**
   * Cancel a running PTY process.
   */
  cancel(requestId: string): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false

    log(`Cancelling PTY run ${requestId}`)

    // Clear permission timeout
    if (handle.permissionTimeout) {
      clearTimeout(handle.permissionTimeout)
      handle.permissionTimeout = null
    }

    // Send SIGINT (Ctrl+C)
    try {
      handle.pty.write('\x03') // Ctrl+C
    } catch {}

    // Fallback: kill after 5s
    setTimeout(() => {
      if (this.activeRuns.has(requestId)) {
        log(`Force killing PTY run ${requestId}`)
        try {
          handle.pty.kill()
        } catch {}
      }
    }, 5000)

    return true
  }

  /**
   * Write arbitrary data to PTY stdin (for follow-up messages, etc.)
   */
  writeToStdin(requestId: string, message: string): boolean {
    const handle = this.activeRuns.get(requestId)
    if (!handle) return false

    log(`Writing to PTY stdin [${requestId}]: ${message.substring(0, 200)}`)
    try {
      handle.pty.write(message)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get an enriched error object for a failed PTY run.
   */
  getEnrichedError(requestId: string, exitCode: number | null): EnrichedError {
    const handle = this.activeRuns.get(requestId) || this._finishedRuns.get(requestId)
    return {
      message: `PTY run failed with exit code ${exitCode}`,
      stderrTail: handle?.stderrTail.slice(-20) || [],
      stdoutTail: handle?.rawOutputTail.slice(-20) || [],
      exitCode,
      elapsedMs: handle ? Date.now() - handle.startedAt : 0,
      toolCallCount: handle?.toolCallCount || 0,
      sawPermissionRequest: handle?.permissionPhase !== 'idle' || false,
      permissionDenials: [],
    }
  }

  isRunning(requestId: string): boolean {
    return this.activeRuns.has(requestId)
  }

  getHandle(requestId: string): PtyRunHandle | undefined {
    return this.activeRuns.get(requestId)
  }

  getActiveRunIds(): string[] {
    return Array.from(this.activeRuns.keys())
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
