import { describe, it, expect, afterEach } from 'vitest'
import { mockPlatform } from '../helpers/mock-platform'
import { buildScreenshotCommand, getScreenshotTempPath } from '../../src/main/screenshot'

describe('screenshot', () => {
  let restorePlatform: (() => void) | null = null

  afterEach(() => {
    restorePlatform?.()
    restorePlatform = null
  })

  describe('buildScreenshotCommand', () => {
    it('uses screencapture on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      const cmd = buildScreenshotCommand('/tmp/test.png')
      expect(cmd.program).toBe('/usr/sbin/screencapture')
      expect(cmd.args).toContain('-i')
    })

    it('uses powershell on win32', () => {
      restorePlatform = mockPlatform('win32')
      const cmd = buildScreenshotCommand('C:\\temp\\test.png')
      expect(cmd.program).toBe('powershell')
      expect(cmd.args.some(a => a.includes('System.Drawing'))).toBe(true)
    })

    it('returns null on linux', () => {
      restorePlatform = mockPlatform('linux')
      const cmd = buildScreenshotCommand('/tmp/test.png')
      expect(cmd).toBeNull()
    })
  })

  describe('getScreenshotTempPath', () => {
    it('returns a .png path in temp directory', () => {
      const p = getScreenshotTempPath()
      expect(p).toContain('.png')
      expect(p).toContain('clui-screenshot')
    })

    it('returns unique paths on successive calls', () => {
      const p1 = getScreenshotTempPath()
      const p2 = getScreenshotTempPath()
      expect(p1).not.toBe(p2)
    })
  })
})
