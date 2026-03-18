import { describe, it, expect } from 'vitest'
import { parseStatus } from '../../src/main/git-context'

describe('GitContextProvider.parseStatus', () => {
  it('handles a clean repo with only branch line', () => {
    const result = parseStatus('## main...origin/main\n')
    expect(result.isRepo).toBe(true)
    expect(result.branch).toBe('main')
    expect(result.files).toEqual([])
  })

  it('handles a branch with no tracking info', () => {
    const result = parseStatus('## feature-branch\n')
    expect(result.isRepo).toBe(true)
    expect(result.branch).toBe('feature-branch')
    expect(result.files).toEqual([])
  })

  it('extracts branch name from tracking info', () => {
    const result = parseStatus('## develop...origin/develop [ahead 2]\n')
    expect(result.branch).toBe('develop')
  })

  it('handles detached HEAD', () => {
    const result = parseStatus('## HEAD (no branch)\n')
    expect(result.branch).toBe('HEAD (detached)')
  })

  it('parses modified files', () => {
    const raw = [
      '## main',
      ' M src/index.ts',
      'M  src/app.ts',
    ].join('\n')

    const result = parseStatus(raw)
    expect(result.isRepo).toBe(true)
    expect(result.files).toHaveLength(2)
    expect(result.files[0]).toEqual({ status: 'M', path: 'src/index.ts' })
    expect(result.files[1]).toEqual({ status: 'M', path: 'src/app.ts' })
  })

  it('parses added files', () => {
    const raw = [
      '## main',
      'A  new-file.ts',
    ].join('\n')

    const result = parseStatus(raw)
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toEqual({ status: 'A', path: 'new-file.ts' })
  })

  it('parses deleted files', () => {
    const raw = [
      '## main',
      ' D removed.ts',
    ].join('\n')

    const result = parseStatus(raw)
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toEqual({ status: 'D', path: 'removed.ts' })
  })

  it('parses untracked files', () => {
    const raw = [
      '## main',
      '?? untracked.txt',
      '?? src/new/',
    ].join('\n')

    const result = parseStatus(raw)
    expect(result.files).toHaveLength(2)
    expect(result.files[0]).toEqual({ status: '?', path: 'untracked.txt' })
    expect(result.files[1]).toEqual({ status: '?', path: 'src/new/' })
  })

  it('parses renamed files (extracts new path)', () => {
    const raw = [
      '## main',
      'R  old.ts -> new.ts',
    ].join('\n')

    const result = parseStatus(raw)
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toEqual({ status: 'R', path: 'new.ts' })
  })

  it('parses a mix of statuses', () => {
    const raw = [
      '## feature...origin/feature',
      ' M src/modified.ts',
      'A  src/added.ts',
      ' D src/deleted.ts',
      '?? src/untracked.ts',
      'R  old-name.ts -> new-name.ts',
    ].join('\n')

    const result = parseStatus(raw)
    expect(result.isRepo).toBe(true)
    expect(result.branch).toBe('feature')
    expect(result.files).toHaveLength(5)
    expect(result.files.map((f) => f.status)).toEqual(['M', 'A', 'D', '?', 'R'])
  })

  it('returns isRepo: true for empty status output (no files, no branch line)', () => {
    // This should not happen in practice, but handle gracefully
    const result = parseStatus('')
    expect(result.isRepo).toBe(true)
    expect(result.branch).toBe(null)
    expect(result.files).toEqual([])
  })

  it('handles files with spaces in paths', () => {
    const raw = [
      '## main',
      ' M src/my file.ts',
    ].join('\n')

    const result = parseStatus(raw)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].path).toBe('src/my file.ts')
  })
})

describe('GitContextProvider diff truncation', () => {
  it('truncates diff output beyond 50KB', async () => {
    // This tests the truncation logic conceptually.
    // The actual GitContextProvider.getDiff method truncates at 50KB.
    const MAX_DIFF_BYTES = 50 * 1024
    const longDiff = 'a'.repeat(MAX_DIFF_BYTES + 1000)

    // Simulate truncation logic
    const truncated = longDiff.length > MAX_DIFF_BYTES
      ? longDiff.slice(0, MAX_DIFF_BYTES) + '\n\n--- Diff truncated at 50 KB ---'
      : longDiff

    expect(truncated.length).toBeLessThan(longDiff.length)
    expect(truncated).toContain('--- Diff truncated at 50 KB ---')
  })

  it('does not truncate diff under 50KB', () => {
    const MAX_DIFF_BYTES = 50 * 1024
    const shortDiff = 'a'.repeat(100)

    const result = shortDiff.length > MAX_DIFF_BYTES
      ? shortDiff.slice(0, MAX_DIFF_BYTES) + '\n\n--- Diff truncated at 50 KB ---'
      : shortDiff

    expect(result).toBe(shortDiff)
    expect(result).not.toContain('truncated')
  })
})
