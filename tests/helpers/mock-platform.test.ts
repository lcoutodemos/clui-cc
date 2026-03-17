import { describe, it, expect } from 'vitest'
import { mockPlatform, withPlatform } from './mock-platform'

describe('mockPlatform helper', () => {
  it('overrides process.platform and restores it', () => {
    const original = process.platform
    const restore = mockPlatform('darwin')

    expect(process.platform).toBe('darwin')

    restore()
    expect(process.platform).toBe(original)
  })

  it('withPlatform restores even if fn throws', async () => {
    const original = process.platform

    await expect(
      withPlatform('linux', () => {
        expect(process.platform).toBe('linux')
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(process.platform).toBe(original)
  })
})
