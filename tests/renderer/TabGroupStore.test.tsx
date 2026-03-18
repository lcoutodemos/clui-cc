// Store tests — no DOM needed

import { beforeEach, describe, expect, it } from 'vitest'
import { useTabGroupStore } from '../../src/renderer/stores/tabGroupStore'

describe('TabGroupStore', () => {
  beforeEach(() => {
    useTabGroupStore.setState({
      groups: [],
      contextMenuTabId: null,
      contextMenuPosition: null,
    })
  })

  it('starts with no groups', () => {
    expect(useTabGroupStore.getState().groups).toHaveLength(0)
  })

  it('createGroup() adds a group and returns its id', () => {
    const id = useTabGroupStore.getState().createGroup('Backend')
    expect(id).toBeDefined()
    const groups = useTabGroupStore.getState().groups
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Backend')
    expect(groups[0].collapsed).toBe(false)
  })

  it('createGroup() with color sets the color', () => {
    useTabGroupStore.getState().createGroup('Frontend', 'blue')
    const group = useTabGroupStore.getState().groups[0]
    expect(group.color).toBe('blue')
  })

  it('deleteGroup() removes by id', () => {
    const id = useTabGroupStore.getState().createGroup('Temp')
    useTabGroupStore.getState().deleteGroup(id)
    expect(useTabGroupStore.getState().groups).toHaveLength(0)
  })

  it('renameGroup() updates name', () => {
    const id = useTabGroupStore.getState().createGroup('Old')
    useTabGroupStore.getState().renameGroup(id, 'New')
    expect(useTabGroupStore.getState().groups[0].name).toBe('New')
  })

  it('toggleCollapsed() flips collapsed state', () => {
    const id = useTabGroupStore.getState().createGroup('Test')
    expect(useTabGroupStore.getState().groups[0].collapsed).toBe(false)
    useTabGroupStore.getState().toggleCollapsed(id)
    expect(useTabGroupStore.getState().groups[0].collapsed).toBe(true)
    useTabGroupStore.getState().toggleCollapsed(id)
    expect(useTabGroupStore.getState().groups[0].collapsed).toBe(false)
  })

  it('openContextMenu() sets tab id and position', () => {
    useTabGroupStore.getState().openContextMenu('tab-1', { x: 100, y: 200 })
    const state = useTabGroupStore.getState()
    expect(state.contextMenuTabId).toBe('tab-1')
    expect(state.contextMenuPosition).toEqual({ x: 100, y: 200 })
  })

  it('closeContextMenu() clears context menu state', () => {
    useTabGroupStore.getState().openContextMenu('tab-1', { x: 100, y: 200 })
    useTabGroupStore.getState().closeContextMenu()
    const state = useTabGroupStore.getState()
    expect(state.contextMenuTabId).toBeNull()
    expect(state.contextMenuPosition).toBeNull()
  })
})
