// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { useThemeStore, useColors, getColors } from '../../src/renderer/theme'

describe('ThemeStore', () => {
  it('has isDark defined', () => {
    expect(typeof useThemeStore.getState().isDark).toBe('boolean')
  })

  it('has themeMode defined', () => {
    const mode = useThemeStore.getState().themeMode
    expect(['system', 'light', 'dark']).toContain(mode)
  })

  it('setThemeMode() to dark sets isDark true', () => {
    useThemeStore.getState().setThemeMode('dark')
    expect(useThemeStore.getState().isDark).toBe(true)
    expect(useThemeStore.getState().themeMode).toBe('dark')
  })

  it('setThemeMode() to light sets isDark false', () => {
    useThemeStore.getState().setThemeMode('light')
    expect(useThemeStore.getState().isDark).toBe(false)
    expect(useThemeStore.getState().themeMode).toBe('light')
  })

  it('soundEnabled toggles', () => {
    useThemeStore.getState().setSoundEnabled(false)
    expect(useThemeStore.getState().soundEnabled).toBe(false)
    useThemeStore.getState().setSoundEnabled(true)
    expect(useThemeStore.getState().soundEnabled).toBe(true)
  })

  it('expandedUI toggles', () => {
    useThemeStore.getState().setExpandedUI(true)
    expect(useThemeStore.getState().expandedUI).toBe(true)
    useThemeStore.getState().setExpandedUI(false)
    expect(useThemeStore.getState().expandedUI).toBe(false)
  })

  it('autoResumeEnabled toggles', () => {
    useThemeStore.getState().setAutoResumeEnabled(false)
    expect(useThemeStore.getState().autoResumeEnabled).toBe(false)
  })
})

describe('getColors', () => {
  it('returns dark palette when isDark is true', () => {
    const colors = getColors(true)
    expect(colors.containerBg).toBeDefined()
    expect(colors.accent).toBe('#d97757')
  })

  it('returns light palette when isDark is false', () => {
    const colors = getColors(false)
    expect(colors.containerBg).toBeDefined()
    expect(colors.accent).toBe('#d97757') // accent is same in both
  })

  it('dark and light have different containerBg', () => {
    const dark = getColors(true)
    const light = getColors(false)
    expect(dark.containerBg).not.toBe(light.containerBg)
  })
})
