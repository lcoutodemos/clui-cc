import { create } from 'zustand'
import { useSessionStore } from './sessionStore'

export interface ComparisonGroup {
  id: string
  tabIdA: string
  tabIdB: string
  modelA: string
  modelB: string
  prompt: string
  createdAt: number
}

interface ComparisonState {
  activeComparison: ComparisonGroup | null
  launcherOpen: boolean
  openLauncher: () => void
  closeLauncher: () => void
  startComparison: (modelA: string, modelB: string) => Promise<void>
  sendComparisonPrompt: (prompt: string) => void
  endComparison: () => void
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  activeComparison: null,
  launcherOpen: false,

  openLauncher: () => {
    set({ launcherOpen: true })
  },

  closeLauncher: () => {
    set({ launcherOpen: false })
  },

  startComparison: async (modelA: string, modelB: string) => {
    const sessionStore = useSessionStore.getState()

    // Create two tabs — each one is a normal ControlPlane tab
    const tabIdA = await sessionStore.createTab()
    const tabIdB = await sessionStore.createTab()

    // Set different models on each tab
    // We do this by directly updating the store state to set per-tab model overrides
    // Since setPreferredModel is global, we use the tab-level approach:
    // We'll store the model in the comparison group and apply it when sending prompts

    const group: ComparisonGroup = {
      id: crypto.randomUUID(),
      tabIdA,
      tabIdB,
      modelA,
      modelB,
      prompt: '',
      createdAt: Date.now(),
    }

    set({ activeComparison: group, launcherOpen: false })
  },

  sendComparisonPrompt: (prompt: string) => {
    const { activeComparison } = get()
    if (!activeComparison) return

    const sessionStore = useSessionStore.getState()
    const { tabIdA, tabIdB, modelA, modelB } = activeComparison

    // Update stored prompt
    set({
      activeComparison: { ...activeComparison, prompt },
    })

    // Send to tab A with model A
    const originalModel = sessionStore.preferredModel
    sessionStore.setPreferredModel(modelA)
    // Select tab A to make it the active tab for sendMessage
    sessionStore.selectTab(tabIdA)
    // Expand if collapsed so messages render
    if (!sessionStore.isExpanded) {
      sessionStore.toggleExpanded()
    }
    sessionStore.sendMessage(prompt)

    // Send to tab B with model B
    sessionStore.setPreferredModel(modelB)
    sessionStore.selectTab(tabIdB)
    sessionStore.sendMessage(prompt)

    // Restore original model preference
    sessionStore.setPreferredModel(originalModel)

    // Select tab A as the "primary" view (ComparisonView shows both anyway)
    sessionStore.selectTab(tabIdA)
  },

  endComparison: () => {
    const { activeComparison } = get()
    if (!activeComparison) return

    const sessionStore = useSessionStore.getState()

    // Close both comparison tabs
    sessionStore.closeTab(activeComparison.tabIdA)
    sessionStore.closeTab(activeComparison.tabIdB)

    set({ activeComparison: null })
  },
}))
