import { existsSync, mkdirSync, appendFileSync, readFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { CostRecord, CostSummary } from '../shared/types'

const CLUI_DIR = join(homedir(), '.clui')
const HISTORY_FILE = join(CLUI_DIR, 'cost-history.jsonl')
const PREV_FILE = join(CLUI_DIR, 'cost-history.prev.jsonl')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function ensureCluiDir(): void {
  if (!existsSync(CLUI_DIR)) {
    mkdirSync(CLUI_DIR, { recursive: true })
  }
}

function readRecordsFromFile(filePath: string): CostRecord[] {
  if (!existsSync(filePath)) return []
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim().length > 0)
    const records: CostRecord[] = []
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as CostRecord
        // Basic validation — must have timestamp and costUsd
        if (typeof parsed.timestamp === 'number' && typeof parsed.costUsd === 'number') {
          records.push(parsed)
        }
      } catch {
        // Skip malformed lines
      }
    }
    return records
  } catch {
    return []
  }
}

function getAllRecords(): CostRecord[] {
  const prev = readRecordsFromFile(PREV_FILE)
  const current = readRecordsFromFile(HISTORY_FILE)
  return [...prev, ...current]
}

function rotateIfNeeded(): void {
  try {
    if (!existsSync(HISTORY_FILE)) return
    const stat = statSync(HISTORY_FILE)
    if (stat.size >= MAX_FILE_SIZE) {
      renameSync(HISTORY_FILE, PREV_FILE)
    }
  } catch {
    // Rotation failure is non-fatal
  }
}

function buildEmptySummary(): CostSummary {
  return {
    totalCostUsd: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalDurationMs: 0,
    runCount: 0,
    byModel: {},
    byProject: {},
    byDay: [],
  }
}

export function appendRecord(record: CostRecord): void {
  ensureCluiDir()
  rotateIfNeeded()
  const line = JSON.stringify(record) + '\n'
  appendFileSync(HISTORY_FILE, line, 'utf-8')
}

export function getSummary(fromTimestamp?: number, toTimestamp?: number): CostSummary {
  let records = getAllRecords()

  if (fromTimestamp != null) {
    records = records.filter((r) => r.timestamp >= fromTimestamp)
  }
  if (toTimestamp != null) {
    records = records.filter((r) => r.timestamp <= toTimestamp)
  }

  if (records.length === 0) return buildEmptySummary()

  const summary = buildEmptySummary()
  const dayMap = new Map<string, { costUsd: number; runs: number }>()

  for (const r of records) {
    summary.totalCostUsd += r.costUsd
    summary.totalInputTokens += r.inputTokens
    summary.totalOutputTokens += r.outputTokens
    summary.totalDurationMs += r.durationMs
    summary.runCount += 1

    // By model
    const modelKey = r.model || 'unknown'
    if (!summary.byModel[modelKey]) {
      summary.byModel[modelKey] = { costUsd: 0, runs: 0 }
    }
    summary.byModel[modelKey].costUsd += r.costUsd
    summary.byModel[modelKey].runs += 1

    // By project
    const projectKey = r.projectPath || 'unknown'
    if (!summary.byProject[projectKey]) {
      summary.byProject[projectKey] = { costUsd: 0, runs: 0 }
    }
    summary.byProject[projectKey].costUsd += r.costUsd
    summary.byProject[projectKey].runs += 1

    // By day
    const date = new Date(r.timestamp).toISOString().slice(0, 10)
    const existing = dayMap.get(date)
    if (existing) {
      existing.costUsd += r.costUsd
      existing.runs += 1
    } else {
      dayMap.set(date, { costUsd: r.costUsd, runs: 1 })
    }
  }

  // Sort by day ascending
  summary.byDay = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({ date, ...data }))

  return summary
}

export function getHistory(limit?: number): CostRecord[] {
  const records = getAllRecords()
  // Sort by timestamp descending (most recent first)
  records.sort((a, b) => b.timestamp - a.timestamp)
  if (limit != null && limit > 0) {
    return records.slice(0, limit)
  }
  return records
}
