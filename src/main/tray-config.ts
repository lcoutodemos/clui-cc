/**
 * Tray icon and lifecycle configuration — platform-aware defaults.
 */

export type CloseAction = 'quit' | 'minimize-to-tray'

/**
 * Returns the platform-appropriate tray icon filename.
 * - macOS: trayTemplate.png (uses template image for dark/light menu bar)
 * - Windows/Linux: icon.png
 */
export function getTrayIconFile(): string {
  return process.platform === 'darwin' ? 'trayTemplate.png' : 'icon.png'
}

/**
 * Returns the close button behavior.
 * Default on all platforms: minimize to tray (keep running in background).
 * Can be overridden by user preference.
 */
export function getCloseAction(preference?: CloseAction): CloseAction {
  return preference ?? 'minimize-to-tray'
}
