// Store tests — no DOM needed

import { beforeEach, describe, expect, it } from 'vitest'
import { useShortcutStore } from '../../src/renderer/stores/shortcutStore'

describe('ShortcutStore', () => {
  beforeEach(() => {
    useShortcutStore.setState({
      settingsOpen: false,
      captureTargetId: null,
    })
  })

  it('starts with settings closed', () => {
    expect(useShortcutStore.getState().settingsOpen).toBe(false)
  })

  it('has bindings defined', () => {
    const bindings = useShortcutStore.getState().bindings
    expect(bindings).toBeDefined()
    expect(typeof bindings).toBe('object')
  })

  it('openSettings() opens settings panel', () => {
    useShortcutStore.getState().openSettings()
    expect(useShortcutStore.getState().settingsOpen).toBe(true)
  })

  it('closeSettings() closes settings panel', () => {
    useShortcutStore.getState().openSettings()
    useShortcutStore.getState().closeSettings()
    expect(useShortcutStore.getState().settingsOpen).toBe(false)
  })

  it('startCapture() sets captureTargetId', () => {
    useShortcutStore.getState().startCapture('toggle-overlay')
    expect(useShortcutStore.getState().captureTargetId).toBe('toggle-overlay')
  })

  it('cancelCapture() clears captureTargetId', () => {
    useShortcutStore.getState().startCapture('toggle-overlay')
    useShortcutStore.getState().cancelCapture()
    expect(useShortcutStore.getState().captureTargetId).toBeNull()
  })
})
