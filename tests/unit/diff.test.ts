import { describe, it, expect } from 'vitest'
import { generateDiff, DiffHunk, DiffLine } from '../../src/renderer/utils/diff'

/** Helper: flatten all lines from all hunks */
function flatLines(hunks: DiffHunk[]): DiffLine[] {
  return hunks.flatMap((h) => h.lines)
}

/** Helper: count lines by type */
function countTypes(hunks: DiffHunk[]) {
  const lines = flatLines(hunks)
  return {
    additions: lines.filter((l) => l.type === 'addition').length,
    deletions: lines.filter((l) => l.type === 'deletion').length,
    context: lines.filter((l) => l.type === 'context').length,
  }
}

describe('generateDiff', () => {
  it('returns empty array for identical strings', () => {
    expect(generateDiff('hello\nworld', 'hello\nworld')).toEqual([])
  })

  it('returns empty array for two empty strings', () => {
    expect(generateDiff('', '')).toEqual([])
  })

  it('handles addition only (empty old string)', () => {
    const hunks = generateDiff('', 'line1\nline2\nline3')
    expect(hunks.length).toBeGreaterThanOrEqual(1)
    const counts = countTypes(hunks)
    expect(counts.additions).toBe(3)
    expect(counts.deletions).toBe(0)
  })

  it('handles deletion only (empty new string)', () => {
    const hunks = generateDiff('line1\nline2\nline3', '')
    expect(hunks.length).toBeGreaterThanOrEqual(1)
    const counts = countTypes(hunks)
    expect(counts.deletions).toBe(3)
    expect(counts.additions).toBe(0)
  })

  it('handles single-line change', () => {
    const hunks = generateDiff('hello', 'world')
    expect(hunks.length).toBe(1)
    const counts = countTypes(hunks)
    expect(counts.deletions).toBe(1)
    expect(counts.additions).toBe(1)
    const lines = flatLines(hunks)
    expect(lines.find((l) => l.type === 'deletion')?.content).toBe('hello')
    expect(lines.find((l) => l.type === 'addition')?.content).toBe('world')
  })

  it('handles mixed changes with context', () => {
    const old = 'a\nb\nc\nd\ne'
    const neu = 'a\nb\nX\nd\ne'
    const hunks = generateDiff(old, neu)
    expect(hunks.length).toBe(1)
    const lines = flatLines(hunks)
    expect(lines.find((l) => l.type === 'deletion')?.content).toBe('c')
    expect(lines.find((l) => l.type === 'addition')?.content).toBe('X')
    // Should have context lines around the change
    const contextLines = lines.filter((l) => l.type === 'context')
    expect(contextLines.length).toBeGreaterThan(0)
  })

  it('respects contextLines parameter', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
    const oldStr = lines.join('\n')
    // Change line 10 only
    const newLines = [...lines]
    newLines[9] = 'CHANGED'
    const newStr = newLines.join('\n')

    const hunks0 = generateDiff(oldStr, newStr, 0)
    const context0 = flatLines(hunks0).filter((l) => l.type === 'context')
    expect(context0.length).toBe(0)

    const hunks1 = generateDiff(oldStr, newStr, 1)
    const context1 = flatLines(hunks1).filter((l) => l.type === 'context')
    expect(context1.length).toBe(2) // 1 before + 1 after

    const hunks3 = generateDiff(oldStr, newStr, 3)
    const context3 = flatLines(hunks3).filter((l) => l.type === 'context')
    expect(context3.length).toBe(6) // 3 before + 3 after
  })

  it('produces multiple hunks for distant changes', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
    const oldStr = lines.join('\n')
    // Change line 2 and line 19 (far apart)
    const newLines = [...lines]
    newLines[1] = 'CHANGED_A'
    newLines[18] = 'CHANGED_B'
    const newStr = newLines.join('\n')

    const hunks = generateDiff(oldStr, newStr, 1)
    expect(hunks.length).toBe(2)
  })

  it('merges nearby changes into a single hunk', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`)
    const oldStr = lines.join('\n')
    // Change lines 3 and 5 (close enough with context=3)
    const newLines = [...lines]
    newLines[2] = 'CHANGED_A'
    newLines[4] = 'CHANGED_B'
    const newStr = newLines.join('\n')

    const hunks = generateDiff(oldStr, newStr, 3)
    expect(hunks.length).toBe(1)
  })

  it('assigns correct line numbers', () => {
    const hunks = generateDiff('a\nb\nc', 'a\nX\nc')
    const lines = flatLines(hunks)

    // The deletion of 'b' should have oldLineNum=2
    const del = lines.find((l) => l.type === 'deletion')
    expect(del?.oldLineNum).toBe(2)

    // The addition of 'X' should have newLineNum=2
    const add = lines.find((l) => l.type === 'addition')
    expect(add?.newLineNum).toBe(2)
  })

  it('handles appending lines at the end', () => {
    const hunks = generateDiff('a\nb', 'a\nb\nc\nd')
    const counts = countTypes(hunks)
    expect(counts.additions).toBe(2)
    expect(counts.deletions).toBe(0)
  })

  it('handles removing lines from the end', () => {
    const hunks = generateDiff('a\nb\nc\nd', 'a\nb')
    const counts = countTypes(hunks)
    expect(counts.deletions).toBe(2)
    expect(counts.additions).toBe(0)
  })

  it('handles completely different content', () => {
    const hunks = generateDiff('aaa\nbbb', 'xxx\nyyy\nzzz')
    const counts = countTypes(hunks)
    expect(counts.deletions).toBe(2)
    expect(counts.additions).toBe(3)
  })

  it('handles single line to multi-line', () => {
    const hunks = generateDiff('single', 'first\nsecond\nthird')
    const counts = countTypes(hunks)
    expect(counts.deletions).toBe(1) // 'single' removed
    expect(counts.additions).toBe(3) // 3 lines added
  })

  it('handles multi-line to single line', () => {
    const hunks = generateDiff('first\nsecond\nthird', 'single')
    const counts = countTypes(hunks)
    expect(counts.deletions).toBe(3)
    expect(counts.additions).toBe(1)
  })

  it('preserves empty lines in content', () => {
    const hunks = generateDiff('a\n\nb', 'a\n\nc')
    const lines = flatLines(hunks)
    const contextEmpty = lines.find((l) => l.type === 'context' && l.content === '')
    expect(contextEmpty).toBeDefined()
  })

  it('default context is 3 lines', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
    const oldStr = lines.join('\n')
    const newLines = [...lines]
    newLines[9] = 'CHANGED' // change line 10
    const newStr = newLines.join('\n')

    const hunks = generateDiff(oldStr, newStr) // default context
    const contextCount = flatLines(hunks).filter((l) => l.type === 'context').length
    expect(contextCount).toBe(6) // 3 before + 3 after
  })
})
