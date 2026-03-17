import { describe, it, expect, afterEach } from 'vitest'
import { mockPlatform } from '../helpers/mock-platform'
import { getWindowConfig } from '../../src/main/window-config'

describe('getWindowConfig', () => {
  let restorePlatform: (() => void) | null = null

  afterEach(() => {
    restorePlatform?.()
    restorePlatform = null
  })

  describe('on darwin', () => {
    it('uses NSPanel type', () => {
      restorePlatform = mockPlatform('darwin')
      const config = getWindowConfig()
      expect(config.type).toBe('panel')
    })

    it('enables transparency', () => {
      restorePlatform = mockPlatform('darwin')
      const config = getWindowConfig()
      expect(config.transparent).toBe(true)
    })

    it('uses icns icon', () => {
      restorePlatform = mockPlatform('darwin')
      const config = getWindowConfig()
      expect(config.iconFile).toContain('.icns')
    })
  })

  describe('on win32', () => {
    it('does not set panel type', () => {
      restorePlatform = mockPlatform('win32')
      const config = getWindowConfig()
      expect(config.type).toBeUndefined()
    })

    it('enables transparency by default', () => {
      restorePlatform = mockPlatform('win32')
      const config = getWindowConfig()
      expect(config.transparent).toBe(true)
    })

    it('uses png icon', () => {
      restorePlatform = mockPlatform('win32')
      const config = getWindowConfig()
      expect(config.iconFile).toContain('.png')
    })

    it('skips taskbar', () => {
      restorePlatform = mockPlatform('win32')
      const config = getWindowConfig()
      expect(config.skipTaskbar).toBe(true)
    })
  })

  describe('fallback mode', () => {
    it('disables transparency when fallback is requested', () => {
      restorePlatform = mockPlatform('win32')
      const config = getWindowConfig({ fallback: true })
      expect(config.transparent).toBe(false)
      expect(config.backgroundColor).not.toBe('#00000000')
    })

    it('still uses alwaysOnTop in fallback mode', () => {
      restorePlatform = mockPlatform('win32')
      const config = getWindowConfig({ fallback: true })
      expect(config.alwaysOnTop).toBe(true)
    })
  })
})
