import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mockPlatform } from '../helpers/mock-platform'
import * as fs from 'fs'
import * as os from 'os'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return { ...actual, existsSync: vi.fn(() => false) }
})

const mockExistsSync = vi.mocked(fs.existsSync)

import { getWhisperBinaryCandidates, getWhisperModelCandidates, getWhisperNotFoundMessage, getModelDownloadMessage } from '../../src/main/whisper-paths'

describe('whisper-paths', () => {
  let restorePlatform: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    restorePlatform?.()
    restorePlatform = null
  })

  describe('getWhisperBinaryCandidates', () => {
    it('returns POSIX paths on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      const candidates = getWhisperBinaryCandidates()

      expect(candidates.some(c => c.includes('/opt/homebrew/'))).toBe(true)
      expect(candidates.some(c => c.includes('/usr/local/'))).toBe(true)
      expect(candidates.every(c => !c.includes('AppData'))).toBe(true)
    })

    it('returns Windows paths on win32', () => {
      restorePlatform = mockPlatform('win32')
      const candidates = getWhisperBinaryCandidates()

      expect(candidates.some(c => c.includes('AppData') || c.includes('Program Files') || c.includes('scoop'))).toBe(true)
      expect(candidates.every(c => !c.includes('/opt/homebrew/'))).toBe(true)
    })

    it('includes .exe extensions on win32', () => {
      restorePlatform = mockPlatform('win32')
      const candidates = getWhisperBinaryCandidates()

      expect(candidates.some(c => c.endsWith('.exe'))).toBe(true)
    })
  })

  describe('getWhisperModelCandidates', () => {
    it('returns POSIX model paths on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      const candidates = getWhisperModelCandidates()

      // path.join on Windows converts / to \ even when platform is mocked,
      // so check for the directory name parts instead of exact separators
      expect(candidates.some(c => c.includes('whisper') && c.includes('ggml-tiny.bin'))).toBe(true)
      expect(candidates.some(c => c.includes('homebrew') || c.includes('.local'))).toBe(true)
    })

    it('returns Windows model paths on win32', () => {
      restorePlatform = mockPlatform('win32')
      const candidates = getWhisperModelCandidates()

      expect(candidates.some(c => c.includes('AppData') || c.includes('whisper'))).toBe(true)
    })
  })

  describe('getWhisperNotFoundMessage', () => {
    it('suggests brew install on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      const msg = getWhisperNotFoundMessage()

      expect(msg).toContain('brew install')
    })

    it('suggests scoop/winget on win32', () => {
      restorePlatform = mockPlatform('win32')
      const msg = getWhisperNotFoundMessage()

      expect(msg).not.toContain('brew')
      expect(msg.includes('scoop') || msg.includes('winget') || msg.includes('download')).toBe(true)
    })
  })

  describe('getModelDownloadMessage', () => {
    it('shows mkdir -p on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      const msg = getModelDownloadMessage()

      expect(msg).toContain('mkdir -p')
    })

    it('shows PowerShell or Windows-friendly commands on win32', () => {
      restorePlatform = mockPlatform('win32')
      const msg = getModelDownloadMessage()

      expect(msg).not.toContain('mkdir -p')
    })
  })
})
