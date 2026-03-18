import { describe, expect, it, beforeEach, vi } from 'vitest'

// Mock localStorage before importing the store.
// vitest environment is 'node' so localStorage doesn't exist by default.
const storage = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => { storage.clear() },
    get length() { return storage.size },
    key: () => null,
  },
  writable: true,
  configurable: true,
})

// Import after mocking
const { useTabGroupStore, GROUP_COLORS } = await import('../../src/renderer/stores/tabGroupStore')

describe('tabGroupStore', () => {
  beforeEach(() => {
    storage.clear()
    // Reset store state
    useTabGroupStore.setState({
      groups: [],
      contextMenuTabId: null,
      contextMenuPosition: null,
    })
  })

  it('createGroup adds group with correct structure', () => {
    const id = useTabGroupStore.getState().createGroup('Frontend', 'blue')

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)

    const groups = useTabGroupStore.getState().groups
    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual({
      id,
      name: 'Frontend',
      color: 'blue',
      collapsed: false,
      order: 0,
    })
  })

  it('createGroup increments order for successive groups', () => {
    useTabGroupStore.getState().createGroup('First')
    useTabGroupStore.getState().createGroup('Second', 'red')

    const groups = useTabGroupStore.getState().groups
    expect(groups).toHaveLength(2)
    expect(groups[0].order).toBe(0)
    expect(groups[1].order).toBe(1)
  })

  it('createGroup without color leaves color undefined', () => {
    useTabGroupStore.getState().createGroup('NoColor')
    expect(useTabGroupStore.getState().groups[0].color).toBeUndefined()
  })

  it('deleteGroup removes group', () => {
    const id = useTabGroupStore.getState().createGroup('ToDelete')
    expect(useTabGroupStore.getState().groups).toHaveLength(1)

    useTabGroupStore.getState().deleteGroup(id)
    expect(useTabGroupStore.getState().groups).toHaveLength(0)
  })

  it('deleteGroup with unknown id is a no-op', () => {
    useTabGroupStore.getState().createGroup('Keep')
    useTabGroupStore.getState().deleteGroup('nonexistent')
    expect(useTabGroupStore.getState().groups).toHaveLength(1)
  })

  it('renameGroup updates name', () => {
    const id = useTabGroupStore.getState().createGroup('OldName')
    useTabGroupStore.getState().renameGroup(id, 'NewName')

    expect(useTabGroupStore.getState().groups[0].name).toBe('NewName')
  })

  it('setGroupColor updates color', () => {
    const id = useTabGroupStore.getState().createGroup('Colored', 'red')
    expect(useTabGroupStore.getState().groups[0].color).toBe('red')

    useTabGroupStore.getState().setGroupColor(id, 'purple')
    expect(useTabGroupStore.getState().groups[0].color).toBe('purple')
  })

  it('toggleCollapsed flips state', () => {
    const id = useTabGroupStore.getState().createGroup('Toggle')
    expect(useTabGroupStore.getState().groups[0].collapsed).toBe(false)

    useTabGroupStore.getState().toggleCollapsed(id)
    expect(useTabGroupStore.getState().groups[0].collapsed).toBe(true)

    useTabGroupStore.getState().toggleCollapsed(id)
    expect(useTabGroupStore.getState().groups[0].collapsed).toBe(false)
  })

  it('persists groups to localStorage on create', () => {
    useTabGroupStore.getState().createGroup('Persisted', 'green')

    const raw = storage.get('clui-tab-groups')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('Persisted')
    expect(parsed[0].color).toBe('green')
  })

  it('localStorage is updated on every mutation', () => {
    const id = useTabGroupStore.getState().createGroup('Test')

    // Rename
    useTabGroupStore.getState().renameGroup(id, 'Renamed')
    let parsed = JSON.parse(storage.get('clui-tab-groups')!)
    expect(parsed[0].name).toBe('Renamed')

    // Color
    useTabGroupStore.getState().setGroupColor(id, 'pink')
    parsed = JSON.parse(storage.get('clui-tab-groups')!)
    expect(parsed[0].color).toBe('pink')

    // Toggle
    useTabGroupStore.getState().toggleCollapsed(id)
    parsed = JSON.parse(storage.get('clui-tab-groups')!)
    expect(parsed[0].collapsed).toBe(true)

    // Delete
    useTabGroupStore.getState().deleteGroup(id)
    parsed = JSON.parse(storage.get('clui-tab-groups')!)
    expect(parsed).toHaveLength(0)
  })

  it('openContextMenu sets tabId and position', () => {
    useTabGroupStore.getState().openContextMenu('tab-1', { x: 100, y: 200 })

    expect(useTabGroupStore.getState().contextMenuTabId).toBe('tab-1')
    expect(useTabGroupStore.getState().contextMenuPosition).toEqual({ x: 100, y: 200 })
  })

  it('closeContextMenu resets tabId and position', () => {
    useTabGroupStore.getState().openContextMenu('tab-1', { x: 100, y: 200 })
    useTabGroupStore.getState().closeContextMenu()

    expect(useTabGroupStore.getState().contextMenuTabId).toBeNull()
    expect(useTabGroupStore.getState().contextMenuPosition).toBeNull()
  })

  it('GROUP_COLORS has all 6 expected colors', () => {
    expect(Object.keys(GROUP_COLORS)).toEqual(['red', 'orange', 'green', 'blue', 'purple', 'pink'])
    // All values should be hex color strings
    for (const value of Object.values(GROUP_COLORS)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
