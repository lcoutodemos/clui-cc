import { create } from 'zustand'
import type {
  TabStatus,
  NormalizedEvent,
  EnrichedError,
  Message,
  TabState,
  Attachment,
  CatalogPlugin,
  PluginStatus,
  RunOptions,
  AgentAssignment,
  AgentMemorySnapshot,
  AgentMemoryClaimResult,
} from '../../shared/types'
import { canScheduleAutoResume, DEFAULT_AUTO_RESUME_MAX_RETRIES, getAutoResumeDelayMs } from '../../shared/retry-policy'
import { useThemeStore } from '../theme'
import { useNotificationStore } from './notificationStore'
import {
  loadStoredTabOrder,
  moveTabOrderItem,
  orderTabsByTabOrder,
  reconcileTabOrder,
  saveStoredTabOrder,
} from './tabOrder'
import notificationSrc from '../../../resources/notification.mp3'

// ─── Known models ───

export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
] as const

// ─── Store ───

interface StaticInfo {
  version: string
  email: string | null
  subscriptionType: string | null
  projectPath: string
  homePath: string
}

interface State {
  tabs: TabState[]
  tabOrder: string[]
  activeTabId: string
  /** Global expand/collapse — user-controlled, not per-tab */
  isExpanded: boolean
  /** Global info fetched on startup (not per-session) */
  staticInfo: StaticInfo | null
  agentMemorySnapshot: AgentMemorySnapshot | null
  /** User's preferred model override (null = use default) */
  preferredModel: string | null
  /** Global permission mode: 'ask' shows cards, 'auto' auto-approves all tool calls */
  permissionMode: 'ask' | 'auto'

  // Marketplace state
  marketplaceOpen: boolean
  marketplaceCatalog: CatalogPlugin[]
  marketplaceLoading: boolean
  marketplaceError: string | null
  marketplaceInstalledNames: string[]
  marketplacePluginStates: Record<string, PluginStatus>
  marketplaceSearch: string
  marketplaceFilter: string

  // Cost dashboard state
  costDashboardOpen: boolean

  // Actions
  initStaticInfo: () => Promise<void>
  setPreferredModel: (model: string | null) => void
  setPermissionMode: (mode: 'ask' | 'auto') => void
  createTab: () => Promise<string>
  reorderTabs: (newOrder: string[]) => void
  moveActiveTab: (direction: 'left' | 'right') => void
  selectTab: (tabId: string) => void
  closeTab: (tabId: string) => void
  clearTab: () => void
  toggleExpanded: () => void
  toggleMarketplace: () => void
  closeMarketplace: () => void
  toggleCostDashboard: () => void
  closeCostDashboard: () => void
  loadMarketplace: (forceRefresh?: boolean) => Promise<void>
  setMarketplaceSearch: (query: string) => void
  setMarketplaceFilter: (filter: string) => void
  installMarketplacePlugin: (plugin: CatalogPlugin) => Promise<void>
  uninstallMarketplacePlugin: (plugin: CatalogPlugin) => Promise<void>
  buildYourOwn: () => void
  resumeSession: (sessionId: string, title?: string, projectPath?: string) => Promise<string>
  addSystemMessage: (content: string) => void
  sendMessage: (prompt: string, projectPath?: string) => void
  respondPermission: (tabId: string, questionId: string, optionId: string) => void
  addDirectory: (dir: string) => void
  removeDirectory: (dir: string) => void
  setBaseDirectory: (dir: string) => void
  addAttachments: (attachments: Attachment[]) => void
  removeAttachment: (attachmentId: string) => void
  clearAttachments: () => void
  refreshAgentMemory: (projectPath?: string) => Promise<AgentMemorySnapshot | null>
  setAgentFocus: (summary: string) => Promise<AgentAssignment | null>
  claimAgentWork: (workKey: string, summary: string) => Promise<AgentMemoryClaimResult | null>
  markAgentDone: (note?: string) => Promise<boolean>
  releaseAgentWork: () => Promise<boolean>
  retryTab: (tabId: string) => void
  stopRetrying: (tabId: string) => void
  handleNormalizedEvent: (tabId: string, event: NormalizedEvent) => void
  handleStatusChange: (tabId: string, newStatus: string, oldStatus: string) => void
  handleError: (tabId: string, error: EnrichedError) => void
}

let msgCounter = 0
const nextMsgId = () => `msg-${++msgCounter}`
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearRetryTimer(tabId: string) {
  const timer = retryTimers.get(tabId)
  if (timer) {
    clearTimeout(timer)
    retryTimers.delete(tabId)
  }
}

function getResolvedProjectPath(tab: TabState | undefined, staticInfo: StaticInfo | null): string {
  if (!tab) {
    return staticInfo?.homePath || '~'
  }

  return tab.hasChosenDirectory
    ? tab.workingDirectory
    : (staticInfo?.homePath || tab.workingDirectory || '~')
}

function getAgentLabel(tabId: string, tabs: TabState[]): string {
  const index = tabs.findIndex((tab) => tab.id === tabId)
  return index === -1 ? `Tab ${tabId.slice(0, 8)}` : `Tab ${index + 1}`
}

function inferFocusSummary(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 120) {
    return normalized
  }
  return `${normalized.slice(0, 119).trimEnd()}…`
}

function applyAgentMemorySnapshotToTabs(
  tabs: TabState[],
  snapshot: AgentMemorySnapshot | null,
  staticInfo: StaticInfo | null,
): TabState[] {
  if (!snapshot) {
    return tabs
  }

  return tabs.map((tab) => {
    const tabProjectPath = getResolvedProjectPath(tab, staticInfo)
    if (tabProjectPath !== snapshot.projectPath) {
      return tab
    }

    return {
      ...tab,
      agentAssignment: snapshot.active.find((assignment) => assignment.tabId === tab.id) || null,
    }
  })
}

// ─── Notification sound (plays when task completes while window is hidden) ───
const notificationAudio = new Audio(notificationSrc)
notificationAudio.volume = 1.0

async function playNotificationIfHidden(): Promise<void> {
  if (!useThemeStore.getState().soundEnabled) return
  try {
    const visible = await window.clui.isVisible()
    if (!visible) {
      notificationAudio.currentTime = 0
      notificationAudio.play().catch(() => {})
    }
  } catch {}
}

function makeLocalTab(): TabState {
  return {
    id: crypto.randomUUID(),
    claudeSessionId: null,
    status: 'idle',
    activeRequestId: null,
    hasUnread: false,
    currentActivity: '',
    permissionQueue: [],
    permissionDenied: null,
    retryState: null,
    agentAssignment: null,
    lastRunOptions: null,
    queuedRunOptions: [],
    attachments: [],
    messages: [],
    title: 'New Tab',
    lastResult: null,
    sessionModel: null,
    sessionTools: [],
    sessionMcpServers: [],
    sessionSkills: [],
    sessionVersion: null,
    queuedPrompts: [],
    workingDirectory: '~',
    hasChosenDirectory: false,
    additionalDirs: [],
  }
}

const initialTab = makeLocalTab()
const initialTabOrder = reconcileTabOrder(loadStoredTabOrder(), [initialTab])

export const useSessionStore = create<State>((set, get) => ({
  tabs: orderTabsByTabOrder([initialTab], initialTabOrder),
  tabOrder: initialTabOrder,
  activeTabId: initialTab.id,
  isExpanded: false,
  staticInfo: null,
  agentMemorySnapshot: null,
  preferredModel: null,
  permissionMode: 'ask',

  // Marketplace
  marketplaceOpen: false,
  marketplaceCatalog: [],
  marketplaceLoading: false,
  marketplaceError: null,
  marketplaceInstalledNames: [],
  marketplacePluginStates: {},
  marketplaceSearch: '',
  marketplaceFilter: 'All',

  // Cost dashboard
  costDashboardOpen: false,

  initStaticInfo: async () => {
    try {
      const result = await window.clui.start()
      set({
        staticInfo: {
          version: result.version || 'unknown',
          email: result.auth?.email || null,
          subscriptionType: result.auth?.subscriptionType || null,
          projectPath: result.projectPath || '~',
          homePath: result.homePath || '~',
        },
      })
      void get().refreshAgentMemory(result.projectPath || result.homePath || '~')
    } catch {}
  },

  setPreferredModel: (model) => {
    set({ preferredModel: model })
  },

  setPermissionMode: (mode) => {
    set({ permissionMode: mode })
    window.clui.setPermissionMode(mode)
  },

  createTab: async () => {
    const homeDir = get().staticInfo?.homePath || '~'
    const defaultDir = homeDir
    try {
      const { tabId } = await window.clui.createTab()
      const tab: TabState = {
        ...makeLocalTab(),
        id: tabId,
        workingDirectory: homeDir,
      }
      set((s) => ({
        tabs: orderTabsByTabOrder([...s.tabs, tab], [...s.tabOrder, tab.id]),
        tabOrder: reconcileTabOrder([...s.tabOrder, tab.id], [...s.tabs, tab]),
        activeTabId: tab.id,
      }))
      saveStoredTabOrder(get().tabOrder)
      void get().refreshAgentMemory(homeDir)
      void get().refreshAgentMemory(defaultDir)
      return tabId
    } catch {
      const tab = makeLocalTab()
      tab.workingDirectory = homeDir
      set((s) => ({
        tabs: orderTabsByTabOrder([...s.tabs, tab], [...s.tabOrder, tab.id]),
        tabOrder: reconcileTabOrder([...s.tabOrder, tab.id], [...s.tabs, tab]),
        activeTabId: tab.id,
      }))
      saveStoredTabOrder(get().tabOrder)
      void get().refreshAgentMemory(homeDir)
      return tab.id
    }
  },

  reorderTabs: (newOrder) => {
    set((s) => {
      const nextOrder = reconcileTabOrder(newOrder, s.tabs)
      return {
        tabs: orderTabsByTabOrder(s.tabs, nextOrder),
        tabOrder: nextOrder,
      }
    })
    saveStoredTabOrder(get().tabOrder)
  },

  moveActiveTab: (direction) => {
    const { activeTabId, tabOrder, reorderTabs } = get()
    reorderTabs(moveTabOrderItem(tabOrder, activeTabId, direction))
  },

  selectTab: (tabId) => {
    const s = get()
    if (tabId === s.activeTabId) {
      // Clicking the already-active tab: toggle global expand/collapse
      const willExpand = !s.isExpanded
      set((prev) => ({
        isExpanded: willExpand,
        marketplaceOpen: false,
        costDashboardOpen: false,
        // Expanding = reading: clear unread flag
        tabs: willExpand
          ? prev.tabs.map((t) => t.id === tabId ? { ...t, hasUnread: false } : t)
          : prev.tabs,
      }))
      void get().refreshAgentMemory(getResolvedProjectPath(get().tabs.find((t) => t.id === tabId), get().staticInfo))
    } else {
      // Switching to a different tab: mark as read
      set((prev) => ({
        activeTabId: tabId,
        marketplaceOpen: false,
        costDashboardOpen: false,
        tabs: prev.tabs.map((t) =>
          t.id === tabId ? { ...t, hasUnread: false } : t
        ),
      }))
      void get().refreshAgentMemory(getResolvedProjectPath(get().tabs.find((t) => t.id === tabId), get().staticInfo))
    }
  },

  toggleExpanded: () => {
    const { activeTabId, isExpanded } = get()
    const willExpand = !isExpanded
    set((s) => ({
      isExpanded: willExpand,
      marketplaceOpen: false,
      costDashboardOpen: false,
      // Expanding = reading: clear unread flag for the active tab
      tabs: willExpand
        ? s.tabs.map((t) => t.id === activeTabId ? { ...t, hasUnread: false } : t)
        : s.tabs,
    }))
  },

  toggleMarketplace: () => {
    const s = get()
    if (s.marketplaceOpen) {
      set({ marketplaceOpen: false })
    } else {
      set({ isExpanded: false, marketplaceOpen: true, costDashboardOpen: false })
      get().loadMarketplace()
    }
  },

  closeMarketplace: () => {
    set({ marketplaceOpen: false })
  },

  toggleCostDashboard: () => {
    const s = get()
    if (s.costDashboardOpen) {
      set({ costDashboardOpen: false })
    } else {
      set({ isExpanded: false, costDashboardOpen: true, marketplaceOpen: false })
    }
  },

  closeCostDashboard: () => {
    set({ costDashboardOpen: false })
  },

  loadMarketplace: async (forceRefresh) => {
    set({ marketplaceLoading: true, marketplaceError: null })
    try {
      const [catalog, installed] = await Promise.all([
        window.clui.fetchMarketplace(forceRefresh),
        window.clui.listInstalledPlugins(),
      ])
      if (catalog.error && catalog.plugins.length === 0) {
        set({ marketplaceError: catalog.error, marketplaceLoading: false })
        return
      }
      const installedSet = new Set(installed.map((n) => n.toLowerCase()))
      const pluginStates: Record<string, PluginStatus> = {}
      for (const p of catalog.plugins) {
        // For SKILL.md skills: match individual name against ~/.claude/skills/ dirs
        // For CLI plugins: match installName or "installName@marketplace" against installed_plugins.json
        const candidates = p.isSkillMd
          ? [p.installName]
          : [p.installName, `${p.installName}@${p.marketplace}`]
        const isInstalled = candidates.some((c) => installedSet.has(c.toLowerCase()))
        pluginStates[p.id] = isInstalled ? 'installed' : 'not_installed'
      }
      set({
        marketplaceCatalog: catalog.plugins,
        marketplaceInstalledNames: installed,
        marketplacePluginStates: pluginStates,
        marketplaceLoading: false,
      })
    } catch (err: unknown) {
      set({
        marketplaceError: err instanceof Error ? err.message : String(err),
        marketplaceLoading: false,
      })
    }
  },

  setMarketplaceSearch: (query) => {
    set({ marketplaceSearch: query })
  },

  setMarketplaceFilter: (filter) => {
    set({ marketplaceFilter: filter })
  },

  installMarketplacePlugin: async (plugin) => {
    set((s) => ({
      marketplacePluginStates: { ...s.marketplacePluginStates, [plugin.id]: 'installing' },
    }))
    const result = await window.clui.installPlugin(plugin.repo, plugin.installName, plugin.marketplace, plugin.sourcePath, plugin.isSkillMd)
    if (result.ok) {
      set((s) => ({
        marketplacePluginStates: { ...s.marketplacePluginStates, [plugin.id]: 'installed' as PluginStatus },
        marketplaceInstalledNames: [...s.marketplaceInstalledNames, plugin.installName],
      }))
      useNotificationStore.getState().addToast({
        type: 'success',
        title: 'Skill installed',
        message: plugin.name,
      })
    } else {
      set((s) => ({
        marketplacePluginStates: { ...s.marketplacePluginStates, [plugin.id]: 'failed' },
      }))
      useNotificationStore.getState().addToast({
        type: 'error',
        title: 'Install failed',
        message: result.error || plugin.name,
      })
    }
  },

  uninstallMarketplacePlugin: async (plugin) => {
    const result = await window.clui.uninstallPlugin(plugin.installName)
    if (result.ok) {
      set((s) => ({
        marketplacePluginStates: { ...s.marketplacePluginStates, [plugin.id]: 'not_installed' as PluginStatus },
        marketplaceInstalledNames: s.marketplaceInstalledNames.filter((n) => n !== plugin.installName),
      }))
      useNotificationStore.getState().addToast({
        type: 'info',
        title: 'Skill uninstalled',
        message: plugin.name,
      })
    }
  },

  buildYourOwn: () => {
    set({ marketplaceOpen: false, costDashboardOpen: false, isExpanded: true })
    // Small delay to let the UI transition
    setTimeout(() => {
      get().sendMessage('Help me create a new Claude Code skill')
    }, 100)
  },

  closeTab: (tabId) => {
    clearRetryTimer(tabId)
    window.clui.closeTab(tabId).catch(() => {})

    const s = get()
    const remaining = s.tabs.filter((t) => t.id !== tabId)
    const remainingOrder = s.tabOrder.filter((id) => id !== tabId)

    if (s.activeTabId === tabId) {
      if (remaining.length === 0) {
        const newTab = makeLocalTab()
        const nextOrder = reconcileTabOrder([newTab.id], [newTab])
        set({
          tabs: orderTabsByTabOrder([newTab], nextOrder),
          tabOrder: nextOrder,
          activeTabId: newTab.id,
        })
        saveStoredTabOrder(get().tabOrder)
        void get().refreshAgentMemory(getResolvedProjectPath(newTab, get().staticInfo))
        return
      }
      const closedIndex = s.tabs.findIndex((t) => t.id === tabId)
      const newActive = remaining[Math.min(closedIndex, remaining.length - 1)]
      const nextOrder = reconcileTabOrder(remainingOrder, remaining)
      set({
        tabs: orderTabsByTabOrder(remaining, nextOrder),
        tabOrder: nextOrder,
        activeTabId: newActive.id,
      })
      saveStoredTabOrder(get().tabOrder)
      void get().refreshAgentMemory(getResolvedProjectPath(newActive, get().staticInfo))
    } else {
      const nextOrder = reconcileTabOrder(remainingOrder, remaining)
      set({
        tabs: orderTabsByTabOrder(remaining, nextOrder),
        tabOrder: nextOrder,
      })
      saveStoredTabOrder(get().tabOrder)
      void get().refreshAgentMemory(getResolvedProjectPath(get().tabs.find((t) => t.id === s.activeTabId), get().staticInfo))
    }
  },

  clearTab: () => {
    const { activeTabId } = get()
    clearRetryTimer(activeTabId)
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, messages: [], lastResult: null, currentActivity: '', permissionQueue: [], permissionDenied: null, retryState: null, lastRunOptions: null, queuedPrompts: [], queuedRunOptions: [] }
          : t
      ),
    }))
  },

  resumeSession: async (sessionId, title, projectPath) => {
    const defaultDir = projectPath || get().staticInfo?.homePath || '~'
    try {
      const { tabId } = await window.clui.createTab()

      // Load previous conversation messages from the JSONL file
      const history = await window.clui.loadSession(sessionId, defaultDir).catch(() => [])
      const messages: Message[] = history.map((m) => ({
        id: nextMsgId(),
        role: m.role as Message['role'],
        content: m.content,
        toolName: m.toolName,
        toolStatus: m.toolName ? 'completed' as const : undefined,
        timestamp: m.timestamp,
      }))

      const tab: TabState = {
        ...makeLocalTab(),
        id: tabId,
        claudeSessionId: sessionId,
        title: title || 'Resumed Session',
        workingDirectory: defaultDir,
        hasChosenDirectory: !!projectPath,
        messages,
      }
      set((s) => ({
        tabs: orderTabsByTabOrder([...s.tabs, tab], [...s.tabOrder, tab.id]),
        tabOrder: reconcileTabOrder([...s.tabOrder, tab.id], [...s.tabs, tab]),
        activeTabId: tab.id,
        isExpanded: true,
      }))
      saveStoredTabOrder(get().tabOrder)
      // Don't call initSession — the first real prompt will use --resume with the sessionId
      return tabId
    } catch {
      const tab = makeLocalTab()
      tab.claudeSessionId = sessionId
      tab.title = title || 'Resumed Session'
      tab.workingDirectory = defaultDir
      tab.hasChosenDirectory = !!projectPath
      set((s) => ({
        tabs: orderTabsByTabOrder([...s.tabs, tab], [...s.tabOrder, tab.id]),
        tabOrder: reconcileTabOrder([...s.tabOrder, tab.id], [...s.tabs, tab]),
        activeTabId: tab.id,
        isExpanded: true,
      }))
      saveStoredTabOrder(get().tabOrder)
      return tab.id
    } finally {
      void get().refreshAgentMemory(defaultDir)
    }
  },

  addSystemMessage: (content) => {
    const { activeTabId } = get()
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              messages: [
                ...t.messages,
                { id: nextMsgId(), role: 'system' as const, content, timestamp: Date.now() },
              ],
            }
          : t
      ),
    }))
  },

  // ─── Permission response ───

  respondPermission: (tabId, questionId, optionId) => {
    // Send to backend
    window.clui.respondPermission(tabId, questionId, optionId).catch(() => {})

    // Remove answered item from queue; show next tool's activity or clear
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t
        const remaining = t.permissionQueue.filter((p) => p.questionId !== questionId)
        return {
          ...t,
          permissionQueue: remaining,
          currentActivity: remaining.length > 0
            ? `Waiting for permission: ${remaining[0].toolTitle}`
            : 'Working...',
        }
      }),
    }))
  },

  // ─── Directory management ───

  addDirectory: (dir) => {
    const { activeTabId } = get()
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              additionalDirs: t.additionalDirs.includes(dir)
                ? t.additionalDirs
                : [...t.additionalDirs, dir],
            }
          : t
      ),
    }))
  },

  removeDirectory: (dir) => {
    const { activeTabId } = get()
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, additionalDirs: t.additionalDirs.filter((d) => d !== dir) }
          : t
      ),
    }))
  },

  setBaseDirectory: (dir) => {
    const { activeTabId } = get()
    window.clui.resetTabSession(activeTabId)
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              workingDirectory: dir,
              hasChosenDirectory: true,
              claudeSessionId: null,
              additionalDirs: [],
            }
          : t
      ),
    }))
    void window.clui.getAutoAttachConfig(dir).then((state) => {
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== activeTabId) return t

          const manualAttachments = t.attachments.filter((attachment) => !attachment.autoAttached)
          const manualPaths = new Set(manualAttachments.map((attachment) => attachment.path.toLowerCase()))
          const autoAttachments = state.attachments.filter((attachment) => !manualPaths.has(attachment.path.toLowerCase()))

          return {
            ...t,
            attachments: [...manualAttachments, ...autoAttachments],
          }
        }),
      }))

      if (state.warnings.length > 0) {
        useNotificationStore.getState().addToast({
          type: 'warning',
          title: 'Auto-attach skipped files',
          message: state.warnings[0],
        })
      }
    }).catch(() => {})
    void get().refreshAgentMemory(dir)
  },

  // ─── Attachment management ───

  addAttachments: (attachments) => {
    const { activeTabId } = get()
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, attachments: [...t.attachments, ...attachments] }
          : t
      ),
    }))
  },

  removeAttachment: (attachmentId) => {
    const { activeTabId } = get()
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, attachments: t.attachments.filter((a) => a.id !== attachmentId) }
          : t
      ),
    }))
  },

  clearAttachments: () => {
    const { activeTabId } = get()
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === activeTabId ? { ...t, attachments: [] } : t
      ),
    }))
  },

  refreshAgentMemory: async (projectPath) => {
    const { activeTabId, tabs, staticInfo } = get()
    const activeTab = tabs.find((tab) => tab.id === activeTabId)
    const resolvedProjectPath = projectPath || getResolvedProjectPath(activeTab, staticInfo)

    try {
      const snapshot = await window.clui.agentMemoryGet(resolvedProjectPath)
      set((s) => ({
        agentMemorySnapshot: snapshot,
        tabs: applyAgentMemorySnapshotToTabs(s.tabs, snapshot, s.staticInfo),
      }))
      return snapshot
    } catch {
      return null
    }
  },

  setAgentFocus: async (summary) => {
    const { activeTabId, tabs, staticInfo } = get()
    const tab = tabs.find((item) => item.id === activeTabId)
    if (!tab) {
      return null
    }

    const projectPath = getResolvedProjectPath(tab, staticInfo)
    const result = await window.clui.agentMemoryFocus(
      activeTabId,
      projectPath,
      getAgentLabel(activeTabId, tabs),
      summary,
    )

    set((s) => ({
      agentMemorySnapshot: result.snapshot,
      tabs: applyAgentMemorySnapshotToTabs(s.tabs, result.snapshot, s.staticInfo),
    }))

    return result.snapshot.active.find((assignment) => assignment.tabId === activeTabId) || null
  },

  claimAgentWork: async (workKey, summary) => {
    const { activeTabId, tabs, staticInfo } = get()
    const tab = tabs.find((item) => item.id === activeTabId)
    if (!tab) {
      return null
    }

    const projectPath = getResolvedProjectPath(tab, staticInfo)
    const result = await window.clui.agentMemoryClaim(
      activeTabId,
      projectPath,
      getAgentLabel(activeTabId, tabs),
      workKey,
      summary,
    )

    set((s) => ({
      agentMemorySnapshot: result.snapshot,
      tabs: applyAgentMemorySnapshotToTabs(s.tabs, result.snapshot, s.staticInfo),
    }))

    return result
  },

  markAgentDone: async (note) => {
    const { activeTabId } = get()
    const result = await window.clui.agentMemoryDone(activeTabId, note)

    set((s) => ({
      agentMemorySnapshot: result.snapshot ?? s.agentMemorySnapshot,
      tabs: result.snapshot
        ? applyAgentMemorySnapshotToTabs(s.tabs, result.snapshot, s.staticInfo)
        : s.tabs.map((tab) => tab.id === activeTabId ? { ...tab, agentAssignment: null } : tab),
    }))

    return result.ok
  },

  releaseAgentWork: async () => {
    const { activeTabId } = get()
    const result = await window.clui.agentMemoryRelease(activeTabId)

    set((s) => {
      let nextTabs = s.tabs.map((tab) => tab.id === activeTabId ? { ...tab, agentAssignment: null } : tab)
      let nextSnapshot = s.agentMemorySnapshot

      for (const snapshot of result.snapshots) {
        nextTabs = applyAgentMemorySnapshotToTabs(nextTabs, snapshot, s.staticInfo)
        if (s.agentMemorySnapshot?.projectPath === snapshot.projectPath) {
          nextSnapshot = snapshot
        }
      }

      return {
        agentMemorySnapshot: nextSnapshot,
        tabs: nextTabs,
      }
    })

    return result.ok
  },

  stopRetrying: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId)
    clearRetryTimer(tabId)
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId || !t.retryState) return t
        return {
          ...t,
          retryState: {
            ...t.retryState,
            isRetrying: false,
            nextRetryAt: null,
            stopped: true,
          },
          currentActivity: '',
        }
      }),
    }))

    if (tab?.activeRequestId && (tab.status === 'connecting' || tab.status === 'running')) {
      void window.clui.stopTab(tabId).catch(() => {})
    }
  },

  retryTab: (tabId) => {
    clearRetryTimer(tabId)
    const { tabs } = get()
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab?.lastRunOptions) return

    const maxAttempts = useThemeStore.getState().autoResumeMaxRetries || DEFAULT_AUTO_RESUME_MAX_RETRIES
    const requestId = crypto.randomUUID()

    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              status: 'connecting' as TabStatus,
              activeRequestId: requestId,
              currentActivity: 'Reconnecting...',
              retryState: {
                isRetrying: true,
                attempt: 1,
                maxAttempts,
                nextRetryAt: null,
                lastError: t.retryState?.lastError,
              },
            }
          : t
      ),
    }))

    void window.clui.retry(tabId, requestId, tab.lastRunOptions).catch((err: Error) => {
      get().handleError(tabId, {
        message: err.message,
        stderrTail: [],
        exitCode: null,
        elapsedMs: 0,
        toolCallCount: 0,
      })
    })
  },

  // ─── Send ───

  sendMessage: (prompt, projectPath) => {
    const { activeTabId, tabs, staticInfo } = get()
    const tab = tabs.find((t) => t.id === activeTabId)
    if (!tab) return
    // Use explicitly chosen directory, otherwise fall back to user home
    const resolvedPath = projectPath || getResolvedProjectPath(tab, staticInfo)

    // Guard: don't send while connecting (warmup in progress)
    if (tab.status === 'connecting') return

    const isBusy = tab.status === 'running'
    const requestId = crypto.randomUUID()
    const shouldInferFocus = !tab.agentAssignment && prompt.trim().length > 0

    // Build full prompt with attachment context
    let fullPrompt = prompt
    if (tab.attachments.length > 0) {
      const attachmentCtx = tab.attachments
        .map((a) => `[Attached ${a.type}: ${a.path}]`)
        .join('\n')
      fullPrompt = `${attachmentCtx}\n\n${prompt}`
    }

    const title = tab.messages.length === 0
      ? (prompt.length > 30 ? prompt.substring(0, 27) + '...' : prompt)
      : tab.title

    const { preferredModel } = get()
    const runOptions: RunOptions = {
      prompt: fullPrompt,
      projectPath: resolvedPath,
      sessionId: tab.claudeSessionId || undefined,
      model: preferredModel || undefined,
      addDirs: tab.additionalDirs.length > 0 ? tab.additionalDirs : undefined,
    }

    clearRetryTimer(activeTabId)

    // Optimistic update: clear attachments
    // If busy, add to queuedPrompts (shown at bottom); otherwise add to messages and set connecting
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== activeTabId) return t
        const withEffectiveBase = t.hasChosenDirectory
          ? t
          : {
              ...t,
              // Once the user sends the first message, lock in the effective
              // base directory (home by default) so the footer no longer shows "—".
              hasChosenDirectory: true,
              workingDirectory: resolvedPath,
            }
        if (isBusy) {
          return {
            ...withEffectiveBase,
            title,
            attachments: [],
            queuedPrompts: [...withEffectiveBase.queuedPrompts, prompt],
            queuedRunOptions: [...withEffectiveBase.queuedRunOptions, runOptions],
          }
        }
        return {
          ...withEffectiveBase,
          status: 'connecting' as TabStatus,
          activeRequestId: requestId,
          currentActivity: 'Starting...',
          title,
          attachments: [],
          retryState: null,
          lastRunOptions: runOptions,
          messages: [
            ...withEffectiveBase.messages,
            { id: nextMsgId(), role: 'user' as const, content: prompt, timestamp: Date.now() },
          ],
        }
      }),
    }))

    // Send to backend — ControlPlane will queue if a run is active
    window.clui.prompt(activeTabId, requestId, runOptions).catch((err: Error) => {
      get().handleError(activeTabId, {
        message: err.message,
        stderrTail: [],
        exitCode: null,
        elapsedMs: 0,
        toolCallCount: 0,
      })
    })

    if (shouldInferFocus) {
      void get().setAgentFocus(inferFocusSummary(prompt))
    }
  },

  // ─── Event handlers ───

  handleNormalizedEvent: (tabId, event) => {
    set((s) => {
      const { activeTabId } = s
      const tabs = s.tabs.map((tab) => {
        if (tab.id !== tabId) return tab
        const updated = { ...tab }

        switch (event.type) {
          case 'session_init':
            updated.claudeSessionId = event.sessionId
            updated.sessionModel = event.model
            updated.sessionTools = event.tools
            updated.sessionMcpServers = event.mcpServers
            updated.sessionSkills = event.skills
            updated.sessionVersion = event.version
            // Don't change status/activity for warmup inits — they're invisible
            if (!event.isWarmup) {
              updated.status = 'running'
              updated.currentActivity = 'Thinking...'
              // Move the first queued prompt into the timeline (it's now being processed)
              if (updated.queuedPrompts.length > 0) {
                const [nextPrompt, ...rest] = updated.queuedPrompts
                const [nextRunOptions, ...restRunOptions] = updated.queuedRunOptions
                updated.queuedPrompts = rest
                updated.queuedRunOptions = restRunOptions
                if (nextRunOptions) {
                  updated.lastRunOptions = nextRunOptions
                }
                updated.messages = [
                  ...updated.messages,
                  { id: nextMsgId(), role: 'user' as const, content: nextPrompt, timestamp: Date.now() },
                ]
              }
            }
            break

          case 'text_chunk': {
            updated.currentActivity = 'Writing...'
            const lastMsg = updated.messages[updated.messages.length - 1]
            if (lastMsg?.role === 'assistant' && !lastMsg.toolName) {
              updated.messages = [
                ...updated.messages.slice(0, -1),
                { ...lastMsg, content: lastMsg.content + event.text },
              ]
            } else {
              updated.messages = [
                ...updated.messages,
                { id: nextMsgId(), role: 'assistant', content: event.text, timestamp: Date.now() },
              ]
            }
            break
          }

          case 'tool_call':
            updated.currentActivity = `Running ${event.toolName}...`
            updated.messages = [
              ...updated.messages,
              {
                id: nextMsgId(),
                role: 'tool',
                content: '',
                toolName: event.toolName,
                toolInput: '',
                toolStatus: 'running',
                timestamp: Date.now(),
              },
            ]
            break

          case 'tool_call_update': {
            const msgs = [...updated.messages]
            const lastTool = [...msgs].reverse().find((m) => m.role === 'tool' && m.toolStatus === 'running')
            if (lastTool) {
              lastTool.toolInput = (lastTool.toolInput || '') + event.partialInput
            }
            updated.messages = msgs
            break
          }

          case 'tool_call_complete': {
            const msgs2 = [...updated.messages]
            const runningTool = [...msgs2].reverse().find((m) => m.role === 'tool' && m.toolStatus === 'running')
            if (runningTool) {
              runningTool.toolStatus = 'completed'
            }
            updated.messages = msgs2
            break
          }

          case 'task_update':
            if (event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === 'tool_use' && block.name) {
                  const exists = updated.messages.find(
                    (m) => m.role === 'tool' && m.toolName === block.name && !m.content
                  )
                  if (!exists) {
                    updated.messages = [
                      ...updated.messages,
                      {
                        id: nextMsgId(),
                        role: 'tool',
                        content: '',
                        toolName: block.name,
                        toolInput: JSON.stringify(block.input, null, 2),
                        toolStatus: 'completed',
                        timestamp: Date.now(),
                      },
                    ]
                  }
                }
              }
            }
            break

          case 'task_complete':
            updated.status = 'completed'
            updated.activeRequestId = null
            updated.currentActivity = ''
            updated.permissionQueue = []
            updated.retryState = null
            updated.lastResult = {
              totalCostUsd: event.costUsd,
              durationMs: event.durationMs,
              numTurns: event.numTurns,
              usage: event.usage,
              sessionId: event.sessionId,
            }
            // Mark as unread unless the user is actively viewing this tab
            // (active tab with card expanded). A collapsed active tab still
            // counts as "unread" — the user hasn't seen the response yet.
            if (tabId !== activeTabId || !s.isExpanded) {
              updated.hasUnread = true
            }
            // Show fallback card when tools were denied by permission settings
            if (event.permissionDenials && event.permissionDenials.length > 0) {
              updated.permissionDenied = { tools: event.permissionDenials }
            } else {
              updated.permissionDenied = null
            }
            // Record cost to persistent history
            try {
              window.clui.recordCost({
                timestamp: Date.now(),
                sessionId: event.sessionId,
                model: updated.sessionModel,
                projectPath: updated.workingDirectory,
                costUsd: event.costUsd,
                durationMs: event.durationMs,
                numTurns: event.numTurns,
                inputTokens: event.usage.input_tokens ?? 0,
                outputTokens: event.usage.output_tokens ?? 0,
                cacheReadTokens: event.usage.cache_read_input_tokens ?? 0,
                cacheCreationTokens: event.usage.cache_creation_input_tokens ?? 0,
              })
            } catch {
              // Cost recording failure is non-fatal
            }
            // Play notification sound if window is hidden
            playNotificationIfHidden()
            // Desktop notification when window is not focused
            if (useNotificationStore.getState().desktopEnabled) {
              window.clui.sendDesktopNotification(
                'Task Complete',
                `Finished in ${Math.round(event.durationMs / 1000)}s ($${event.costUsd.toFixed(4)})`,
              ).catch(() => {})
            }
            break

          case 'error':
            updated.status = 'failed'
            updated.activeRequestId = null
            updated.currentActivity = ''
            updated.permissionQueue = []
            updated.permissionDenied = null
            updated.messages = [
              ...updated.messages,
              { id: nextMsgId(), role: 'system', content: `Error: ${event.message}`, timestamp: Date.now() },
            ]
            break

          case 'session_dead':
            updated.status = 'dead'
            updated.activeRequestId = null
            updated.currentActivity = ''
            updated.permissionQueue = []
            updated.permissionDenied = null
            updated.retryState = updated.retryState
              ? {
                  ...updated.retryState,
                  isRetrying: false,
                  nextRetryAt: null,
                  lastError: `Session ended unexpectedly (exit ${event.exitCode})`,
                }
              : null
            updated.messages = [
              ...updated.messages,
              {
                id: nextMsgId(),
                role: 'system',
                content: `Session ended unexpectedly (exit ${event.exitCode})`,
                timestamp: Date.now(),
              },
            ]
            useNotificationStore.getState().addToast({
              type: 'error',
              title: 'Process crashed',
              message: `Session ended unexpectedly (exit ${event.exitCode})`,
            })
            break

          case 'permission_request': {
            const newReq: import('../../shared/types').PermissionRequest = {
              questionId: event.questionId,
              toolTitle: event.toolName,
              toolDescription: event.toolDescription,
              toolInput: event.toolInput,
              options: event.options.map((o) => ({
                optionId: o.id,
                kind: o.kind,
                label: o.label,
              })),
            }
            updated.permissionQueue = [...updated.permissionQueue, newReq]
            updated.currentActivity = `Waiting for permission: ${event.toolName}`
            break
          }

          case 'rate_limit':
            if (event.status !== 'allowed') {
              updated.messages = [
                ...updated.messages,
                {
                  id: nextMsgId(),
                  role: 'system',
                  content: `Rate limited (${event.rateLimitType}). Resets at ${new Date(event.resetsAt).toLocaleTimeString()}.`,
                  timestamp: Date.now(),
                },
              ]
            }
            break
        }

        return updated
      })

      return { tabs }
    })

    if (event.type !== 'session_dead') return

    const tab = get().tabs.find((t) => t.id === tabId)
    if (!tab) return

    const { autoResumeEnabled, autoResumeMaxRetries } = useThemeStore.getState()
    const maxAttempts = autoResumeMaxRetries || DEFAULT_AUTO_RESUME_MAX_RETRIES
    const currentAttempt = tab.retryState?.attempt ?? 0

    const shouldRetry = canScheduleAutoResume({
      enabled: autoResumeEnabled,
      currentAttempt,
      maxAttempts,
      hasRunOptions: !!tab.lastRunOptions,
      isAlreadyRetrying: tab.retryState?.isRetrying ?? false,
    })

    if (!shouldRetry) {
      if (autoResumeEnabled && tab.lastRunOptions && currentAttempt >= maxAttempts) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  retryState: {
                    isRetrying: false,
                    attempt: currentAttempt,
                    maxAttempts,
                    nextRetryAt: null,
                    lastError: `Session ended unexpectedly (exit ${event.exitCode})`,
                    exhausted: true,
                  },
                  currentActivity: '',
                }
              : t
          ),
        }))
      }
      return
    }

    const attempt = currentAttempt + 1
    const delay = getAutoResumeDelayMs(attempt)
    const nextRetryAt = delay > 0 ? Date.now() + delay : null

    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              retryState: {
                isRetrying: true,
                attempt,
                maxAttempts,
                nextRetryAt,
                lastError: `Session ended unexpectedly (exit ${event.exitCode})`,
              },
              currentActivity: delay === 0 ? 'Reconnecting...' : t.currentActivity,
            }
          : t
      ),
    }))

    clearRetryTimer(tabId)

    const triggerRetry = () => {
      retryTimers.delete(tabId)
      const currentTab = get().tabs.find((t) => t.id === tabId)
      if (!currentTab?.lastRunOptions) return
      if (currentTab.retryState?.stopped || currentTab.retryState?.exhausted) return

      const requestId = crypto.randomUUID()

      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                status: 'connecting' as TabStatus,
                activeRequestId: requestId,
                currentActivity: 'Reconnecting...',
                retryState: t.retryState
                  ? {
                      ...t.retryState,
                      isRetrying: true,
                      nextRetryAt: null,
                    }
                  : null,
              }
            : t
        ),
      }))

      void window.clui.retry(tabId, requestId, currentTab.lastRunOptions).catch((err: Error) => {
        get().handleError(tabId, {
          message: err.message,
          stderrTail: [],
          exitCode: null,
          elapsedMs: 0,
          toolCallCount: 0,
        })
      })
    }

    if (delay === 0) {
      setTimeout(triggerRetry, 0)
    } else {
      retryTimers.set(tabId, setTimeout(triggerRetry, delay))
    }
  },

  handleStatusChange: (tabId, newStatus) => {
    if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'idle') {
      clearRetryTimer(tabId)
    }

    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              status: newStatus as TabStatus,
              // Clear activity when transitioning to idle (e.g., after warmup init)
              ...(newStatus === 'idle' ? { currentActivity: '', permissionQueue: [] as import('../../shared/types').PermissionRequest[], permissionDenied: null } : {}),
              ...((newStatus === 'completed' || newStatus === 'failed')
                ? { retryState: null }
                : {}),
            }
          : t
      ),
    }))
  },

  handleError: (tabId, error) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t

        // Deduplicate: skip if the last message is already an error for this failure
        const lastMsg = t.messages[t.messages.length - 1]
        const alreadyHasError = lastMsg?.role === 'system' && lastMsg.content.startsWith('Error:')

        return {
          ...t,
          status: 'failed' as TabStatus,
          activeRequestId: null,
          currentActivity: '',
          permissionQueue: [],
          retryState: t.retryState,
          messages: alreadyHasError
            ? t.messages
            : [
                ...t.messages,
                {
                  id: nextMsgId(),
                  role: 'system' as const,
                  content: `Error: ${error.message}${error.stderrTail.length > 0 ? '\n\n' + error.stderrTail.slice(-5).join('\n') : ''}`,
                  timestamp: Date.now(),
                },
              ],
        }
      }),
    }))
    useNotificationStore.getState().addToast({
      type: 'error',
      title: 'Error',
      message: error.message,
    })
  },
}))
