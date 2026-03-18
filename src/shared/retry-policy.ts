export const DEFAULT_AUTO_RESUME_MAX_RETRIES = 3

const AUTO_RESUME_DELAYS_MS = [0, 2_000, 8_000] as const

export function getAutoResumeDelayMs(attempt: number): number {
  if (attempt <= 1) return AUTO_RESUME_DELAYS_MS[0]
  if (attempt === 2) return AUTO_RESUME_DELAYS_MS[1]
  return AUTO_RESUME_DELAYS_MS[2]
}

export function canScheduleAutoResume(options: {
  enabled: boolean
  currentAttempt: number
  maxAttempts: number
  hasRunOptions: boolean
  isAlreadyRetrying: boolean
}): boolean {
  const { enabled, currentAttempt, maxAttempts, hasRunOptions, isAlreadyRetrying } = options

  if (!enabled) return false
  if (!hasRunOptions) return false
  if (isAlreadyRetrying) return false

  return currentAttempt < maxAttempts
}
