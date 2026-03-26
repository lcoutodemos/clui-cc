import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from './theme'

const SETTINGS_KEY = 'clui-settings'

function readStored() {
  const raw = localStorage.getItem(SETTINGS_KEY)
  return raw ? JSON.parse(raw) : null
}

// Re-apply defaults between tests since the store is a singleton
function resetThemeStore() {
  useThemeStore.setState({
    themeMode: 'dark',
    isDark: true,
    soundEnabled: true,
    expandedUI: false,
    accentColor: '#d97757',
    useLastFolder: true,
    _systemIsDark: true,
  })
  localStorage.clear()
}

// ─── loadSettings defaults ────────────────────────────────────────────────────

describe('settings defaults', () => {
  beforeEach(resetThemeStore)

  it('useLastFolder defaults to true when nothing is stored', () => {
    expect(useThemeStore.getState().useLastFolder).toBe(true)
  })

  it('soundEnabled defaults to true', () => {
    expect(useThemeStore.getState().soundEnabled).toBe(true)
  })
})

// ─── setUseLastFolder ─────────────────────────────────────────────────────────

describe('setUseLastFolder', () => {
  beforeEach(resetThemeStore)

  it('updates the in-memory store value', () => {
    useThemeStore.getState().setUseLastFolder(false)
    expect(useThemeStore.getState().useLastFolder).toBe(false)
  })

  it('persists the value to localStorage', () => {
    useThemeStore.getState().setUseLastFolder(false)
    expect(readStored()?.useLastFolder).toBe(false)
  })

  it('round-trips true back correctly', () => {
    useThemeStore.getState().setUseLastFolder(false)
    useThemeStore.getState().setUseLastFolder(true)
    expect(useThemeStore.getState().useLastFolder).toBe(true)
    expect(readStored()?.useLastFolder).toBe(true)
  })
})

// ─── Other settings persist useLastFolder alongside them ─────────────────────

describe('useLastFolder is preserved when other settings change', () => {
  beforeEach(resetThemeStore)

  it('survives a setSoundEnabled call', () => {
    useThemeStore.getState().setUseLastFolder(false)
    useThemeStore.getState().setSoundEnabled(false)
    expect(readStored()?.useLastFolder).toBe(false)
  })

  it('survives a setThemeMode call', () => {
    useThemeStore.getState().setUseLastFolder(false)
    useThemeStore.getState().setThemeMode('light')
    expect(readStored()?.useLastFolder).toBe(false)
  })

  it('survives a setAccentColor call', () => {
    useThemeStore.getState().setUseLastFolder(false)
    useThemeStore.getState().setAccentColor('#ff0000')
    expect(readStored()?.useLastFolder).toBe(false)
  })
})

// ─── setThemeMode ─────────────────────────────────────────────────────────────

describe('setThemeMode', () => {
  beforeEach(resetThemeStore)

  it('sets isDark=true for dark mode', () => {
    useThemeStore.getState().setThemeMode('dark')
    expect(useThemeStore.getState().isDark).toBe(true)
  })

  it('sets isDark=false for light mode', () => {
    useThemeStore.getState().setThemeMode('light')
    expect(useThemeStore.getState().isDark).toBe(false)
  })

  it('persists themeMode to localStorage', () => {
    useThemeStore.getState().setThemeMode('light')
    expect(readStored()?.themeMode).toBe('light')
  })

  it('resolves system mode based on _systemIsDark', () => {
    useThemeStore.setState({ _systemIsDark: false })
    useThemeStore.getState().setThemeMode('system')
    expect(useThemeStore.getState().isDark).toBe(false)
  })
})

// ─── setAccentColor ───────────────────────────────────────────────────────────

describe('setAccentColor', () => {
  beforeEach(resetThemeStore)

  it('stores the custom hex in-memory and in localStorage', () => {
    useThemeStore.getState().setAccentColor('#abcdef')
    expect(useThemeStore.getState().accentColor).toBe('#abcdef')
    expect(readStored()?.accentColor).toBe('#abcdef')
  })
})

// ─── setSoundEnabled ──────────────────────────────────────────────────────────

describe('setSoundEnabled', () => {
  beforeEach(resetThemeStore)

  it('persists false to localStorage', () => {
    useThemeStore.getState().setSoundEnabled(false)
    expect(useThemeStore.getState().soundEnabled).toBe(false)
    expect(readStored()?.soundEnabled).toBe(false)
  })
})
