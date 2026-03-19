import { app, globalShortcut } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { DEFAULT_SHORTCUT_SETTINGS, type ShortcutSettings } from '../shared/types'

const MODIFIER_ALIASES: Record<string, string> = {
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  '⌥': 'Alt',
  shift: 'Shift',
  '⇧': 'Shift',
  ctrl: 'Control',
  control: 'Control',
  '^': 'Control',
  cmd: 'CommandOrControl',
  command: 'CommandOrControl',
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  cmdctrl: 'CommandOrControl',
  '⌘': 'CommandOrControl',
  super: 'Super',
  meta: 'Super',
  win: 'Super',
  windows: 'Super',
}

const KEY_ALIASES: Record<string, string> = {
  space: 'Space',
  spacebar: 'Space',
  enter: 'Enter',
  return: 'Enter',
  esc: 'Escape',
  escape: 'Escape',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  ins: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  pgup: 'PageUp',
  pgdn: 'PageDown',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
}

function getShortcutSettingsPath(): string {
  return join(app.getPath('userData'), 'shortcut-settings.json')
}

function normalizeShortcut(input: string): string {
  const rawParts = input
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)

  if (rawParts.length === 0) return ''

  const modifiers = new Set<string>()
  let key = ''

  for (const rawPart of rawParts) {
    const lower = rawPart.toLowerCase()
    const modifier = MODIFIER_ALIASES[lower]
    if (modifier) {
      modifiers.add(modifier)
      continue
    }

    if (key) {
      throw new Error('Only one non-modifier key is allowed per shortcut.')
    }

    if (/^f([1-9]|1\d|2[0-4])$/i.test(rawPart)) {
      key = rawPart.toUpperCase()
      continue
    }

    if (/^[a-z]$/i.test(rawPart)) {
      key = rawPart.toUpperCase()
      continue
    }

    if (/^\d$/.test(rawPart)) {
      key = rawPart
      continue
    }

    const aliasKey = KEY_ALIASES[lower]
    if (aliasKey) {
      key = aliasKey
      continue
    }

    throw new Error(`Unsupported key token: "${rawPart}"`)
  }

  if (!key) {
    throw new Error('A shortcut must include one non-modifier key.')
  }

  const orderedModifiers = ['CommandOrControl', 'Control', 'Alt', 'Shift', 'Super']
    .filter((modifier) => modifiers.has(modifier))

  return [...orderedModifiers, key].join('+')
}

function normalizeShortcutSettings(settings: ShortcutSettings): ShortcutSettings {
  const primaryShortcut = settings.primaryShortcut?.trim()
    ? normalizeShortcut(settings.primaryShortcut)
    : null
  const secondaryShortcut = settings.secondaryShortcut?.trim()
    ? normalizeShortcut(settings.secondaryShortcut)
    : null

  if (primaryShortcut && secondaryShortcut && secondaryShortcut === primaryShortcut) {
    throw new Error('Primary and secondary shortcuts must be different.')
  }

  return { primaryShortcut, secondaryShortcut }
}

export function loadShortcutSettings(): ShortcutSettings {
  try {
    const filePath = getShortcutSettingsPath()
    if (!existsSync(filePath)) return DEFAULT_SHORTCUT_SETTINGS

    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<ShortcutSettings>
    return normalizeShortcutSettings({
      primaryShortcut: raw.primaryShortcut ?? DEFAULT_SHORTCUT_SETTINGS.primaryShortcut,
      secondaryShortcut: raw.secondaryShortcut ?? DEFAULT_SHORTCUT_SETTINGS.secondaryShortcut,
    })
  } catch {
    return DEFAULT_SHORTCUT_SETTINGS
  }
}

export function saveShortcutSettings(settings: ShortcutSettings): void {
  const filePath = getShortcutSettingsPath()
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
}

export function registerShortcutSettings(
  settings: ShortcutSettings,
  onToggle: (source: string) => void,
): { ok: boolean; error?: string; settings: ShortcutSettings } {
  const normalized = normalizeShortcutSettings(settings)
  globalShortcut.unregisterAll()

  if (
    normalized.primaryShortcut &&
    !globalShortcut.register(normalized.primaryShortcut, () => onToggle(`shortcut ${normalized.primaryShortcut}`))
  ) {
    return {
      ok: false,
      error: `Could not register primary shortcut "${normalized.primaryShortcut}". It may be invalid or already in use.`,
      settings: normalized,
    }
  }

  if (
    normalized.secondaryShortcut &&
    !globalShortcut.register(normalized.secondaryShortcut, () => onToggle(`shortcut ${normalized.secondaryShortcut}`))
  ) {
    globalShortcut.unregisterAll()
    return {
      ok: false,
      error: `Could not register secondary shortcut "${normalized.secondaryShortcut}". It may be invalid or already in use.`,
      settings: normalized,
    }
  }

  return { ok: true, settings: normalized }
}
