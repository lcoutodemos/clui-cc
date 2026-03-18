// Store tests — no DOM needed

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useComparisonStore } from '../../src/renderer/stores/comparisonStore'

// Mock sessionStore
vi.mock('../../src/renderer/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      createTab: vi.fn().mockResolvedValue('mock-tab-id'),
      setPreferredModel: vi.fn(),
      sendMessage: vi.fn(),
      closeTab: vi.fn(),
    }),
  },
}))

describe('ComparisonStore', () => {
  beforeEach(() => {
    useComparisonStore.setState({
      activeComparison: null,
      launcherOpen: false,
    })
  })

  it('starts with no active comparison', () => {
    expect(useComparisonStore.getState().activeComparison).toBeNull()
  })

  it('starts with launcher closed', () => {
    expect(useComparisonStore.getState().launcherOpen).toBe(false)
  })

  it('openLauncher() sets launcherOpen to true', () => {
    useComparisonStore.getState().openLauncher()
    expect(useComparisonStore.getState().launcherOpen).toBe(true)
  })

  it('closeLauncher() sets launcherOpen to false', () => {
    useComparisonStore.getState().openLauncher()
    useComparisonStore.getState().closeLauncher()
    expect(useComparisonStore.getState().launcherOpen).toBe(false)
  })

  it('endComparison() clears activeComparison', () => {
    useComparisonStore.setState({
      activeComparison: {
        id: 'test',
        tabIdA: 'a',
        tabIdB: 'b',
        modelA: 'opus',
        modelB: 'sonnet',
        prompt: '',
        createdAt: Date.now(),
      },
    })
    useComparisonStore.getState().endComparison()
    expect(useComparisonStore.getState().activeComparison).toBeNull()
  })
})
