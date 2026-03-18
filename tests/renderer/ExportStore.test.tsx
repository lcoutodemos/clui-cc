// Store tests — no DOM needed

import { beforeEach, describe, expect, it } from 'vitest'
import { useExportStore } from '../../src/renderer/stores/exportStore'
import type { SessionExportData } from '../../src/shared/types'

const mockData: SessionExportData = {
  messages: [{ id: '1', role: 'user', content: 'test', timestamp: Date.now() }],
  sessionId: 'test-session',
  tabTitle: 'Test',
  projectPath: '/tmp',
  model: 'opus',
  exportedAt: Date.now(),
}

describe('ExportStore', () => {
  beforeEach(() => {
    useExportStore.getState().closeDialog()
  })

  it('starts closed', () => {
    expect(useExportStore.getState().isOpen).toBe(false)
  })

  it('openDialog() sets isOpen to true with data', () => {
    useExportStore.getState().openDialog(mockData)
    const state = useExportStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.data).toBe(mockData)
  })

  it('closeDialog() sets isOpen to false and clears data', () => {
    useExportStore.getState().openDialog(mockData)
    useExportStore.getState().closeDialog()
    const state = useExportStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.data).toBeNull()
  })

  it('setOptions() updates export options', () => {
    useExportStore.getState().setOptions({ includeToolCalls: false })
    expect(useExportStore.getState().options.includeToolCalls).toBe(false)
  })

  it('setError() stores error message', () => {
    useExportStore.getState().setError('Export failed')
    expect(useExportStore.getState().error).toBe('Export failed')
  })
})
