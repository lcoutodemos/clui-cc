import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock sessionStore before importing comparisonStore
const mockTabs: Array<{ id: string }> = []
let mockActiveTabId = ''
let mockPreferredModel: string | null = null
let mockIsExpanded = false

const mockCreateTab = vi.fn(async () => {
  const id = `tab-${mockTabs.length + 1}`
  mockTabs.push({ id })
  mockActiveTabId = id
  return id
})

const mockCloseTab = vi.fn((tabId: string) => {
  const idx = mockTabs.findIndex((t) => t.id === tabId)
  if (idx >= 0) mockTabs.splice(idx, 1)
})

const mockSelectTab = vi.fn((tabId: string) => {
  mockActiveTabId = tabId
})

const mockSetPreferredModel = vi.fn((model: string | null) => {
  mockPreferredModel = model
})

const mockSendMessage = vi.fn()

const mockToggleExpanded = vi.fn(() => {
  mockIsExpanded = !mockIsExpanded
})

vi.mock('../../src/renderer/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      tabs: mockTabs,
      activeTabId: mockActiveTabId,
      preferredModel: mockPreferredModel,
      isExpanded: mockIsExpanded,
      createTab: mockCreateTab,
      closeTab: mockCloseTab,
      selectTab: mockSelectTab,
      setPreferredModel: mockSetPreferredModel,
      sendMessage: mockSendMessage,
      toggleExpanded: mockToggleExpanded,
    }),
  },
}))

// Provide crypto.randomUUID for Node environment
if (!globalThis.crypto) {
  const { randomUUID } = await import('crypto')
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID },
    configurable: true,
  })
} else if (!globalThis.crypto.randomUUID) {
  const { randomUUID } = await import('crypto')
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: randomUUID,
    configurable: true,
  })
}

async function loadComparisonStore() {
  return import('../../src/renderer/stores/comparisonStore')
}

describe('comparisonStore', () => {
  beforeEach(() => {
    vi.resetModules()
    mockTabs.length = 0
    mockActiveTabId = ''
    mockPreferredModel = null
    mockIsExpanded = false
    mockCreateTab.mockClear()
    mockCloseTab.mockClear()
    mockSelectTab.mockClear()
    mockSetPreferredModel.mockClear()
    mockSendMessage.mockClear()
    mockToggleExpanded.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with no active comparison and launcher closed', async () => {
    const { useComparisonStore } = await loadComparisonStore()
    const state = useComparisonStore.getState()
    expect(state.activeComparison).toBeNull()
    expect(state.launcherOpen).toBe(false)
  })

  it('toggles launcher open and closed', async () => {
    const { useComparisonStore } = await loadComparisonStore()

    useComparisonStore.getState().openLauncher()
    expect(useComparisonStore.getState().launcherOpen).toBe(true)

    useComparisonStore.getState().closeLauncher()
    expect(useComparisonStore.getState().launcherOpen).toBe(false)
  })

  it('startComparison creates a group with two tab IDs', async () => {
    const { useComparisonStore } = await loadComparisonStore()

    await useComparisonStore.getState().startComparison('claude-opus-4-6', 'claude-sonnet-4-6')

    const state = useComparisonStore.getState()
    expect(state.activeComparison).not.toBeNull()
    expect(state.activeComparison!.tabIdA).toBe('tab-1')
    expect(state.activeComparison!.tabIdB).toBe('tab-2')
    expect(state.activeComparison!.modelA).toBe('claude-opus-4-6')
    expect(state.activeComparison!.modelB).toBe('claude-sonnet-4-6')
    expect(state.activeComparison!.prompt).toBe('')
    expect(state.activeComparison!.createdAt).toBeGreaterThan(0)
    expect(state.launcherOpen).toBe(false)

    expect(mockCreateTab).toHaveBeenCalledTimes(2)
  })

  it('sendComparisonPrompt stores the prompt and sends to both tabs', async () => {
    const { useComparisonStore } = await loadComparisonStore()

    await useComparisonStore.getState().startComparison('claude-opus-4-6', 'claude-sonnet-4-6')
    useComparisonStore.getState().sendComparisonPrompt('What is 2+2?')

    const state = useComparisonStore.getState()
    expect(state.activeComparison!.prompt).toBe('What is 2+2?')

    // Should have sent message twice (once per tab)
    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(mockSendMessage).toHaveBeenCalledWith('What is 2+2?')

    // Should have set model for each tab
    expect(mockSetPreferredModel).toHaveBeenCalledWith('claude-opus-4-6')
    expect(mockSetPreferredModel).toHaveBeenCalledWith('claude-sonnet-4-6')

    // Should restore original model at the end
    expect(mockSetPreferredModel).toHaveBeenLastCalledWith(null)
  })

  it('endComparison clears the state and closes tabs', async () => {
    const { useComparisonStore } = await loadComparisonStore()

    await useComparisonStore.getState().startComparison('claude-opus-4-6', 'claude-sonnet-4-6')
    expect(useComparisonStore.getState().activeComparison).not.toBeNull()

    useComparisonStore.getState().endComparison()

    expect(useComparisonStore.getState().activeComparison).toBeNull()
    expect(mockCloseTab).toHaveBeenCalledTimes(2)
    expect(mockCloseTab).toHaveBeenCalledWith('tab-1')
    expect(mockCloseTab).toHaveBeenCalledWith('tab-2')
  })

  it('endComparison is a no-op when no comparison is active', async () => {
    const { useComparisonStore } = await loadComparisonStore()

    useComparisonStore.getState().endComparison()
    expect(mockCloseTab).not.toHaveBeenCalled()
    expect(useComparisonStore.getState().activeComparison).toBeNull()
  })

  it('sendComparisonPrompt is a no-op when no comparison is active', async () => {
    const { useComparisonStore } = await loadComparisonStore()

    useComparisonStore.getState().sendComparisonPrompt('hello')
    expect(mockSendMessage).not.toHaveBeenCalled()
  })
})
