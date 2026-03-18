import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findShortcutConflict, getDefaultShortcutBindings, keyboardEventToShortcut } from '../../src/shared/keyboard-shortcuts'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

describe('keyboard shortcuts', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    })
  })

  it('builds platform-aware default bindings', () => {
    const windowsBindings = getDefaultShortcutBindings(false)
    const macBindings = getDefaultShortcutBindings(true)

    expect(windowsBindings.find((binding) => binding.id === 'command-palette')?.currentKeys).toBe('Ctrl+K')
    expect(macBindings.find((binding) => binding.id === 'command-palette')?.currentKeys).toBe('Cmd+K')
    expect(windowsBindings.find((binding) => binding.id === 'move-tab-left')?.currentKeys).toBe('Alt+Shift+Left')
  })

  it('normalizes keyboard events into shortcut strings', () => {
    expect(keyboardEventToShortcut({
      key: 'k',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    } as KeyboardEvent, false)).toBe('Ctrl+K')

    expect(keyboardEventToShortcut({
      key: 'Tab',
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
      altKey: false,
    } as KeyboardEvent, true)).toBe('Cmd+Shift+Tab')

    expect(keyboardEventToShortcut({
      key: 'ArrowLeft',
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      altKey: true,
    } as KeyboardEvent, false)).toBe('Alt+Shift+Left')
  })

  it('detects shortcut conflicts', () => {
    const bindings = getDefaultShortcutBindings(false)
    const conflict = findShortcutConflict(bindings, 'next-tab', 'Ctrl+Shift+Tab')

    expect(conflict?.id).toBe('previous-tab')
  })

  it('swaps conflicting bindings when override is confirmed', async () => {
    const { useShortcutStore } = await import('../../src/renderer/stores/shortcutStore')

    useShortcutStore.getState().startCapture('next-tab')
    const result = useShortcutStore.getState().applyCapturedKeys('Ctrl+Shift+Tab')

    expect(result.ok).toBe(false)
    expect(result.conflict?.id).toBe('previous-tab')

    useShortcutStore.getState().confirmOverride()
    const shortcutMap = useShortcutStore.getState().getShortcutMap()

    expect(shortcutMap['next-tab']).toBe('Ctrl+Shift+Tab')
    expect(shortcutMap['previous-tab']).toBe('Ctrl+Tab')
  })
})
