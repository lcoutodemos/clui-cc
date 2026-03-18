import { create } from 'zustand'
import type { TabGroup } from '../../shared/types'

const STORAGE_KEY = 'clui-tab-groups'

function loadGroups(): TabGroup[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (g: unknown): g is TabGroup =>
        typeof g === 'object' &&
        g !== null &&
        typeof (g as TabGroup).id === 'string' &&
        typeof (g as TabGroup).name === 'string' &&
        typeof (g as TabGroup).collapsed === 'boolean' &&
        typeof (g as TabGroup).order === 'number',
    )
  } catch {
    return []
  }
}

function saveGroups(groups: TabGroup[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
  } catch {}
}

export const GROUP_COLORS: Record<NonNullable<TabGroup['color']>, string> = {
  red: '#ef4444',
  orange: '#f97316',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
}

export interface TabGroupState {
  groups: TabGroup[]
  contextMenuTabId: string | null
  contextMenuPosition: { x: number; y: number } | null
  createGroup: (name: string, color?: TabGroup['color']) => string
  deleteGroup: (groupId: string) => void
  renameGroup: (groupId: string, name: string) => void
  setGroupColor: (groupId: string, color: TabGroup['color']) => void
  toggleCollapsed: (groupId: string) => void
  openContextMenu: (tabId: string, position: { x: number; y: number }) => void
  closeContextMenu: () => void
}

export const useTabGroupStore = create<TabGroupState>((set, get) => ({
  groups: loadGroups(),
  contextMenuTabId: null,
  contextMenuPosition: null,

  createGroup: (name, color) => {
    const id = crypto.randomUUID()
    const maxOrder = get().groups.reduce((max, g) => Math.max(max, g.order), -1)
    const group: TabGroup = {
      id,
      name,
      color,
      collapsed: false,
      order: maxOrder + 1,
    }
    const next = [...get().groups, group]
    set({ groups: next })
    saveGroups(next)
    return id
  },

  deleteGroup: (groupId) => {
    const next = get().groups.filter((g) => g.id !== groupId)
    set({ groups: next })
    saveGroups(next)
  },

  renameGroup: (groupId, name) => {
    const next = get().groups.map((g) => (g.id === groupId ? { ...g, name } : g))
    set({ groups: next })
    saveGroups(next)
  },

  setGroupColor: (groupId, color) => {
    const next = get().groups.map((g) => (g.id === groupId ? { ...g, color } : g))
    set({ groups: next })
    saveGroups(next)
  },

  toggleCollapsed: (groupId) => {
    const next = get().groups.map((g) =>
      g.id === groupId ? { ...g, collapsed: !g.collapsed } : g,
    )
    set({ groups: next })
    saveGroups(next)
  },

  openContextMenu: (tabId, position) => {
    set({ contextMenuTabId: tabId, contextMenuPosition: position })
  },

  closeContextMenu: () => {
    set({ contextMenuTabId: null, contextMenuPosition: null })
  },
}))
