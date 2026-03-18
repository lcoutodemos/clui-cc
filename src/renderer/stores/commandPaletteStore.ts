import { create } from 'zustand'
import {
  fuzzyFilter,
  addRecentCommand,
  getRecentCommands,
  type PaletteCommand,
} from '../../shared/command-palette'

const STORAGE_KEY = 'clui-recent-commands'

function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveRecentIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch { /* quota exceeded — ignore */ }
}

interface CommandPaletteState {
  isOpen: boolean
  searchQuery: string
  selectedIndex: number
  recentCommandIds: string[]

  open: () => void
  close: () => void
  toggle: () => void
  setSearch: (query: string) => void
  setSelectedIndex: (index: number) => void
  recordExecution: (commandId: string) => void
  getFilteredCommands: (commands: PaletteCommand[]) => PaletteCommand[]
  getRecentCommands: (commands: PaletteCommand[]) => PaletteCommand[]
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  isOpen: false,
  searchQuery: '',
  selectedIndex: 0,
  recentCommandIds: loadRecentIds(),

  open: () => set({ isOpen: true, searchQuery: '', selectedIndex: 0 }),
  close: () => set({ isOpen: false, searchQuery: '', selectedIndex: 0 }),
  toggle: () => {
    const { isOpen } = get()
    if (isOpen) {
      set({ isOpen: false, searchQuery: '', selectedIndex: 0 })
    } else {
      set({ isOpen: true, searchQuery: '', selectedIndex: 0 })
    }
  },

  setSearch: (query) => set({ searchQuery: query, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),

  recordExecution: (commandId) => {
    const next = addRecentCommand(get().recentCommandIds, commandId)
    set({ recentCommandIds: next })
    saveRecentIds(next)
  },

  getFilteredCommands: (commands) => {
    const { searchQuery } = get()
    return fuzzyFilter(commands, searchQuery)
  },

  getRecentCommands: (commands) => {
    return getRecentCommands(get().recentCommandIds, commands)
  },
}))
