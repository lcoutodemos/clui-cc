/**
 * Helper to mock process.platform for cross-platform tests.
 *
 * Usage:
 *   const restore = mockPlatform('win32')
 *   // ... test code ...
 *   restore()
 *
 * Or use withPlatform() for automatic cleanup:
 *   await withPlatform('win32', () => { ... })
 */

export type Platform = 'win32' | 'darwin' | 'linux'

export function mockPlatform(platform: Platform): () => void {
  const original = process.platform
  Object.defineProperty(process, 'platform', { value: platform, writable: true })
  return () => {
    Object.defineProperty(process, 'platform', { value: original, writable: true })
  }
}

export async function withPlatform<T>(platform: Platform, fn: () => T | Promise<T>): Promise<T> {
  const restore = mockPlatform(platform)
  try {
    return await fn()
  } finally {
    restore()
  }
}
