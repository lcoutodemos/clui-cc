/**
 * Global shortcut configuration — user-configurable toggle shortcut
 * with conflict recovery and safe alternatives.
 *
 * Config persisted at ~/.claude/clui-shortcut.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

const CONFIG_PATH = join(homedir(), '.claude', 'clui-shortcut.json')

export interface ShortcutConfig {
  primary: string
}

/**
 * Returns the platform-appropriate default shortcut.
 * - macOS: Alt+Space (doesn't conflict with Spotlight, which uses Cmd+Space)
 * - Windows: Alt+Space (Ctrl+Space conflicts with IMEs on most Windows setups)
 */
export function getDefaultShortcut(): string {
  return 'Alt+Space'
}

/**
 * Returns a list of safe alternative shortcuts that are unlikely to conflict
 * with common system tools, IMEs, or other apps.
 */
export function getSafeAlternatives(): string[] {
  return [
    'CommandOrControl+Shift+Space',
    'CommandOrControl+Shift+K',
    'Alt+Shift+Space',
    'CommandOrControl+Alt+Space',
  ]
}

/**
 * Load shortcut config from disk, or return defaults.
 */
export function loadShortcutConfig(): ShortcutConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      if (data.primary && typeof data.primary === 'string') {
        return { primary: data.primary }
      }
    }
  } catch {}

  return { primary: getDefaultShortcut() }
}

/**
 * Save shortcut config to disk.
 */
export function saveShortcutConfig(config: ShortcutConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
}
