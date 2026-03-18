// Store tests — no DOM needed

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock window.clui
const mockClui = {
  terminalCreate: vi.fn().mockResolvedValue({ termTabId: 'mock-term-1' }),
  terminalClose: vi.fn().mockResolvedValue(undefined),
  terminalAvailable: vi.fn().mockResolvedValue(true),
}
Object.defineProperty(globalThis, 'window', {
  value: { ...globalThis.window, clui: mockClui, dispatchEvent: vi.fn() },
  writable: true,
})

// Mock navigator.platform
Object.defineProperty(globalThis, 'navigator', {
  value: { ...globalThis.navigator, platform: 'Win32' },
  writable: true,
})

import { useTerminalStore } from '../../src/renderer/stores/terminalStore'

describe('TerminalStore', () => {
  beforeEach(() => {
    useTerminalStore.setState({
      termTabs: [],
      activeTermTabId: null,
      terminalMode: false,
      ptyAvailable: true,
      fontSize: 13,
    })
    vi.clearAllMocks()
  })

  it('starts with terminal mode off', () => {
    expect(useTerminalStore.getState().terminalMode).toBe(false)
  })

  it('starts with no terminal tabs', () => {
    expect(useTerminalStore.getState().termTabs).toHaveLength(0)
  })

  it('toggleMode flips terminalMode', () => {
    useTerminalStore.getState().toggleMode()
    expect(useTerminalStore.getState().terminalMode).toBe(true)
    useTerminalStore.getState().toggleMode()
    expect(useTerminalStore.getState().terminalMode).toBe(false)
  })

  it('toggleMode does nothing when ptyAvailable is false', () => {
    useTerminalStore.setState({ ptyAvailable: false })
    useTerminalStore.getState().toggleMode()
    expect(useTerminalStore.getState().terminalMode).toBe(false)
  })

  it('createTermTab adds a tab and sets it active', async () => {
    const id = await useTerminalStore.getState().createTermTab()
    expect(id).toBe('mock-term-1')
    const state = useTerminalStore.getState()
    expect(state.termTabs).toHaveLength(1)
    expect(state.termTabs[0].id).toBe('mock-term-1')
    expect(state.termTabs[0].status).toBe('active')
    expect(state.activeTermTabId).toBe('mock-term-1')
  })

  it('closeTermTab removes tab and calls IPC', async () => {
    await useTerminalStore.getState().createTermTab()
    useTerminalStore.getState().closeTermTab('mock-term-1')
    expect(useTerminalStore.getState().termTabs).toHaveLength(0)
    expect(mockClui.terminalClose).toHaveBeenCalledWith('mock-term-1')
  })

  it('setActiveTermTab changes active tab', async () => {
    mockClui.terminalCreate
      .mockResolvedValueOnce({ termTabId: 'term-a' })
      .mockResolvedValueOnce({ termTabId: 'term-b' })
    await useTerminalStore.getState().createTermTab()
    await useTerminalStore.getState().createTermTab()
    useTerminalStore.getState().setActiveTermTab('term-a')
    expect(useTerminalStore.getState().activeTermTabId).toBe('term-a')
  })

  it('handleTerminalExit sets tab status to exited', async () => {
    await useTerminalStore.getState().createTermTab()
    useTerminalStore.getState().handleTerminalExit('mock-term-1', 0)
    const tab = useTerminalStore.getState().termTabs.find((t) => t.id === 'mock-term-1')
    expect(tab?.status).toBe('exited')
    expect(tab?.exitCode).toBe(0)
  })

  it('setFontSize clamps between 9 and 24', () => {
    useTerminalStore.getState().setFontSize(5)
    expect(useTerminalStore.getState().fontSize).toBe(9)
    useTerminalStore.getState().setFontSize(30)
    expect(useTerminalStore.getState().fontSize).toBe(24)
    useTerminalStore.getState().setFontSize(16)
    expect(useTerminalStore.getState().fontSize).toBe(16)
  })

  it('checkAvailability sets ptyAvailable', async () => {
    useTerminalStore.setState({ ptyAvailable: null })
    await useTerminalStore.getState().checkAvailability()
    expect(useTerminalStore.getState().ptyAvailable).toBe(true)
  })
})
