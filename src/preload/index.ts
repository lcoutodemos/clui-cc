import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type {
  RunOptions,
  NormalizedEvent,
  HealthReport,
  EnrichedError,
  Attachment,
  SessionMeta,
  CatalogPlugin,
  InstalledPluginEntry,
  SessionLoadMessage,
  AgentMemorySnapshot,
  AgentMemoryClaimResult,
  ExportOptions,
  SessionExportData,
  SessionExportResult,
  CostRecord,
  CostSummary,
  AutoAttachState,
  GitStatus,
} from '../shared/types'

export interface CluiAPI {
  // ─── Request-response (renderer → main) ───
  start(): Promise<{ version: string; auth: { email?: string; subscriptionType?: string; authMethod?: string }; mcpServers: string[]; projectPath: string; homePath: string }>
  createTab(): Promise<{ tabId: string }>
  prompt(tabId: string, requestId: string, options: RunOptions): Promise<void>
  cancel(requestId: string): Promise<boolean>
  stopTab(tabId: string): Promise<boolean>
  retry(tabId: string, requestId: string, options: RunOptions): Promise<void>
  status(): Promise<HealthReport>
  tabHealth(): Promise<HealthReport>
  closeTab(tabId: string): Promise<void>
  selectDirectory(): Promise<string | null>
  openExternal(url: string): Promise<boolean>
  openInTerminal(sessionId: string | null, projectPath?: string): Promise<boolean>
  attachFiles(): Promise<Attachment[] | null>
  getAutoAttachConfig(projectPath: string): Promise<AutoAttachState>
  setAutoAttachFiles(projectPath: string, files: string[]): Promise<AutoAttachState>
  addAutoAttachFile(projectPath: string): Promise<AutoAttachState>
  removeAutoAttachFile(projectPath: string, relativePath: string): Promise<AutoAttachState>
  takeScreenshot(): Promise<Attachment | null>
  pasteImage(dataUrl: string): Promise<Attachment | null>
  transcribeAudio(audioBase64: string): Promise<{ error: string | null; transcript: string | null }>
  getDiagnostics(): Promise<any>
  respondPermission(tabId: string, questionId: string, optionId: string): Promise<boolean>
  initSession(tabId: string): void
  resetTabSession(tabId: string): void
  listSessions(projectPath?: string): Promise<SessionMeta[]>
  loadSession(sessionId: string, projectPath?: string): Promise<SessionLoadMessage[]>
  exportSession(data: SessionExportData, options: ExportOptions): Promise<SessionExportResult>
  pinSession(sessionId: string, projectPath: string): Promise<boolean>
  unpinSession(sessionId: string): Promise<boolean>
  agentMemoryGet(projectPath: string): Promise<AgentMemorySnapshot>
  agentMemoryFocus(tabId: string, projectPath: string, agentLabel: string, summary: string): Promise<{ snapshot: AgentMemorySnapshot }>
  agentMemoryClaim(tabId: string, projectPath: string, agentLabel: string, workKey: string, summary: string): Promise<AgentMemoryClaimResult>
  agentMemoryDone(tabId: string, note?: string): Promise<{ ok: boolean; snapshot: AgentMemorySnapshot | null }>
  agentMemoryRelease(tabId: string): Promise<{ ok: boolean; snapshots: AgentMemorySnapshot[] }>
  fetchMarketplace(forceRefresh?: boolean): Promise<{ plugins: CatalogPlugin[]; error: string | null }>
  listInstalledPlugins(): Promise<InstalledPluginEntry[]>
  installPlugin(repo: string, pluginName: string, marketplace: string, sourcePath?: string, isSkillMd?: boolean): Promise<{ ok: boolean; error?: string }>
  uninstallPlugin(pluginName: string): Promise<{ ok: boolean; error?: string }>
  setPermissionMode(mode: string): void
  getPermissions(): Promise<{ allow: string[]; deny: string[] }>
  addPermission(pattern: string): Promise<boolean>
  removePermission(pattern: string): Promise<boolean>
  applyPermissionPreset(preset: string): Promise<boolean>
  needsPermissionSetup(): Promise<boolean>
  dismissPermissionSetup(): Promise<boolean>
  recordCost(record: CostRecord): void
  getCostSummary(from?: number, to?: number): Promise<CostSummary>
  getCostHistory(limit?: number): Promise<CostRecord[]>
  getGitStatus(cwd: string): Promise<GitStatus>
  getGitDiff(cwd: string, file?: string): Promise<string>
  sendDesktopNotification(title: string, body: string): Promise<void>
  logRendererError(payload: { error: string; stack?: string; componentStack?: string; activeTabId?: string }): void
  getTheme(): Promise<{ isDark: boolean }>
  onThemeChange(callback: (isDark: boolean) => void): () => void

  // ─── Window management ───
  resizeHeight(height: number): void
  setWindowWidth(width: number): void
  animateHeight(from: number, to: number, durationMs: number): Promise<void>
  hideWindow(): void
  isVisible(): Promise<boolean>
  /** OS-level click-through for transparent window regions */
  setIgnoreMouseEvents(ignore: boolean, options?: { forward?: boolean }): void

  // ─── Event listeners (main → renderer) ───
  onEvent(callback: (tabId: string, event: NormalizedEvent) => void): () => void
  onTabStatusChange(callback: (tabId: string, newStatus: string, oldStatus: string) => void): () => void
  onError(callback: (tabId: string, error: EnrichedError) => void): () => void
  onSkillStatus(callback: (status: { name: string; state: string; error?: string; reason?: string }) => void): () => void
  onWhisperStatus(callback: (status: { stage: string; progress?: number; error?: string }) => void): () => void
  onWindowShown(callback: () => void): () => void

  // Terminal
  terminalAvailable(): Promise<boolean>
  terminalCreate(options?: { shell?: string; cwd?: string; cols?: number; rows?: number }): Promise<{ termTabId: string | null; error?: string }>
  terminalWrite(termTabId: string, data: string): void
  terminalResize(termTabId: string, cols: number, rows: number): void
  terminalClose(termTabId: string): Promise<void>
  onTerminalData(callback: (termTabId: string, data: string) => void): () => void
  onTerminalExit(callback: (termTabId: string, exitCode: number) => void): () => void
}

const api: CluiAPI = {
  // ─── Request-response ───
  start: () => ipcRenderer.invoke(IPC.START),
  createTab: () => ipcRenderer.invoke(IPC.CREATE_TAB),
  prompt: (tabId, requestId, options) => ipcRenderer.invoke(IPC.PROMPT, { tabId, requestId, options }),
  cancel: (requestId) => ipcRenderer.invoke(IPC.CANCEL, requestId),
  stopTab: (tabId) => ipcRenderer.invoke(IPC.STOP_TAB, tabId),
  retry: (tabId, requestId, options) => ipcRenderer.invoke(IPC.RETRY, { tabId, requestId, options }),
  status: () => ipcRenderer.invoke(IPC.STATUS),
  tabHealth: () => ipcRenderer.invoke(IPC.TAB_HEALTH),
  closeTab: (tabId) => ipcRenderer.invoke(IPC.CLOSE_TAB, tabId),
  selectDirectory: () => ipcRenderer.invoke(IPC.SELECT_DIRECTORY),
  openExternal: (url) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
  openInTerminal: (sessionId, projectPath) => ipcRenderer.invoke(IPC.OPEN_IN_TERMINAL, { sessionId, projectPath }),
  attachFiles: () => ipcRenderer.invoke(IPC.ATTACH_FILES),
  getAutoAttachConfig: (projectPath) => ipcRenderer.invoke(IPC.AUTO_ATTACH_GET, projectPath),
  setAutoAttachFiles: (projectPath, files) => ipcRenderer.invoke(IPC.AUTO_ATTACH_SET, { projectPath, files }),
  addAutoAttachFile: (projectPath) => ipcRenderer.invoke(IPC.AUTO_ATTACH_ADD, projectPath),
  removeAutoAttachFile: (projectPath, relativePath) => ipcRenderer.invoke(IPC.AUTO_ATTACH_REMOVE, { projectPath, relativePath }),
  takeScreenshot: () => ipcRenderer.invoke(IPC.TAKE_SCREENSHOT),
  pasteImage: (dataUrl) => ipcRenderer.invoke(IPC.PASTE_IMAGE, dataUrl),
  transcribeAudio: (audioBase64) => ipcRenderer.invoke(IPC.TRANSCRIBE_AUDIO, audioBase64),
  getDiagnostics: () => ipcRenderer.invoke(IPC.GET_DIAGNOSTICS),
  respondPermission: (tabId, questionId, optionId) =>
    ipcRenderer.invoke(IPC.RESPOND_PERMISSION, { tabId, questionId, optionId }),
  initSession: (tabId) => ipcRenderer.send(IPC.INIT_SESSION, tabId),
  resetTabSession: (tabId) => ipcRenderer.send(IPC.RESET_TAB_SESSION, tabId),
  listSessions: (projectPath?: string) => ipcRenderer.invoke(IPC.LIST_SESSIONS, projectPath),
  loadSession: (sessionId: string, projectPath?: string) => ipcRenderer.invoke(IPC.LOAD_SESSION, { sessionId, projectPath }),
  exportSession: (data, options) => ipcRenderer.invoke(IPC.EXPORT_SESSION, { data, options }),
  pinSession: (sessionId, projectPath) => ipcRenderer.invoke(IPC.PIN_SESSION, { sessionId, projectPath }),
  unpinSession: (sessionId) => ipcRenderer.invoke(IPC.UNPIN_SESSION, sessionId),
  agentMemoryGet: (projectPath) => ipcRenderer.invoke(IPC.AGENT_MEMORY_GET, projectPath),
  agentMemoryFocus: (tabId, projectPath, agentLabel, summary) =>
    ipcRenderer.invoke(IPC.AGENT_MEMORY_FOCUS, { tabId, projectPath, agentLabel, summary }),
  agentMemoryClaim: (tabId, projectPath, agentLabel, workKey, summary) =>
    ipcRenderer.invoke(IPC.AGENT_MEMORY_CLAIM, { tabId, projectPath, agentLabel, workKey, summary }),
  agentMemoryDone: (tabId, note) => ipcRenderer.invoke(IPC.AGENT_MEMORY_DONE, { tabId, note }),
  agentMemoryRelease: (tabId) => ipcRenderer.invoke(IPC.AGENT_MEMORY_RELEASE, tabId),
  fetchMarketplace: (forceRefresh) => ipcRenderer.invoke(IPC.MARKETPLACE_FETCH, { forceRefresh }),
  listInstalledPlugins: () => ipcRenderer.invoke(IPC.MARKETPLACE_INSTALLED),
  installPlugin: (repo, pluginName, marketplace, sourcePath, isSkillMd) =>
    ipcRenderer.invoke(IPC.MARKETPLACE_INSTALL, { repo, pluginName, marketplace, sourcePath, isSkillMd }),
  uninstallPlugin: (pluginName) =>
    ipcRenderer.invoke(IPC.MARKETPLACE_UNINSTALL, { pluginName }),
  setPermissionMode: (mode) => ipcRenderer.send(IPC.SET_PERMISSION_MODE, mode),
  getPermissions: () => ipcRenderer.invoke(IPC.PERMISSIONS_GET),
  addPermission: (pattern) => ipcRenderer.invoke(IPC.PERMISSIONS_ADD, pattern),
  removePermission: (pattern) => ipcRenderer.invoke(IPC.PERMISSIONS_REMOVE, pattern),
  applyPermissionPreset: (preset) => ipcRenderer.invoke(IPC.PERMISSIONS_APPLY_PRESET, preset),
  needsPermissionSetup: () => ipcRenderer.invoke(IPC.PERMISSIONS_NEEDS_SETUP),
  dismissPermissionSetup: () => ipcRenderer.invoke(IPC.PERMISSIONS_DISMISS_SETUP),
  recordCost: (record) => ipcRenderer.send(IPC.COST_RECORD, record),
  getCostSummary: (from, to) => ipcRenderer.invoke(IPC.COST_SUMMARY, from, to),
  getCostHistory: (limit) => ipcRenderer.invoke(IPC.COST_HISTORY, limit),
  getGitStatus: (cwd) => ipcRenderer.invoke(IPC.GIT_STATUS, cwd),
  getGitDiff: (cwd, file) => ipcRenderer.invoke(IPC.GIT_DIFF, cwd, file),
  sendDesktopNotification: (title: string, body: string) => ipcRenderer.invoke(IPC.NOTIFY_DESKTOP, title, body),
  logRendererError: (payload) => ipcRenderer.send(IPC.LOG_RENDERER_ERROR, payload),
  getTheme: () => ipcRenderer.invoke(IPC.GET_THEME),
  onThemeChange: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, isDark: boolean) => callback(isDark)
    ipcRenderer.on(IPC.THEME_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.THEME_CHANGED, handler)
  },

  // ─── Window management ───
  resizeHeight: (height) => ipcRenderer.send(IPC.RESIZE_HEIGHT, height),
  animateHeight: (from, to, durationMs) =>
    ipcRenderer.invoke(IPC.ANIMATE_HEIGHT, { from, to, durationMs }),
  hideWindow: () => ipcRenderer.send(IPC.HIDE_WINDOW),
  isVisible: () => ipcRenderer.invoke(IPC.IS_VISIBLE),
  setIgnoreMouseEvents: (ignore, options) =>
    ipcRenderer.send(IPC.SET_IGNORE_MOUSE_EVENTS, ignore, options || {}),
  setWindowWidth: (width) => ipcRenderer.send(IPC.SET_WINDOW_WIDTH, width),

  // ─── Event listeners ───
  onEvent: (callback) => {
    const channels = [
      IPC.TEXT_CHUNK, IPC.TOOL_CALL, IPC.TOOL_CALL_UPDATE,
      IPC.TOOL_CALL_COMPLETE, IPC.TASK_UPDATE, IPC.TASK_COMPLETE,
      IPC.SESSION_DEAD, IPC.SESSION_INIT, IPC.ERROR, IPC.RATE_LIMIT,
    ]
    // Single unified handler — all normalized events come through one channel
    const handler = (_e: Electron.IpcRendererEvent, tabId: string, event: NormalizedEvent) => callback(tabId, event)
    ipcRenderer.on(IPC.NORMALIZED_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC.NORMALIZED_EVENT, handler)
  },

  onTabStatusChange: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, tabId: string, newStatus: string, oldStatus: string) =>
      callback(tabId, newStatus, oldStatus)
    ipcRenderer.on(IPC.TAB_STATUS_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC.TAB_STATUS_CHANGE, handler)
  },

  onError: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, tabId: string, error: EnrichedError) =>
      callback(tabId, error)
    ipcRenderer.on(IPC.ENRICHED_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC.ENRICHED_ERROR, handler)
  },

  onSkillStatus: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, status: any) => callback(status)
    ipcRenderer.on(IPC.SKILL_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.SKILL_STATUS, handler)
  },

  onWhisperStatus: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, status: any) => callback(status)
    ipcRenderer.on(IPC.WHISPER_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.WHISPER_STATUS, handler)
  },

  onWindowShown: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.WINDOW_SHOWN, handler)
    return () => ipcRenderer.removeListener(IPC.WINDOW_SHOWN, handler)
  },

  // Terminal
  terminalAvailable: () => ipcRenderer.invoke(IPC.TERMINAL_AVAILABLE),
  terminalCreate: (options) => ipcRenderer.invoke(IPC.TERMINAL_CREATE, options),
  terminalWrite: (termTabId, data) => ipcRenderer.send(IPC.TERMINAL_WRITE, termTabId, data),
  terminalResize: (termTabId, cols, rows) => ipcRenderer.send(IPC.TERMINAL_RESIZE, termTabId, cols, rows),
  terminalClose: (termTabId) => ipcRenderer.invoke(IPC.TERMINAL_CLOSE, termTabId),
  onTerminalData: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, termTabId: string, data: string) => callback(termTabId, data)
    ipcRenderer.on(IPC.TERMINAL_DATA, handler)
    return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, handler)
  },
  onTerminalExit: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, termTabId: string, exitCode: number) => callback(termTabId, exitCode)
    ipcRenderer.on(IPC.TERMINAL_EXIT, handler)
    return () => ipcRenderer.removeListener(IPC.TERMINAL_EXIT, handler)
  },
}

contextBridge.exposeInMainWorld('clui', api)
