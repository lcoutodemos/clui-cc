import { configureAgentMemoryStore } from './agentMemoryStore'
import { configurePermissionStore } from './permissionStore'
import { useSessionStore as sessionStore } from './sessionStore.impl'

export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
] as const

export const useSessionStore = sessionStore

configurePermissionStore({
  afterRespond: (tabId, questionId) => {
    useSessionStore.setState((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== tabId) return tab
        const remaining = tab.permissionQueue.filter((item) => item.questionId !== questionId)
        return {
          ...tab,
          permissionQueue: remaining,
          currentActivity: remaining.length > 0
            ? `Waiting for permission: ${remaining[0].toolTitle}`
            : 'Working...',
        }
      }),
    }))
  },
})

configureAgentMemoryStore({
  getContext: () => ({
    activeTabId: useSessionStore.getState().activeTabId,
    tabs: useSessionStore.getState().tabs,
    staticInfo: useSessionStore.getState().staticInfo,
  }),
  commitSnapshot: (nextSnapshot, updater) => {
    useSessionStore.setState((state) => ({
      agentMemorySnapshot: nextSnapshot,
      tabs: updater(state.tabs, state.staticInfo),
    }))
  },
})
