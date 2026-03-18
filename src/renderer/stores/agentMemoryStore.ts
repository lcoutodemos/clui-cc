import { create } from 'zustand'
import type {
  AgentAssignment,
  AgentMemoryClaimResult,
  AgentMemorySnapshot,
  TabState,
} from '../../shared/types'
import { getAgentLabel, getResolvedProjectPath, type StaticInfo } from './sessionStore.shared'

interface AgentMemoryContext {
  activeTabId: string
  tabs: TabState[]
  staticInfo: Pick<StaticInfo, 'homePath'> | null
}

interface AgentMemoryDeps {
  agentMemoryGet: (projectPath: string) => Promise<AgentMemorySnapshot>
  agentMemoryFocus: (
    tabId: string,
    projectPath: string,
    agentLabel: string,
    summary: string,
  ) => Promise<{ snapshot: AgentMemorySnapshot }>
  agentMemoryClaim: (
    tabId: string,
    projectPath: string,
    agentLabel: string,
    workKey: string,
    summary: string,
  ) => Promise<AgentMemoryClaimResult>
  agentMemoryDone: (
    tabId: string,
    note?: string,
  ) => Promise<{ ok: boolean; snapshot: AgentMemorySnapshot | null }>
  agentMemoryRelease: (
    tabId: string,
  ) => Promise<{ ok: boolean; snapshots: AgentMemorySnapshot[] }>
  getContext: () => AgentMemoryContext
  commitSnapshot: (
    nextSnapshot: AgentMemorySnapshot | null,
    updater: (
      tabs: TabState[],
      staticInfo: Pick<StaticInfo, 'homePath'> | null,
    ) => TabState[],
  ) => void
}

const defaultAgentMemoryDeps: AgentMemoryDeps = {
  agentMemoryGet: (projectPath) => window.clui.agentMemoryGet(projectPath),
  agentMemoryFocus: (tabId, projectPath, agentLabel, summary) =>
    window.clui.agentMemoryFocus(tabId, projectPath, agentLabel, summary),
  agentMemoryClaim: (tabId, projectPath, agentLabel, workKey, summary) =>
    window.clui.agentMemoryClaim(tabId, projectPath, agentLabel, workKey, summary),
  agentMemoryDone: (tabId, note) => window.clui.agentMemoryDone(tabId, note),
  agentMemoryRelease: (tabId) => window.clui.agentMemoryRelease(tabId),
  getContext: () => ({
    activeTabId: '',
    tabs: [],
    staticInfo: null,
  }),
  commitSnapshot: () => {},
}

export interface AgentMemoryStoreState {
  snapshot: AgentMemorySnapshot | null
  refreshAgentMemory: (projectPath?: string) => Promise<AgentMemorySnapshot | null>
  setAgentFocus: (summary: string) => Promise<AgentAssignment | null>
  claimAgentWork: (workKey: string, summary: string) => Promise<AgentMemoryClaimResult | null>
  markAgentDone: (note?: string) => Promise<boolean>
  releaseAgentWork: () => Promise<boolean>
}

export function applyAgentMemorySnapshotToTabs(
  tabs: TabState[],
  snapshot: AgentMemorySnapshot | null,
  staticInfo: Pick<StaticInfo, 'homePath'> | null,
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

export function configureAgentMemoryStore(overrides: Partial<AgentMemoryDeps>): void {
  Object.assign(defaultAgentMemoryDeps, overrides)
}

export function createAgentMemoryStore(deps: AgentMemoryDeps = defaultAgentMemoryDeps) {
  return create<AgentMemoryStoreState>((set, get) => ({
    snapshot: null,

    refreshAgentMemory: async (projectPath) => {
      const { activeTabId, tabs, staticInfo } = deps.getContext()
      const activeTab = tabs.find((tab) => tab.id === activeTabId)
      const resolvedProjectPath = projectPath || getResolvedProjectPath(activeTab, staticInfo)

      try {
        const snapshot = await deps.agentMemoryGet(resolvedProjectPath)
        deps.commitSnapshot(snapshot, (nextTabs, nextStaticInfo) =>
          applyAgentMemorySnapshotToTabs(nextTabs, snapshot, nextStaticInfo),
        )
        set({ snapshot })
        return snapshot
      } catch {
        return null
      }
    },

    setAgentFocus: async (summary) => {
      const { activeTabId, tabs, staticInfo } = deps.getContext()
      const tab = tabs.find((item) => item.id === activeTabId)
      if (!tab) {
        return null
      }

      const projectPath = getResolvedProjectPath(tab, staticInfo)
      const result = await deps.agentMemoryFocus(
        activeTabId,
        projectPath,
        getAgentLabel(activeTabId, tabs),
        summary,
      )

      deps.commitSnapshot(result.snapshot, (nextTabs, nextStaticInfo) =>
        applyAgentMemorySnapshotToTabs(nextTabs, result.snapshot, nextStaticInfo),
      )
      set({ snapshot: result.snapshot })
      return result.snapshot.active.find((assignment) => assignment.tabId === activeTabId) || null
    },

    claimAgentWork: async (workKey, summary) => {
      const { activeTabId, tabs, staticInfo } = deps.getContext()
      const tab = tabs.find((item) => item.id === activeTabId)
      if (!tab) {
        return null
      }

      const projectPath = getResolvedProjectPath(tab, staticInfo)
      const result = await deps.agentMemoryClaim(
        activeTabId,
        projectPath,
        getAgentLabel(activeTabId, tabs),
        workKey,
        summary,
      )

      deps.commitSnapshot(result.snapshot, (nextTabs, nextStaticInfo) =>
        applyAgentMemorySnapshotToTabs(nextTabs, result.snapshot, nextStaticInfo),
      )
      set({ snapshot: result.snapshot })
      return result
    },

    markAgentDone: async (note) => {
      const { activeTabId } = deps.getContext()
      const result = await deps.agentMemoryDone(activeTabId, note)
      const nextSnapshot = result.snapshot ?? get().snapshot

      deps.commitSnapshot(nextSnapshot, (nextTabs, nextStaticInfo) => (
        result.snapshot
          ? applyAgentMemorySnapshotToTabs(nextTabs, result.snapshot, nextStaticInfo)
          : nextTabs.map((tab) => tab.id === activeTabId ? { ...tab, agentAssignment: null } : tab)
      ))
      set({ snapshot: nextSnapshot })
      return result.ok
    },

    releaseAgentWork: async () => {
      const { activeTabId } = deps.getContext()
      const result = await deps.agentMemoryRelease(activeTabId)
      const currentSnapshot = get().snapshot

      let nextSnapshot = currentSnapshot
      if (currentSnapshot) {
        const replacement = result.snapshots.find((snapshot) => snapshot.projectPath === currentSnapshot.projectPath)
        if (replacement) {
          nextSnapshot = replacement
        }
      }

      deps.commitSnapshot(nextSnapshot, (nextTabs, nextStaticInfo) => {
        let updatedTabs = nextTabs.map((tab) => tab.id === activeTabId ? { ...tab, agentAssignment: null } : tab)
        for (const snapshot of result.snapshots) {
          updatedTabs = applyAgentMemorySnapshotToTabs(updatedTabs, snapshot, nextStaticInfo)
        }
        return updatedTabs
      })
      set({ snapshot: nextSnapshot })
      return result.ok
    },
  }))
}

export const useAgentMemoryStore = createAgentMemoryStore()
