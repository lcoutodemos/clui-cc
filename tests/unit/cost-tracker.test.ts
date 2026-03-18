import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { CostRecord } from '../../src/shared/types'

// We need to mock os.homedir() so the cost tracker writes to a temp dir instead of real ~/.clui
const TEST_DIR = join(tmpdir(), `clui-cost-test-${Date.now()}`)

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os')
  return {
    ...actual,
    homedir: () => TEST_DIR,
  }
})

// Import after mocking
const { appendRecord, getSummary, getHistory } = await import('../../src/main/cost-tracker')

function makeCostRecord(overrides: Partial<CostRecord> = {}): CostRecord {
  return {
    timestamp: Date.now(),
    sessionId: 'test-session-1',
    model: 'claude-sonnet-4-6',
    projectPath: '/home/user/project-a',
    costUsd: 0.05,
    durationMs: 3000,
    numTurns: 2,
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    cacheCreationTokens: 100,
    ...overrides,
  }
}

describe('CostTracker', () => {
  beforeEach(() => {
    // Clean up test directory before each test
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('appendRecord creates .clui dir and writes to file', () => {
    const record = makeCostRecord()
    appendRecord(record)

    const cluiDir = join(TEST_DIR, '.clui')
    expect(existsSync(cluiDir)).toBe(true)

    const historyFile = join(cluiDir, 'cost-history.jsonl')
    expect(existsSync(historyFile)).toBe(true)

    const content = readFileSync(historyFile, 'utf-8').trim()
    const parsed = JSON.parse(content)
    expect(parsed.sessionId).toBe('test-session-1')
    expect(parsed.costUsd).toBe(0.05)
  })

  it('getSummary aggregates correctly', () => {
    appendRecord(makeCostRecord({ costUsd: 0.10, inputTokens: 1000, outputTokens: 500, durationMs: 2000 }))
    appendRecord(makeCostRecord({ costUsd: 0.20, inputTokens: 2000, outputTokens: 1000, durationMs: 3000 }))
    appendRecord(makeCostRecord({ costUsd: 0.05, inputTokens: 500, outputTokens: 250, durationMs: 1000 }))

    const summary = getSummary()
    expect(summary.runCount).toBe(3)
    expect(summary.totalCostUsd).toBeCloseTo(0.35, 4)
    expect(summary.totalInputTokens).toBe(3500)
    expect(summary.totalOutputTokens).toBe(1750)
    expect(summary.totalDurationMs).toBe(6000)
  })

  it('getSummary filters by time range', () => {
    const now = Date.now()
    const hourAgo = now - 60 * 60 * 1000
    const dayAgo = now - 24 * 60 * 60 * 1000

    appendRecord(makeCostRecord({ timestamp: dayAgo, costUsd: 0.50 }))
    appendRecord(makeCostRecord({ timestamp: hourAgo, costUsd: 0.10 }))
    appendRecord(makeCostRecord({ timestamp: now, costUsd: 0.05 }))

    // Filter: only last 2 hours
    const twoHoursAgo = now - 2 * 60 * 60 * 1000
    const summary = getSummary(twoHoursAgo)
    expect(summary.runCount).toBe(2)
    expect(summary.totalCostUsd).toBeCloseTo(0.15, 4)

    // Filter: only between hourAgo and now
    const summaryRange = getSummary(twoHoursAgo, hourAgo)
    expect(summaryRange.runCount).toBe(1)
    expect(summaryRange.totalCostUsd).toBeCloseTo(0.10, 4)
  })

  it('getHistory returns latest N records', () => {
    const now = Date.now()
    appendRecord(makeCostRecord({ timestamp: now - 3000, sessionId: 'oldest' }))
    appendRecord(makeCostRecord({ timestamp: now - 2000, sessionId: 'middle' }))
    appendRecord(makeCostRecord({ timestamp: now - 1000, sessionId: 'newest' }))

    const all = getHistory()
    expect(all.length).toBe(3)
    // Should be sorted descending (newest first)
    expect(all[0].sessionId).toBe('newest')
    expect(all[2].sessionId).toBe('oldest')

    const limited = getHistory(2)
    expect(limited.length).toBe(2)
    expect(limited[0].sessionId).toBe('newest')
    expect(limited[1].sessionId).toBe('middle')
  })

  it('byModel breakdown groups correctly', () => {
    appendRecord(makeCostRecord({ model: 'claude-sonnet-4-6', costUsd: 0.10 }))
    appendRecord(makeCostRecord({ model: 'claude-sonnet-4-6', costUsd: 0.05 }))
    appendRecord(makeCostRecord({ model: 'claude-opus-4-6', costUsd: 0.30 }))

    const summary = getSummary()
    expect(Object.keys(summary.byModel)).toHaveLength(2)
    expect(summary.byModel['claude-sonnet-4-6'].costUsd).toBeCloseTo(0.15, 4)
    expect(summary.byModel['claude-sonnet-4-6'].runs).toBe(2)
    expect(summary.byModel['claude-opus-4-6'].costUsd).toBeCloseTo(0.30, 4)
    expect(summary.byModel['claude-opus-4-6'].runs).toBe(1)
  })

  it('byProject breakdown groups correctly', () => {
    appendRecord(makeCostRecord({ projectPath: '/a', costUsd: 0.10 }))
    appendRecord(makeCostRecord({ projectPath: '/a', costUsd: 0.05 }))
    appendRecord(makeCostRecord({ projectPath: '/b', costUsd: 0.20 }))

    const summary = getSummary()
    expect(Object.keys(summary.byProject)).toHaveLength(2)
    expect(summary.byProject['/a'].costUsd).toBeCloseTo(0.15, 4)
    expect(summary.byProject['/a'].runs).toBe(2)
    expect(summary.byProject['/b'].costUsd).toBeCloseTo(0.20, 4)
    expect(summary.byProject['/b'].runs).toBe(1)
  })

  it('empty file returns zero summary', () => {
    const summary = getSummary()
    expect(summary.runCount).toBe(0)
    expect(summary.totalCostUsd).toBe(0)
    expect(summary.totalInputTokens).toBe(0)
    expect(summary.totalOutputTokens).toBe(0)
    expect(summary.totalDurationMs).toBe(0)
    expect(Object.keys(summary.byModel)).toHaveLength(0)
    expect(Object.keys(summary.byProject)).toHaveLength(0)
    expect(summary.byDay).toHaveLength(0)
  })

  it('byDay groups records by date', () => {
    // Two records on the same day, one on a different day
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    appendRecord(makeCostRecord({ timestamp: today.getTime(), costUsd: 0.10 }))
    appendRecord(makeCostRecord({ timestamp: today.getTime() + 1000, costUsd: 0.05 }))
    appendRecord(makeCostRecord({ timestamp: yesterday.getTime(), costUsd: 0.20 }))

    const summary = getSummary()
    expect(summary.byDay).toHaveLength(2)
    // Sorted ascending by date
    expect(summary.byDay[0].costUsd).toBeCloseTo(0.20, 4)
    expect(summary.byDay[0].runs).toBe(1)
    expect(summary.byDay[1].costUsd).toBeCloseTo(0.15, 4)
    expect(summary.byDay[1].runs).toBe(2)
  })

  it('handles null model gracefully', () => {
    appendRecord(makeCostRecord({ model: null, costUsd: 0.10 }))

    const summary = getSummary()
    expect(summary.byModel['unknown']).toBeDefined()
    expect(summary.byModel['unknown'].costUsd).toBeCloseTo(0.10, 4)
  })
})
