// Store tests — no DOM needed

import { beforeEach, describe, expect, it } from 'vitest'
import { useCommandPaletteStore } from '../../src/renderer/stores/commandPaletteStore'

describe('CommandPaletteStore', () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({
      isOpen: false,
      searchQuery: '',
      selectedIndex: 0,
      recentCommandIds: [],
    })
  })

  it('starts closed', () => {
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('open() sets isOpen to true and resets search', () => {
    useCommandPaletteStore.getState().open()
    const state = useCommandPaletteStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.searchQuery).toBe('')
    expect(state.selectedIndex).toBe(0)
  })

  it('close() sets isOpen to false', () => {
    useCommandPaletteStore.getState().open()
    useCommandPaletteStore.getState().close()
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('toggle() flips open state', () => {
    useCommandPaletteStore.getState().toggle()
    expect(useCommandPaletteStore.getState().isOpen).toBe(true)
    useCommandPaletteStore.getState().toggle()
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('setSearch() updates query and resets selectedIndex', () => {
    useCommandPaletteStore.getState().setSelectedIndex(5)
    useCommandPaletteStore.getState().setSearch('new tab')
    const state = useCommandPaletteStore.getState()
    expect(state.searchQuery).toBe('new tab')
    expect(state.selectedIndex).toBe(0)
  })

  it('recordExecution() adds to recent and deduplicates', () => {
    const store = useCommandPaletteStore.getState()
    store.recordExecution('cmd-a')
    store.recordExecution('cmd-b')
    store.recordExecution('cmd-a') // duplicate — should move to front
    const recent = useCommandPaletteStore.getState().recentCommandIds
    expect(recent[0]).toBe('cmd-a')
    expect(recent[1]).toBe('cmd-b')
    expect(recent.length).toBe(2)
  })
})
