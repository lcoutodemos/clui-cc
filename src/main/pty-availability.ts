/**
 * Detect node-pty availability at runtime.
 *
 * node-pty is a native module that requires platform-specific prebuilt binaries
 * or compilation via Visual Studio Build Tools (Windows) / Xcode CLT (macOS).
 * If it fails to load, the app should gracefully fall back to stdio-only RunManager.
 */

let _available: boolean | null = null
let _reason: string | null = null

function probe(): void {
  if (_available !== null) return

  try {
    require('node-pty')
    _available = true
    _reason = null
  } catch (err: unknown) {
    _available = false
    _reason = err instanceof Error ? err.message : String(err)
  }
}

/**
 * Returns true if node-pty can be loaded successfully.
 * Result is cached after first check.
 */
export function isPtyAvailable(): boolean {
  probe()
  return _available!
}

/**
 * Returns the error message if node-pty failed to load, or null if available.
 */
export function getPtyUnavailableReason(): string | null {
  probe()
  return _reason
}
