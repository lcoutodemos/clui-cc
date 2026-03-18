import { describe, expect, it } from 'vitest'
import { IPC } from '../../src/shared/types'

describe('Renderer error logging IPC', () => {
  it('LOG_RENDERER_ERROR channel is defined in IPC constants', () => {
    expect(IPC.LOG_RENDERER_ERROR).toBe('clui:log-renderer-error')
  })

  it('channel name follows clui: prefix convention', () => {
    expect(IPC.LOG_RENDERER_ERROR).toMatch(/^clui:/)
  })
})
