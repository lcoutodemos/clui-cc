import { describe, expect, it } from 'vitest'
import { buildSessionExportContent, DEFAULT_EXPORT_OPTIONS, getFilteredExportMessages, hasExportableMessages } from '../../src/shared/session-export'
import type { SessionExportData } from '../../src/shared/types'

const sampleData: SessionExportData = {
  title: 'API refactor review',
  exportedAt: '2026-03-18T14:00:00.000Z',
  sessionId: 'session-12345678',
  projectPath: 'C:/repo',
  model: 'claude-sonnet-4-6',
  messages: [
    { id: '1', role: 'user', content: 'Review this file for bugs.', timestamp: 1 },
    { id: '2', role: 'assistant', content: 'I found two problems.', timestamp: 2 },
    { id: '3', role: 'tool', content: '', toolName: 'Edit', toolInput: '{\"file\":\"src/app.ts\"}', toolStatus: 'completed', timestamp: 3 },
    { id: '4', role: 'system', content: 'Export ready.', timestamp: 4 },
  ],
  lastResult: {
    totalCostUsd: 0.0123,
    durationMs: 4200,
    numTurns: 3,
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
    sessionId: 'session-12345678',
  },
}

describe('session export formatter', () => {
  it('filters messages according to export options', () => {
    const filtered = getFilteredExportMessages(sampleData.messages, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeToolCalls: false,
    })

    expect(filtered.map((message) => message.role)).toEqual(['user', 'assistant', 'system'])
  })

  it('builds markdown export with metadata and tool blocks', () => {
    const content = buildSessionExportContent(sampleData, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeMetadata: true,
    })

    expect(content).toContain('# Session: API refactor review')
    expect(content).toContain('## User')
    expect(content).toContain('## Assistant')
    expect(content).toContain('### Tool: Edit')
    expect(content).toContain('```json')
    expect(content).toContain('Cost: $0.0123')
  })

  it('builds json export and omits metadata when disabled', () => {
    const content = buildSessionExportContent(sampleData, {
      ...DEFAULT_EXPORT_OPTIONS,
      format: 'json',
      includeMetadata: false,
    })

    const parsed = JSON.parse(content) as Record<string, unknown>
    expect(parsed.title).toBe('API refactor review')
    expect(parsed.model).toBe('claude-sonnet-4-6')
    expect(parsed).not.toHaveProperty('metadata')
    expect(Array.isArray(parsed.messages)).toBe(true)
  })

  it('detects when no messages remain after filtering', () => {
    expect(hasExportableMessages(sampleData, {
      ...DEFAULT_EXPORT_OPTIONS,
      includeUserMessages: false,
      includeAssistantMessages: false,
      includeToolCalls: false,
    })).toBe(false)
  })
})
