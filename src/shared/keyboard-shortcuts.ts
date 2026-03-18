import type { ShortcutBinding, ShortcutMap } from './types'

export type ShortcutActionId =
  | 'next-tab'
  | 'previous-tab'
  | 'move-tab-left'
  | 'move-tab-right'
  | 'new-tab'
  | 'close-tab'
  | 'toggle-expand'
  | 'focus-input'
  | 'command-palette'
  | 'open-history'
  | 'open-marketplace'
  | 'toggle-theme'

interface ShortcutDefinition {
  id: ShortcutActionId
  label: string
  category: ShortcutBinding['category']
  windows: string
  mac: string
}

export interface ShortcutConflict {
  id: ShortcutActionId
  label: string
}

const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  { id: 'next-tab', label: 'Next Tab', category: 'navigation', windows: 'Ctrl+Tab', mac: 'Cmd+Tab' },
  { id: 'previous-tab', label: 'Previous Tab', category: 'navigation', windows: 'Ctrl+Shift+Tab', mac: 'Cmd+Shift+Tab' },
  { id: 'move-tab-left', label: 'Move Tab Left', category: 'navigation', windows: 'Alt+Shift+Left', mac: 'Alt+Shift+Left' },
  { id: 'move-tab-right', label: 'Move Tab Right', category: 'navigation', windows: 'Alt+Shift+Right', mac: 'Alt+Shift+Right' },
  { id: 'new-tab', label: 'New Tab', category: 'navigation', windows: 'Ctrl+T', mac: 'Cmd+T' },
  { id: 'close-tab', label: 'Close Tab', category: 'navigation', windows: 'Ctrl+W', mac: 'Cmd+W' },
  { id: 'toggle-expand', label: 'Toggle Expand', category: 'view', windows: 'Ctrl+E', mac: 'Cmd+E' },
  { id: 'focus-input', label: 'Focus Input', category: 'view', windows: 'Ctrl+L', mac: 'Cmd+L' },
  { id: 'toggle-theme', label: 'Toggle Theme', category: 'view', windows: 'Ctrl+D', mac: 'Cmd+D' },
  { id: 'command-palette', label: 'Command Palette', category: 'actions', windows: 'Ctrl+K', mac: 'Cmd+K' },
  { id: 'open-history', label: 'Open History', category: 'actions', windows: 'Ctrl+H', mac: 'Cmd+H' },
  { id: 'open-marketplace', label: 'Open Marketplace', category: 'actions', windows: 'Ctrl+M', mac: 'Cmd+M' },
]

const SPECIAL_KEYS: Record<string, string> = {
  ' ': 'Space',
  Escape: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
}

export function getShortcutPlatform(isMac?: boolean): 'mac' | 'windows' {
  if (typeof isMac === 'boolean') {
    return isMac ? 'mac' : 'windows'
  }
  if (typeof navigator !== 'undefined') {
    return navigator.platform.toLowerCase().includes('mac') ? 'mac' : 'windows'
  }
  return process.platform === 'darwin' ? 'mac' : 'windows'
}

export function getDefaultShortcutBindings(isMac?: boolean): ShortcutBinding[] {
  const platform = getShortcutPlatform(isMac)
  return SHORTCUT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    category: definition.category,
    defaultKeys: platform === 'mac' ? definition.mac : definition.windows,
    currentKeys: platform === 'mac' ? definition.mac : definition.windows,
  }))
}

export function mergeShortcutOverrides(overrides: ShortcutMap, isMac?: boolean): ShortcutBinding[] {
  return getDefaultShortcutBindings(isMac).map((binding) => ({
    ...binding,
    currentKeys: overrides[binding.id] || binding.defaultKeys,
  }))
}

export function buildShortcutMap(bindings: ShortcutBinding[]): ShortcutMap {
  return bindings.reduce<ShortcutMap>((acc, binding) => {
    acc[binding.id] = binding.currentKeys
    return acc
  }, {})
}

export function findShortcutConflict(bindings: ShortcutBinding[], targetId: string, keys: string): ShortcutConflict | null {
  const match = bindings.find((binding) => binding.id !== targetId && binding.currentKeys === keys)
  return match ? { id: match.id as ShortcutActionId, label: match.label } : null
}

export function keyboardEventToShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
  isMac?: boolean,
): string | null {
  const platform = getShortcutPlatform(isMac)
  const parts: string[] = []

  if (platform === 'mac') {
    if (event.metaKey) parts.push('Cmd')
    if (event.ctrlKey) parts.push('Ctrl')
  } else if (event.ctrlKey) {
    parts.push('Ctrl')
  }

  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')

  const key = normalizeKey(event.key)
  if (!key) return null
  if (parts.length === 0) return null

  parts.push(key)
  return parts.join('+')
}

function normalizeKey(key: string): string | null {
  if (['Control', 'Meta', 'Shift', 'Alt'].includes(key)) {
    return null
  }
  if (SPECIAL_KEYS[key]) {
    return SPECIAL_KEYS[key]
  }
  if (key.length === 1) {
    return key.toUpperCase()
  }
  return key
}
