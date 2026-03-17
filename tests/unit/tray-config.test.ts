import { describe, it, expect, afterEach } from 'vitest'
import { mockPlatform } from '../helpers/mock-platform'
import { getTrayIconFile, getCloseAction, type CloseAction } from '../../src/main/tray-config'

describe('tray-config', () => {
  let restorePlatform: (() => void) | null = null

  afterEach(() => {
    restorePlatform?.()
    restorePlatform = null
  })

  describe('getTrayIconFile', () => {
    it('returns trayTemplate.png on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      expect(getTrayIconFile()).toBe('trayTemplate.png')
    })

    it('returns icon.png on win32', () => {
      restorePlatform = mockPlatform('win32')
      expect(getTrayIconFile()).toBe('icon.png')
    })
  })

  describe('getCloseAction', () => {
    it('returns minimize-to-tray on win32 by default', () => {
      restorePlatform = mockPlatform('win32')
      expect(getCloseAction()).toBe('minimize-to-tray')
    })

    it('returns minimize-to-tray on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      expect(getCloseAction()).toBe('minimize-to-tray')
    })

    it('returns quit when configured', () => {
      restorePlatform = mockPlatform('win32')
      expect(getCloseAction('quit')).toBe('quit')
    })
  })
})
