// ─── Claude Code Stream Event Types (verified from v2.1.63) ───

export interface InitEvent {
  type: 'system'
  subtype: 'init'
  cwd: string
  session_id: string
  tools: string[]
  mcp_servers: Array<{ name: string; status: string }>
  model: string
  permissionMode: string
  agents: string[]
  skills: string[]
  plugins: string[]
  claude_code_version: string
  fast_mode_state: string
  uuid: string
}

export interface StreamEvent {
  type: 'stream_event'
  event: StreamSubEvent
  session_id: string
  parent_tool_use_id: string | null
  uuid: string
}

export type StreamSubEvent =
  | { type: 'message_start'; message: AssistantMessagePayload }
  | { type: 'content_block_start'; index: number; content_block: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: ContentDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string | null }; usage: UsageData; context_management?: unknown }
  | { type: 'message_stop' }

export interface ContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export type ContentDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partial_json: string }

export interface AssistantEvent {
  type: 'assistant'
  message: AssistantMessagePayload
  parent_tool_use_id: string | null
  session_id: string
  uuid: string
}

export interface AssistantMessagePayload {
  model: string
  id: string
  role: 'assistant'
  content: ContentBlock[]
  stop_reason: string | null
  usage: UsageData
}

export interface RateLimitEvent {
  type: 'rate_limit_event'
  rate_limit_info: {
    status: string
    resetsAt: number
    rateLimitType: string
  }
  session_id: string
  uuid: string
}

export interface ResultEvent {
  type: 'result'
  subtype: 'success' | 'error'
  is_error: boolean
  duration_ms: number
  num_turns: number
  result: string
  total_cost_usd: number
  session_id: string
  usage: UsageData & {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  permission_denials: string[]
  uuid: string
}

export interface UsageData {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  service_tier?: string
}

export interface PermissionEvent {
  type: 'permission_request'
  tool: { name: string; description?: string; input?: Record<string, unknown> }
  question_id: string
  options: Array<{ id: string; label: string; kind?: string }>
  session_id: string
  uuid: string
}

// Union of all possible top-level events
export type ClaudeEvent = InitEvent | StreamEvent | AssistantEvent | RateLimitEvent | ResultEvent | PermissionEvent | UnknownEvent

export interface UnknownEvent {
  type: string
  [key: string]: unknown
}

// ─── Tab Groups ───

export interface TabGroup {
  id: string
  name: string
  color?: 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'pink'
  collapsed: boolean
  order: number
}

// ─── Tab State Machine (v2 — from execution plan) ───

export type TabStatus = 'connecting' | 'idle' | 'running' | 'completed' | 'failed' | 'dead'

export interface PermissionRequest {
  questionId: string
  toolTitle: string
  toolDescription?: string
  toolInput?: Record<string, unknown>
  options: Array<{ optionId: string; kind?: string; label: string }>
}

export interface RetryState {
  isRetrying: boolean
  attempt: number
  maxAttempts: number
  nextRetryAt: number | null
  lastError?: string
  exhausted?: boolean
  stopped?: boolean
}

export interface AgentAssignment {
  tabId: string
  agentLabel: string
  projectPath: string
  workKey?: string
  summary: string
  status: 'active' | 'done'
  startedAt: string
  updatedAt: string
  doneAt?: string
  note?: string
}

export interface AgentMemorySnapshot {
  projectPath: string
  active: AgentAssignment[]
  recentDone: AgentAssignment[]
}

export type AgentMemoryClaimResult =
  | { ok: true; snapshot: AgentMemorySnapshot; assignment: AgentAssignment }
  | { ok: false; snapshot: AgentMemorySnapshot; conflict: AgentAssignment }

export interface Attachment {
  id: string
  type: 'image' | 'file'
  name: string
  path: string
  mimeType?: string
  /** Base64 data URL for image previews */
  dataUrl?: string
  /** File size in bytes */
  size?: number
  /** True when injected from per-project auto-attach config */
  autoAttached?: boolean
}

export interface AutoAttachConfig {
  projectPath: string
  files: string[]
}

export interface AutoAttachState {
  config: AutoAttachConfig
  attachments: Attachment[]
  warnings: string[]
}

export interface TabState {
  id: string
  claudeSessionId: string | null
  status: TabStatus
  activeRequestId: string | null
  hasUnread: boolean
  currentActivity: string
  permissionQueue: PermissionRequest[]
  /** Fallback card when tools were denied and no interactive permission is available */
  permissionDenied: { tools: Array<{ toolName: string; toolUseId: string }> } | null
  retryState: RetryState | null
  agentAssignment: AgentAssignment | null
  lastRunOptions: RunOptions | null
  queuedRunOptions: RunOptions[]
  attachments: Attachment[]
  messages: Message[]
  title: string
  /** Last run's result data (cost, tokens, duration) */
  lastResult: RunResult | null
  /** Session metadata from init event */
  sessionModel: string | null
  sessionTools: string[]
  sessionMcpServers: Array<{ name: string; status: string }>
  sessionSkills: string[]
  sessionVersion: string | null
  /** Prompts waiting behind the current run (display text only) */
  queuedPrompts: string[]
  /** Working directory for this tab's Claude sessions */
  workingDirectory: string
  /** Whether the user explicitly chose a directory (vs. using default home) */
  hasChosenDirectory: boolean
  /** Extra directories accessible via --add-dir (session-preserving) */
  additionalDirs: string[]
  /** Tab group this tab belongs to (undefined = ungrouped) */
  groupId?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolName?: string
  toolInput?: string
  toolStatus?: 'running' | 'completed' | 'error'
  timestamp: number
}

export interface RunResult {
  totalCostUsd: number
  durationMs: number
  numTurns: number
  usage: UsageData
  sessionId: string
}

export type ExportFormat = 'markdown' | 'json'

export interface ExportOptions {
  format: ExportFormat
  includeUserMessages: boolean
  includeAssistantMessages: boolean
  includeToolCalls: boolean
  includeMetadata: boolean
}

export interface SessionExportData {
  title: string
  exportedAt: string
  sessionId: string | null
  projectPath: string
  model: string | null
  messages: Message[]
  lastResult: RunResult | null
}

export interface SessionExportResult {
  ok: boolean
  path: string | null
  error?: string
}

export interface ShortcutBinding {
  id: string
  label: string
  category: 'navigation' | 'view' | 'actions'
  defaultKeys: string
  currentKeys: string
}

export type ShortcutMap = Record<string, string>

// ─── Canonical Events (normalized from raw stream) ───

export type NormalizedEvent =
  | { type: 'session_init'; sessionId: string; tools: string[]; model: string; mcpServers: Array<{ name: string; status: string }>; skills: string[]; version: string; isWarmup?: boolean }
  | { type: 'text_chunk'; text: string }
  | { type: 'tool_call'; toolName: string; toolId: string; index: number }
  | { type: 'tool_call_update'; toolId: string; partialInput: string }
  | { type: 'tool_call_complete'; index: number }
  | { type: 'task_update'; message: AssistantMessagePayload }
  | { type: 'task_complete'; result: string; costUsd: number; durationMs: number; numTurns: number; usage: UsageData; sessionId: string; permissionDenials?: Array<{ toolName: string; toolUseId: string }> }
  | { type: 'error'; message: string; isError: boolean; sessionId?: string }
  | { type: 'session_dead'; exitCode: number | null; signal: string | null; stderrTail: string[] }
  | { type: 'rate_limit'; status: string; resetsAt: number; rateLimitType: string }
  | { type: 'usage'; usage: UsageData }
  | { type: 'permission_request'; questionId: string; toolName: string; toolDescription?: string; toolInput?: Record<string, unknown>; options: Array<{ id: string; label: string; kind?: string }> }

// ─── Run Options ───

export interface RunOptions {
  prompt: string
  projectPath: string
  sessionId?: string
  allowedTools?: string[]
  maxTurns?: number
  maxBudgetUsd?: number
  systemPrompt?: string
  model?: string
  /** Path to CLUI-scoped settings file with hook config (passed via --settings) */
  hookSettingsPath?: string
  /** Extra directories to add via --add-dir (session-preserving) */
  addDirs?: string[]
}

// ─── Control Plane Types ───

export interface TabRegistryEntry {
  tabId: string
  claudeSessionId: string | null
  status: TabStatus
  activeRequestId: string | null
  runPid: number | null
  createdAt: number
  lastActivityAt: number
  promptCount: number
}

export interface HealthReport {
  tabs: Array<{
    tabId: string
    status: TabStatus
    activeRequestId: string | null
    claudeSessionId: string | null
    alive: boolean
  }>
  queueDepth: number
}

export interface EnrichedError {
  message: string
  stderrTail: string[]
  stdoutTail?: string[]
  exitCode: number | null
  elapsedMs: number
  toolCallCount: number
  sawPermissionRequest?: boolean
  permissionDenials?: Array<{ tool_name: string; tool_use_id: string }>
}

// ─── Session History ───

export interface SessionMeta {
  sessionId: string
  slug: string | null
  firstMessage: string | null
  lastTimestamp: string
  size: number
  pinned: boolean
}

export interface SessionLoadMessage {
  role: string
  content: string
  toolName?: string
  timestamp: number
}

// ─── Cost Tracking ───

export interface CostRecord {
  timestamp: number
  sessionId: string
  model: string | null
  projectPath: string
  costUsd: number
  durationMs: number
  numTurns: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

export interface CostSummary {
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  totalDurationMs: number
  runCount: number
  byModel: Record<string, { costUsd: number; runs: number }>
  byProject: Record<string, { costUsd: number; runs: number }>
  byDay: Array<{ date: string; costUsd: number; runs: number }>
}

// ─── Marketplace / Plugin Types ───

export type PluginStatus = 'not_installed' | 'checking' | 'installing' | 'installed' | 'failed'

export interface CatalogPlugin {
  id: string              // unique: `${repo}/${skillPath}` e.g. 'anthropics/skills/skills/xlsx'
  name: string            // from SKILL.md or plugin.json
  description: string     // from SKILL.md or plugin.json
  version: string         // from plugin.json or '0.0.0'
  author: string          // from plugin.json or marketplace entry
  marketplace: string     // marketplace name from marketplace.json
  repo: string            // 'anthropics/skills' (empty for locally-installed orphans)
  sourcePath: string      // path within repo, e.g. 'skills/xlsx'
  installName: string     // individual skill name for SKILL.md skills, bundle name for CLI plugins
  category: string        // 'Agent Skills' | 'Knowledge Work' | 'Financial Services' | 'Official Plugins' | etc.
  tags: string[]          // Semantic use-case tags derived from name/description (e.g. 'Design', 'Finance')
  isSkillMd: boolean      // true = individual SKILL.md (direct install), false = CLI plugin (bundle install)
}

export interface InstalledPluginEntry {
  name: string            // plugin name (e.g. 'code-review')
  key: string             // original key from installed_plugins.json or directory name
  marketplace: string     // extracted from 'name@marketplace' format, or '' for skills
  type: 'plugin' | 'skill'
}

// ─── Git Context ───

export interface GitFileStatus {
  status: 'M' | 'A' | 'D' | 'R' | '?'
  path: string
}

export interface GitStatus {
  branch: string | null
  isRepo: boolean
  files: GitFileStatus[]
}

// ─── Terminal Types ───

export interface TerminalTab {
  id: string
  title: string
  shell: string
  cwd: string
  status: 'active' | 'exited'
  exitCode: number | null
}

export interface TerminalCreateOptions {
  shell?: string
  cwd?: string
}

// ─── IPC Channel Names ───

export const IPC = {
  // Request-response (renderer → main)
  START: 'clui:start',
  CREATE_TAB: 'clui:create-tab',
  PROMPT: 'clui:prompt',
  CANCEL: 'clui:cancel',
  STOP_TAB: 'clui:stop-tab',
  RETRY: 'clui:retry',
  STATUS: 'clui:status',
  TAB_HEALTH: 'clui:tab-health',
  CLOSE_TAB: 'clui:close-tab',
  SELECT_DIRECTORY: 'clui:select-directory',
  OPEN_EXTERNAL: 'clui:open-external',
  OPEN_IN_TERMINAL: 'clui:open-in-terminal',
  ATTACH_FILES: 'clui:attach-files',
  AUTO_ATTACH_GET: 'clui:auto-attach-get',
  AUTO_ATTACH_SET: 'clui:auto-attach-set',
  AUTO_ATTACH_ADD: 'clui:auto-attach-add',
  AUTO_ATTACH_REMOVE: 'clui:auto-attach-remove',
  TAKE_SCREENSHOT: 'clui:take-screenshot',
  TRANSCRIBE_AUDIO: 'clui:transcribe-audio',
  PASTE_IMAGE: 'clui:paste-image',
  GET_DIAGNOSTICS: 'clui:get-diagnostics',
  RESPOND_PERMISSION: 'clui:respond-permission',
  INIT_SESSION: 'clui:init-session',
  RESET_TAB_SESSION: 'clui:reset-tab-session',
  ANIMATE_HEIGHT: 'clui:animate-height',
  LIST_SESSIONS: 'clui:list-sessions',
  LOAD_SESSION: 'clui:load-session',
  EXPORT_SESSION: 'clui:export-session',
  AGENT_MEMORY_GET: 'clui:agent-memory-get',
  AGENT_MEMORY_FOCUS: 'clui:agent-memory-focus',
  AGENT_MEMORY_CLAIM: 'clui:agent-memory-claim',
  AGENT_MEMORY_DONE: 'clui:agent-memory-done',
  AGENT_MEMORY_RELEASE: 'clui:agent-memory-release',
  PIN_SESSION: 'clui:pin-session',
  UNPIN_SESSION: 'clui:unpin-session',

  // One-way events (main → renderer)
  TEXT_CHUNK: 'clui:text-chunk',
  TOOL_CALL: 'clui:tool-call',
  TOOL_CALL_UPDATE: 'clui:tool-call-update',
  TOOL_CALL_COMPLETE: 'clui:tool-call-complete',
  TASK_UPDATE: 'clui:task-update',
  TASK_COMPLETE: 'clui:task-complete',
  SESSION_DEAD: 'clui:session-dead',
  SESSION_INIT: 'clui:session-init',
  ERROR: 'clui:error',
  RATE_LIMIT: 'clui:rate-limit',

  // Window management
  RESIZE_HEIGHT: 'clui:resize-height',
  SET_WINDOW_WIDTH: 'clui:set-window-width',
  HIDE_WINDOW: 'clui:hide-window',
  WINDOW_SHOWN: 'clui:window-shown',
  SET_IGNORE_MOUSE_EVENTS: 'clui:set-ignore-mouse-events',
  IS_VISIBLE: 'clui:is-visible',

  // Skill provisioning (main → renderer)
  SKILL_STATUS: 'clui:skill-status',

  // Theme
  GET_THEME: 'clui:get-theme',
  THEME_CHANGED: 'clui:theme-changed',

  // Marketplace
  MARKETPLACE_FETCH: 'clui:marketplace-fetch',
  MARKETPLACE_INSTALLED: 'clui:marketplace-installed',
  MARKETPLACE_INSTALL: 'clui:marketplace-install',
  MARKETPLACE_UNINSTALL: 'clui:marketplace-uninstall',

  // Permission mode
  SET_PERMISSION_MODE: 'clui:set-permission-mode',

  // Permission management (settings.json)
  PERMISSIONS_GET: 'clui:permissions-get',
  PERMISSIONS_ADD: 'clui:permissions-add',
  PERMISSIONS_REMOVE: 'clui:permissions-remove',
  PERMISSIONS_APPLY_PRESET: 'clui:permissions-apply-preset',
  PERMISSIONS_NEEDS_SETUP: 'clui:permissions-needs-setup',
  PERMISSIONS_DISMISS_SETUP: 'clui:permissions-dismiss-setup',

  // Cost tracking
  COST_RECORD: 'clui:cost-record',
  COST_SUMMARY: 'clui:cost-summary',
  COST_HISTORY: 'clui:cost-history',

  // Git context
  GIT_STATUS: 'clui:git-status',
  GIT_DIFF: 'clui:git-diff',

  // Notifications
  NOTIFY_DESKTOP: 'clui:notify-desktop',
  GET_NOTIFICATION_PREFS: 'clui:get-notification-prefs',
  SET_NOTIFICATION_PREFS: 'clui:set-notification-prefs',

  // Event broadcast (main → renderer)
  NORMALIZED_EVENT: 'clui:normalized-event',
  TAB_STATUS_CHANGE: 'clui:tab-status-change',
  ENRICHED_ERROR: 'clui:enriched-error',

  // Whisper provisioning
  WHISPER_STATUS: 'clui:whisper-status',

  // Terminal
  TERMINAL_CREATE: 'clui:terminal-create',
  TERMINAL_WRITE: 'clui:terminal-write',
  TERMINAL_RESIZE: 'clui:terminal-resize',
  TERMINAL_CLOSE: 'clui:terminal-close',
  TERMINAL_DATA: 'clui:terminal-data',
  TERMINAL_EXIT: 'clui:terminal-exit',
  TERMINAL_AVAILABLE: 'clui:terminal-available',

  // Error logging
  LOG_RENDERER_ERROR: 'clui:log-renderer-error',

  // Legacy (kept for backward compat during migration)
  STREAM_EVENT: 'clui:stream-event',
  RUN_COMPLETE: 'clui:run-complete',
  RUN_ERROR: 'clui:run-error',
} as const
