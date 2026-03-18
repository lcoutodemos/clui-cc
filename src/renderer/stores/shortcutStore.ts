import { create } from 'zustand'
import { buildShortcutMap, findShortcutConflict, mergeShortcutOverrides, type ShortcutConflict } from '../../shared/keyboard-shortcuts'
import type { ShortcutBinding, ShortcutMap } from '../../shared/types'

interface PendingConflict {
  targetId: string
  keys: string
  conflict: ShortcutConflict
}

interface ShortcutState {
  bindings: ShortcutBinding[]
  settingsOpen: boolean
  captureTargetId: string | null
  pendingConflict: PendingConflict | null
  openSettings: () => void
  closeSettings: () => void
  startCapture: (id: string) => void
  cancelCapture: () => void
  applyCapturedKeys: (keys: string) => { ok: boolean; conflict?: ShortcutConflict }
  confirmOverride: () => void
  resetAll: () => void
  getShortcutMap: () => ShortcutMap
}

const STORAGE_KEY = 'clui-keyboard-shortcuts'

function loadOverrides(): ShortcutMap {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as ShortcutMap : {}
  } catch {
    return {}
  }
}

function saveOverrides(bindings: ShortcutBinding[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    const overrides: ShortcutMap = {}
    for (const binding of bindings) {
      if (binding.currentKeys !== binding.defaultKeys) {
        overrides[binding.id] = binding.currentKeys
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {}
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  bindings: mergeShortcutOverrides(loadOverrides()),
  settingsOpen: false,
  captureTargetId: null,
  pendingConflict: null,

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false, captureTargetId: null, pendingConflict: null }),

  startCapture: (id) => set({ captureTargetId: id, pendingConflict: null }),
  cancelCapture: () => set({ captureTargetId: null, pendingConflict: null }),

  applyCapturedKeys: (keys) => {
    const { captureTargetId, bindings } = get()
    if (!captureTargetId) return { ok: false }

    const current = bindings.find((binding) => binding.id === captureTargetId)
    if (!current) return { ok: false }
    if (current.currentKeys === keys) {
      set({ captureTargetId: null, pendingConflict: null })
      return { ok: true }
    }

    const conflict = findShortcutConflict(bindings, captureTargetId, keys)
    if (conflict) {
      set({
        pendingConflict: {
          targetId: captureTargetId,
          keys,
          conflict,
        },
      })
      return { ok: false, conflict }
    }

    const nextBindings = bindings.map((binding) =>
      binding.id === captureTargetId
        ? { ...binding, currentKeys: keys }
        : binding,
    )
    saveOverrides(nextBindings)
    set({ bindings: nextBindings, captureTargetId: null, pendingConflict: null })
    return { ok: true }
  },

  confirmOverride: () => {
    const { pendingConflict, bindings } = get()
    if (!pendingConflict) return

    const target = bindings.find((binding) => binding.id === pendingConflict.targetId)
    const conflict = bindings.find((binding) => binding.id === pendingConflict.conflict.id)
    if (!target || !conflict) return

    const nextBindings = bindings.map((binding) => {
      if (binding.id === target.id) {
        return { ...binding, currentKeys: pendingConflict.keys }
      }
      if (binding.id === conflict.id) {
        return { ...binding, currentKeys: target.currentKeys }
      }
      return binding
    })

    saveOverrides(nextBindings)
    set({ bindings: nextBindings, captureTargetId: null, pendingConflict: null })
  },

  resetAll: () => {
    const nextBindings = mergeShortcutOverrides({})
    saveOverrides(nextBindings)
    set({
      bindings: nextBindings,
      captureTargetId: null,
      pendingConflict: null,
    })
  },

  getShortcutMap: () => buildShortcutMap(get().bindings),
}))
