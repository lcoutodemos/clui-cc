import { create } from 'zustand'
import type { TerminalTab, TerminalCreateOptions } from '../../shared/types'

const STORAGE_KEY = 'clui-terminal-mode'

interface TerminalState {
  termTabs: TerminalTab[]
  activeTermTabId: string | null
  terminalMode: boolean
  ptyAvailable: boolean | null
  fontSize: number

  checkAvailability: () => Promise<void>
  toggleMode: () => void
  createTermTab: (options?: TerminalCreateOptions) => Promise<string>
  closeTermTab: (id: string) => void
  setActiveTermTab: (id: string) => void
  handleTerminalExit: (termTabId: string, exitCode: number) => void
  setFontSize: (size: number) => void
}

function loadPersistedMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  termTabs: [],
  activeTermTabId: null,
  terminalMode: false,
  ptyAvailable: null,
  fontSize: 13,

  checkAvailability: async () => {
    try {
      const available = await window.clui.terminalAvailable()
      set({ ptyAvailable: available })
      // Restore persisted mode only if pty is available
      if (available && loadPersistedMode()) {
        set({ terminalMode: true })
      }
    } catch {
      set({ ptyAvailable: false })
    }
  },

  toggleMode: () => {
    const { ptyAvailable } = get()
    if (ptyAvailable === false) return
    set((s) => {
      const next = !s.terminalMode
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return { terminalMode: next }
    })
  },

  createTermTab: async (options?: TerminalCreateOptions) => {
    const result = await window.clui.terminalCreate(options)
    if (!result.termTabId) {
      throw new Error(result.error || 'Failed to create terminal')
    }

    const shell = options?.shell || (navigator.platform.includes('Win') ? 'cmd.exe' : 'bash')
    const cwd = options?.cwd || '~'

    const tab: TerminalTab = {
      id: result.termTabId,
      title: shell.split(/[\\/]/).pop() || shell,
      shell,
      cwd,
      status: 'active',
      exitCode: null,
    }

    set((s) => ({
      termTabs: [...s.termTabs, tab],
      activeTermTabId: result.termTabId,
    }))

    return result.termTabId!
  },

  closeTermTab: (id: string) => {
    window.clui.terminalClose(id).catch(() => {})
    set((s) => {
      const remaining = s.termTabs.filter((t) => t.id !== id)
      const newActive = s.activeTermTabId === id
        ? remaining[remaining.length - 1]?.id ?? null
        : s.activeTermTabId
      return { termTabs: remaining, activeTermTabId: newActive }
    })
  },

  setActiveTermTab: (id: string) => set({ activeTermTabId: id }),

  handleTerminalExit: (termTabId: string, exitCode: number) => {
    set((s) => ({
      termTabs: s.termTabs.map((t) =>
        t.id === termTabId ? { ...t, status: 'exited' as const, exitCode } : t
      ),
    }))
  },

  setFontSize: (size: number) => {
    const clamped = Math.max(9, Math.min(24, size))
    set({ fontSize: clamped })
    window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: 'font-size-changed', fontSize: clamped } }))
  },
}))
