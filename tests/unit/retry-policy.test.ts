import { describe, expect, it } from 'vitest'
import { canScheduleAutoResume, DEFAULT_AUTO_RESUME_MAX_RETRIES, getAutoResumeDelayMs } from '../../src/shared/retry-policy'

describe('retry-policy', () => {
  describe('getAutoResumeDelayMs', () => {
    it('uses immediate first retry', () => {
      expect(getAutoResumeDelayMs(1)).toBe(0)
    })

    it('uses 2s for the second attempt', () => {
      expect(getAutoResumeDelayMs(2)).toBe(2_000)
    })

    it('uses 8s for the third and later attempts', () => {
      expect(getAutoResumeDelayMs(3)).toBe(8_000)
      expect(getAutoResumeDelayMs(4)).toBe(8_000)
    })
  })

  describe('canScheduleAutoResume', () => {
    it('allows retry when enabled and under max attempts', () => {
      expect(canScheduleAutoResume({
        enabled: true,
        currentAttempt: 0,
        maxAttempts: DEFAULT_AUTO_RESUME_MAX_RETRIES,
        hasRunOptions: true,
        isAlreadyRetrying: false,
      })).toBe(true)
    })

    it('blocks retry when disabled', () => {
      expect(canScheduleAutoResume({
        enabled: false,
        currentAttempt: 0,
        maxAttempts: DEFAULT_AUTO_RESUME_MAX_RETRIES,
        hasRunOptions: true,
        isAlreadyRetrying: false,
      })).toBe(false)
    })

    it('blocks retry when there is no stored run payload', () => {
      expect(canScheduleAutoResume({
        enabled: true,
        currentAttempt: 0,
        maxAttempts: DEFAULT_AUTO_RESUME_MAX_RETRIES,
        hasRunOptions: false,
        isAlreadyRetrying: false,
      })).toBe(false)
    })

    it('blocks retry when already retrying', () => {
      expect(canScheduleAutoResume({
        enabled: true,
        currentAttempt: 1,
        maxAttempts: DEFAULT_AUTO_RESUME_MAX_RETRIES,
        hasRunOptions: true,
        isAlreadyRetrying: true,
      })).toBe(false)
    })

    it('blocks retry when attempts are exhausted', () => {
      expect(canScheduleAutoResume({
        enabled: true,
        currentAttempt: DEFAULT_AUTO_RESUME_MAX_RETRIES,
        maxAttempts: DEFAULT_AUTO_RESUME_MAX_RETRIES,
        hasRunOptions: true,
        isAlreadyRetrying: false,
      })).toBe(false)
    })
  })
})
