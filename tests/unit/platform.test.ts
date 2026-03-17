import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mockPlatform } from '../helpers/mock-platform'
import * as childProcess from 'child_process'
import * as fs from 'fs'

// Mock child_process and fs at the module level
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    accessSync: vi.fn(),
  }
})

const mockExecSync = vi.mocked(childProcess.execSync)
const mockExistsSync = vi.mocked(fs.existsSync)
const mockAccessSync = vi.mocked(fs.accessSync)

// Import the module under test — since platform.ts now reads process.platform
// at call time (not module load time), we can import once and mock per test.
import { findBinary, getLoginShellPath, ensureBinDirInPath, findClaudeBinary } from '../../src/main/platform'

describe('platform utilities', () => {
  let restorePlatform: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  afterEach(() => {
    restorePlatform?.()
    restorePlatform = null
  })

  describe('findBinary', () => {
    it('uses "where" command on win32', () => {
      restorePlatform = mockPlatform('win32')
      mockExecSync.mockReturnValue('C:\\Program Files\\claude\\claude.exe\r\n')

      const result = findBinary('claude')

      expect(mockExecSync).toHaveBeenCalledWith('where claude', expect.objectContaining({ encoding: 'utf-8' }))
      expect(result).toBe('C:\\Program Files\\claude\\claude.exe')
    })

    it('uses login shell whence/which on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      mockExecSync.mockReturnValue('/usr/local/bin/claude\n')

      const result = findBinary('claude')

      expect(result).toBe('/usr/local/bin/claude')
      // Should have called zsh, not where
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('/bin/zsh'),
        expect.anything(),
      )
    })

    it('returns bare name as fallback when all lookups fail on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      mockExecSync.mockImplementation(() => { throw new Error('not found') })

      const result = findBinary('claude')

      expect(result).toBe('claude')
    })

    it('returns bare name on win32 when where fails', () => {
      restorePlatform = mockPlatform('win32')
      mockExecSync.mockImplementation(() => { throw new Error('not found') })

      const result = findBinary('claude')

      expect(result).toBe('claude')
    })

    it('handles multiple results from where on win32 (takes first)', () => {
      restorePlatform = mockPlatform('win32')
      mockExecSync.mockReturnValue('C:\\Users\\me\\bin\\claude.exe\r\nC:\\Program Files\\claude\\claude.exe\r\n')

      const result = findBinary('claude')

      expect(result).toBe('C:\\Users\\me\\bin\\claude.exe')
    })

    it('trims whitespace and carriage returns from results', () => {
      restorePlatform = mockPlatform('win32')
      mockExecSync.mockReturnValue('  C:\\bin\\claude.exe  \r\n')

      const result = findBinary('claude')

      expect(result).toBe('C:\\bin\\claude.exe')
    })

    it('falls back to bash when zsh fails on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      let callCount = 0
      mockExecSync.mockImplementation((cmd: string) => {
        callCount++
        if (String(cmd).includes('zsh')) throw new Error('no zsh')
        return '/usr/bin/claude\n'
      })

      const result = findBinary('claude')

      expect(result).toBe('/usr/bin/claude')
      expect(callCount).toBe(2) // zsh failed, bash succeeded
    })
  })

  describe('getLoginShellPath', () => {
    it('returns empty string on win32 (Windows has complete PATH already)', () => {
      restorePlatform = mockPlatform('win32')

      const result = getLoginShellPath()

      expect(result).toBe('')
      // Should NOT call execSync at all on Windows
      expect(mockExecSync).not.toHaveBeenCalled()
    })

    it('tries zsh then bash on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      mockExecSync.mockReturnValue('/usr/local/bin:/usr/bin:/bin\n')

      const result = getLoginShellPath()

      expect(result).toBe('/usr/local/bin:/usr/bin:/bin')
    })

    it('returns empty string if both shells fail on darwin', () => {
      restorePlatform = mockPlatform('darwin')
      mockExecSync.mockImplementation(() => { throw new Error('no shell') })

      const result = getLoginShellPath()

      expect(result).toBe('')
    })

    it('returns empty string on linux', () => {
      restorePlatform = mockPlatform('linux')
      mockExecSync.mockImplementation(() => { throw new Error('no shell') })

      const result = getLoginShellPath()

      expect(result).toBe('')
    })
  })

  describe('ensureBinDirInPath', () => {
    it('uses path.dirname on Windows paths', () => {
      restorePlatform = mockPlatform('win32')

      const env: NodeJS.ProcessEnv = { PATH: 'C:\\Windows\\System32' }
      ensureBinDirInPath('C:\\Users\\me\\bin\\claude.exe', env)

      expect(env.PATH).toContain('C:\\Users\\me\\bin')
    })

    it('uses path.dirname on POSIX paths', () => {
      restorePlatform = mockPlatform('darwin')

      const env: NodeJS.ProcessEnv = { PATH: '/usr/bin:/bin' }
      ensureBinDirInPath('/usr/local/bin/claude', env)

      expect(env.PATH).toContain('/usr/local/bin')
    })

    it('uses semicolon separator on win32', () => {
      restorePlatform = mockPlatform('win32')

      const env: NodeJS.ProcessEnv = { PATH: 'C:\\Windows\\System32' }
      ensureBinDirInPath('C:\\bin\\claude.exe', env)

      expect(env.PATH).toBe('C:\\bin;C:\\Windows\\System32')
    })

    it('uses colon separator on darwin/linux', () => {
      restorePlatform = mockPlatform('darwin')

      const env: NodeJS.ProcessEnv = { PATH: '/usr/bin' }
      ensureBinDirInPath('/usr/local/bin/claude', env)

      expect(env.PATH).toBe('/usr/local/bin:/usr/bin')
    })

    it('does not duplicate if binDir already in PATH (posix)', () => {
      restorePlatform = mockPlatform('darwin')

      const env: NodeJS.ProcessEnv = { PATH: '/usr/local/bin:/usr/bin' }
      ensureBinDirInPath('/usr/local/bin/claude', env)

      expect(env.PATH).toBe('/usr/local/bin:/usr/bin')
    })

    it('does not duplicate if binDir already in PATH (win32)', () => {
      restorePlatform = mockPlatform('win32')

      const env: NodeJS.ProcessEnv = { PATH: 'C:\\bin;C:\\Windows' }
      ensureBinDirInPath('C:\\bin\\claude.exe', env)

      expect(env.PATH).toBe('C:\\bin;C:\\Windows')
    })

    it('handles empty PATH gracefully', () => {
      restorePlatform = mockPlatform('win32')

      const env: NodeJS.ProcessEnv = { PATH: '' }
      ensureBinDirInPath('C:\\bin\\claude.exe', env)

      expect(env.PATH).toBe('C:\\bin')
    })

    it('handles undefined PATH gracefully', () => {
      restorePlatform = mockPlatform('win32')

      const env: NodeJS.ProcessEnv = {}
      ensureBinDirInPath('C:\\bin\\claude.exe', env)

      expect(env.PATH).toBe('C:\\bin')
    })

    it('does not prepend "." when binary is bare name', () => {
      restorePlatform = mockPlatform('darwin')

      const env: NodeJS.ProcessEnv = { PATH: '/usr/bin' }
      ensureBinDirInPath('claude', env)

      expect(env.PATH).toBe('/usr/bin')
    })

    it('preserves Windows "Path" key instead of creating duplicate "PATH"', () => {
      restorePlatform = mockPlatform('win32')

      // Windows often uses 'Path' not 'PATH'
      const env: NodeJS.ProcessEnv = { Path: 'C:\\Windows\\System32' }
      ensureBinDirInPath('C:\\bin\\claude.exe', env)

      // Should modify the existing 'Path' key, not create a new 'PATH'
      expect(env.Path).toBe('C:\\bin;C:\\Windows\\System32')
      expect(env.PATH).toBeUndefined()
    })
  })

  describe('findClaudeBinary', () => {
    it('checks Windows candidate paths on win32', () => {
      restorePlatform = mockPlatform('win32')

      // All candidates fail, findBinary also fails
      mockExistsSync.mockReturnValue(false)
      mockExecSync.mockImplementation(() => { throw new Error('not found') })

      const result = findClaudeBinary()

      // Falls back to bare 'claude'
      expect(result).toBe('claude')
      // Should have called `where`, not zsh/bash
      expect(mockExecSync).toHaveBeenCalledWith('where claude', expect.anything())
    })

    it('returns first existing candidate on win32', () => {
      restorePlatform = mockPlatform('win32')

      mockExistsSync.mockImplementation((p) => String(p).endsWith('claude.cmd'))
      mockExecSync.mockImplementation(() => { throw new Error('not found') })

      const result = findClaudeBinary()

      expect(result).toContain('claude.cmd')
    })

    it('checks POSIX candidate paths on darwin', () => {
      restorePlatform = mockPlatform('darwin')

      // First candidate exists and is executable
      mockExistsSync.mockImplementation((p) => String(p) === '/usr/local/bin/claude')
      mockAccessSync.mockImplementation(() => {})

      const result = findClaudeBinary()

      expect(result).toBe('/usr/local/bin/claude')
    })

    it('checks execute permission on POSIX candidates', () => {
      restorePlatform = mockPlatform('darwin')

      mockExistsSync.mockReturnValue(true)
      // accessSync throws = not executable
      mockAccessSync.mockImplementation(() => { throw new Error('EACCES') })
      mockExecSync.mockImplementation(() => { throw new Error('nope') })

      const result = findClaudeBinary()

      // All candidates fail permission check, falls back to 'claude'
      expect(result).toBe('claude')
    })

    it('does NOT check execute permission on win32 candidates', () => {
      restorePlatform = mockPlatform('win32')

      mockExistsSync.mockImplementation((p) => String(p).endsWith('claude.cmd'))

      const result = findClaudeBinary()

      // accessSync should NOT be called on Windows
      expect(mockAccessSync).not.toHaveBeenCalled()
      expect(result).toContain('claude.cmd')
    })
  })
})
