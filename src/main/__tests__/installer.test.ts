import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SpawnSyncReturns } from 'child_process'

// ─── Mock child_process before importing installer ───────────────────────────
// spawnSync is used to run curl and tar without shell interpretation.
// We mock it to verify argument arrays (not shell strings) are used.

const spawnSyncMock = vi.fn()

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
}))

// ─── Mock fs and path operations so installer doesn't touch the real filesystem ─

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  rmSync: vi.fn(),
  cpSync: vi.fn(),
}))

// Manifest mock — one github skill with a path that includes shell-special characters
vi.mock('../skills/manifest', () => ({
  SKILLS: [
    {
      name: 'test-skill',
      version: '1.0.0',
      requiredFiles: [],
      source: {
        type: 'github',
        repo: 'org/repo',
        // A path containing characters that would be dangerous in a shell string
        path: 'skills/test-skill',
        commitSha: 'abc123',
      },
    },
  ],
}))

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('installGithubSkill — spawnSync argument safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: both curl and tar succeed
    spawnSyncMock.mockReturnValue({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') } as SpawnSyncReturns<Buffer>)
  })

  it('calls curl with the tarball URL as a separate argument (not embedded in a shell string)', async () => {
    const { ensureSkills } = await import('../skills/installer')
    await ensureSkills(() => {})

    const curlCall = spawnSyncMock.mock.calls[0]
    const [curlBin, curlArgs] = curlCall

    expect(curlBin).toBe('/usr/bin/curl')
    // URL must be a standalone argument, NOT embedded in a shell string
    expect(Array.isArray(curlArgs)).toBe(true)
    expect(curlArgs).toContain('-sL')
    // The URL argument must be a plain string, not a shell command
    const urlArg = curlArgs.find((a: string) => a.startsWith('https://'))
    expect(urlArg).toBeDefined()
    expect(urlArg).not.toContain('&&')
    expect(urlArg).not.toContain(';')
    expect(urlArg).not.toContain('|')
  })

  it('calls tar with tmpDir and path as separate arguments (no shell interpolation possible)', async () => {
    const { ensureSkills } = await import('../skills/installer')
    await ensureSkills(() => {})

    const tarCall = spawnSyncMock.mock.calls[1]
    const [tarBin, tarArgs] = tarCall

    expect(tarBin).toBe('/usr/bin/tar')
    expect(Array.isArray(tarArgs)).toBe(true)
    // --no-symlinks must be present to block symlink creation at extraction time
    expect(tarArgs).toContain('--no-symlinks')
    // -C must be a separate argument from the directory path
    const cIndex = tarArgs.indexOf('-C')
    expect(cIndex).toBeGreaterThan(-1)
    expect(tarArgs[cIndex + 1]).toBeTruthy() // tmpDir follows -C as its own element
    // No shell metacharacters in the argument list itself
    const joinedArgs = tarArgs.join(' ')
    expect(joinedArgs).not.toContain('$(')
    expect(joinedArgs).not.toContain('`')
  })

  it('passes curl stdout directly as stdin to tar (no temp file, no shell pipe)', async () => {
    const fakeBuffer = Buffer.from('fake tarball content')
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: fakeBuffer, stderr: Buffer.from('') })
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') })

    const { ensureSkills } = await import('../skills/installer')
    await ensureSkills(() => {})

    const tarOptions = spawnSyncMock.mock.calls[1][2]
    // The tar call must receive curl's stdout as its input buffer
    expect(tarOptions.input).toBe(fakeBuffer)
  })

  it('reports failure when curl exits non-zero (no shell — no silent swallow)', async () => {
    spawnSyncMock.mockReturnValueOnce({
      status: 22,
      stdout: Buffer.from(''),
      stderr: Buffer.from('404 Not Found'),
    })

    const statuses: string[] = []
    const { ensureSkills } = await import('../skills/installer')
    await ensureSkills((s) => statuses.push(s.state))

    expect(statuses).toContain('failed')
  })

  it('reports failure when tar exits non-zero', async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: Buffer.from('data'), stderr: Buffer.from('') })
      .mockReturnValueOnce({ status: 1, stdout: Buffer.from(''), stderr: Buffer.from('invalid archive') })

    const statuses: string[] = []
    const { ensureSkills } = await import('../skills/installer')
    await ensureSkills((s) => statuses.push(s.state))

    expect(statuses).toContain('failed')
  })
})
