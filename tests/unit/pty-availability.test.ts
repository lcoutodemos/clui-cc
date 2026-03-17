import { describe, it, expect, vi } from 'vitest'
import { isPtyAvailable, getPtyUnavailableReason } from '../../src/main/pty-availability'

describe('pty-availability', () => {
  it('isPtyAvailable returns a boolean', () => {
    const result = isPtyAvailable()
    expect(typeof result).toBe('boolean')
  })

  it('getPtyUnavailableReason returns null when pty is available', () => {
    if (isPtyAvailable()) {
      expect(getPtyUnavailableReason()).toBeNull()
    }
  })

  it('getPtyUnavailableReason returns a string when pty is not available', () => {
    if (!isPtyAvailable()) {
      const reason = getPtyUnavailableReason()
      expect(typeof reason).toBe('string')
      expect(reason!.length).toBeGreaterThan(0)
    }
  })
})
