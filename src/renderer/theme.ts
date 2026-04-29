/**
 * CLUI Design Tokens.
 * Light/Dark are the original CLUI palettes. Latte/Mocha use Catppuccin palette anchors.
 */
import { create } from 'zustand'

// ─── Color palettes ───

const darkColors = {
  // Container (glass surfaces)
  containerBg: '#242422',
  containerBgCollapsed: '#21211e',
  containerBorder: '#3b3b36',
  containerShadow: '0 8px 28px rgba(0, 0, 0, 0.35), 0 1px 6px rgba(0, 0, 0, 0.25)',
  cardShadow: '0 2px 8px rgba(0,0,0,0.35)',
  cardShadowCollapsed: '0 2px 6px rgba(0,0,0,0.4)',

  // Surface layers
  surfacePrimary: '#353530',
  surfaceSecondary: '#42423d',
  surfaceHover: 'rgba(255, 255, 255, 0.05)',
  surfaceActive: 'rgba(255, 255, 255, 0.08)',

  // Input
  inputBg: 'transparent',
  inputBorder: '#3b3b36',
  inputFocusBorder: 'rgba(217, 119, 87, 0.4)',
  inputPillBg: '#2a2a27',

  // Text
  textPrimary: '#ccc9c0',
  textSecondary: '#c0bdb2',
  textTertiary: '#76766e',
  textMuted: '#353530',

  // Accent — orange
  accent: '#d97757',
  accentLight: 'rgba(217, 119, 87, 0.1)',
  accentSoft: 'rgba(217, 119, 87, 0.15)',

  // Status dots
  statusIdle: '#8a8a80',
  statusRunning: '#d97757',
  statusRunningBg: 'rgba(217, 119, 87, 0.1)',
  statusComplete: '#7aac8c',
  statusCompleteBg: 'rgba(122, 172, 140, 0.1)',
  statusError: '#c47060',
  statusErrorBg: 'rgba(196, 112, 96, 0.08)',
  statusDead: '#c47060',
  statusPermission: '#d97757',
  statusPermissionGlow: 'rgba(217, 119, 87, 0.4)',

  // Tab
  tabActive: '#353530',
  tabActiveBorder: '#4a4a45',
  tabInactive: 'transparent',
  tabHover: 'rgba(255, 255, 255, 0.05)',

  // User message bubble
  userBubble: '#353530',
  userBubbleBorder: '#4a4a45',
  userBubbleText: '#ccc9c0',

  // Tool card
  toolBg: '#353530',
  toolBorder: '#4a4a45',
  toolRunningBorder: 'rgba(217, 119, 87, 0.3)',
  toolRunningBg: 'rgba(217, 119, 87, 0.05)',

  // Timeline
  timelineLine: '#353530',
  timelineNode: 'rgba(217, 119, 87, 0.2)',
  timelineNodeActive: '#d97757',

  // Scrollbar
  scrollThumb: 'rgba(255, 255, 255, 0.15)',
  scrollThumbHover: 'rgba(255, 255, 255, 0.25)',

  // Stop button
  stopBg: '#ef4444',
  stopHover: '#dc2626',

  // Send button
  sendBg: '#d97757',
  sendHover: '#c96442',
  sendDisabled: 'rgba(217, 119, 87, 0.3)',

  // Popover
  popoverBg: '#292927',
  popoverBorder: '#3b3b36',
  popoverShadow: '0 4px 20px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)',

  // Code block
  codeBg: '#1a1a18',

  // Mic button
  micBg: '#353530',
  micColor: '#c0bdb2',
  micDisabled: '#42423d',

  // Placeholder
  placeholder: '#6b6b60',

  // Disabled button color
  btnDisabled: '#42423d',

  // Text on accent backgrounds
  textOnAccent: '#ffffff',

  // Button hover (CSS-only stack buttons)
  btnHoverColor: '#c0bdb2',
  btnHoverBg: '#302f2d',

  // Accent border variants (replaces hex-alpha concatenation antipattern)
  accentBorder: 'rgba(217, 119, 87, 0.19)',
  accentBorderMedium: 'rgba(217, 119, 87, 0.25)',

  // Permission card (amber)
  permissionBorder: 'rgba(245, 158, 11, 0.3)',
  permissionShadow: '0 2px 12px rgba(245, 158, 11, 0.08)',
  permissionHeaderBg: 'rgba(245, 158, 11, 0.06)',
  permissionHeaderBorder: 'rgba(245, 158, 11, 0.12)',

  // Permission allow (green)
  permissionAllowBg: 'rgba(34, 197, 94, 0.1)',
  permissionAllowHoverBg: 'rgba(34, 197, 94, 0.22)',
  permissionAllowBorder: 'rgba(34, 197, 94, 0.25)',

  // Permission deny (red)
  permissionDenyBg: 'rgba(239, 68, 68, 0.08)',
  permissionDenyHoverBg: 'rgba(239, 68, 68, 0.18)',
  permissionDenyBorder: 'rgba(239, 68, 68, 0.22)',

  // Permission denied card
  permissionDeniedBorder: 'rgba(196, 112, 96, 0.3)',
  permissionDeniedHeaderBorder: 'rgba(196, 112, 96, 0.12)',

  // Diff (Edit tool inline diff)
  diffRemovedBg: 'rgba(248, 81, 73, 0.1)',
  diffAddedBg: 'rgba(63, 185, 80, 0.1)',
} as const

const lightColors = {
  // Container (glass surfaces)
  containerBg: '#f9f8f5',
  containerBgCollapsed: '#f4f2ed',
  containerBorder: '#dddad2',
  containerShadow: '0 8px 28px rgba(0, 0, 0, 0.08), 0 1px 6px rgba(0, 0, 0, 0.04)',
  cardShadow: '0 2px 8px rgba(0,0,0,0.06)',
  cardShadowCollapsed: '0 2px 6px rgba(0,0,0,0.08)',

  // Surface layers
  surfacePrimary: '#edeae0',
  surfaceSecondary: '#dddad2',
  surfaceHover: 'rgba(0, 0, 0, 0.04)',
  surfaceActive: 'rgba(0, 0, 0, 0.06)',

  // Input
  inputBg: 'transparent',
  inputBorder: '#dddad2',
  inputFocusBorder: 'rgba(217, 119, 87, 0.4)',
  inputPillBg: '#ffffff',

  // Text
  textPrimary: '#3c3929',
  textSecondary: '#5a5749',
  textTertiary: '#8a8a80',
  textMuted: '#dddad2',

  // Accent — orange (same)
  accent: '#d97757',
  accentLight: 'rgba(217, 119, 87, 0.1)',
  accentSoft: 'rgba(217, 119, 87, 0.12)',

  // Status dots
  statusIdle: '#8a8a80',
  statusRunning: '#d97757',
  statusRunningBg: 'rgba(217, 119, 87, 0.1)',
  statusComplete: '#5a9e6f',
  statusCompleteBg: 'rgba(90, 158, 111, 0.1)',
  statusError: '#c47060',
  statusErrorBg: 'rgba(196, 112, 96, 0.06)',
  statusDead: '#c47060',
  statusPermission: '#d97757',
  statusPermissionGlow: 'rgba(217, 119, 87, 0.3)',

  // Tab
  tabActive: '#edeae0',
  tabActiveBorder: '#dddad2',
  tabInactive: 'transparent',
  tabHover: 'rgba(0, 0, 0, 0.04)',

  // User message bubble
  userBubble: '#edeae0',
  userBubbleBorder: '#dddad2',
  userBubbleText: '#3c3929',

  // Tool card
  toolBg: '#edeae0',
  toolBorder: '#dddad2',
  toolRunningBorder: 'rgba(217, 119, 87, 0.3)',
  toolRunningBg: 'rgba(217, 119, 87, 0.05)',

  // Timeline
  timelineLine: '#dddad2',
  timelineNode: 'rgba(217, 119, 87, 0.2)',
  timelineNodeActive: '#d97757',

  // Scrollbar
  scrollThumb: 'rgba(0, 0, 0, 0.1)',
  scrollThumbHover: 'rgba(0, 0, 0, 0.18)',

  // Stop button
  stopBg: '#ef4444',
  stopHover: '#dc2626',

  // Send button
  sendBg: '#d97757',
  sendHover: '#c96442',
  sendDisabled: 'rgba(217, 119, 87, 0.3)',

  // Popover
  popoverBg: '#f9f8f5',
  popoverBorder: '#dddad2',
  popoverShadow: '0 4px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)',

  // Code block
  codeBg: '#f0eee8',

  // Mic button
  micBg: '#edeae0',
  micColor: '#5a5749',
  micDisabled: '#c8c5bc',

  // Placeholder
  placeholder: '#b0ada4',

  // Disabled button color
  btnDisabled: '#c8c5bc',

  // Text on accent backgrounds
  textOnAccent: '#ffffff',

  // Button hover (CSS-only stack buttons)
  btnHoverColor: '#3c3929',
  btnHoverBg: '#edeae0',

  // Accent border variants (replaces hex-alpha concatenation antipattern)
  accentBorder: 'rgba(217, 119, 87, 0.19)',
  accentBorderMedium: 'rgba(217, 119, 87, 0.25)',

  // Permission card (amber)
  permissionBorder: 'rgba(245, 158, 11, 0.3)',
  permissionShadow: '0 2px 12px rgba(245, 158, 11, 0.08)',
  permissionHeaderBg: 'rgba(245, 158, 11, 0.06)',
  permissionHeaderBorder: 'rgba(245, 158, 11, 0.12)',

  // Permission allow (green)
  permissionAllowBg: 'rgba(34, 197, 94, 0.1)',
  permissionAllowHoverBg: 'rgba(34, 197, 94, 0.22)',
  permissionAllowBorder: 'rgba(34, 197, 94, 0.25)',

  // Permission deny (red)
  permissionDenyBg: 'rgba(239, 68, 68, 0.08)',
  permissionDenyHoverBg: 'rgba(239, 68, 68, 0.18)',
  permissionDenyBorder: 'rgba(239, 68, 68, 0.22)',

  // Permission denied card
  permissionDeniedBorder: 'rgba(196, 112, 96, 0.3)',
  permissionDeniedHeaderBorder: 'rgba(196, 112, 96, 0.12)',

  // Diff (Edit tool inline diff)
  diffRemovedBg: 'rgba(248, 81, 73, 0.15)',
  diffAddedBg: 'rgba(63, 185, 80, 0.15)',
} as const

const latteColors = {
  ...lightColors,
  containerBg: '#eff1f5',
  containerBgCollapsed: '#e6e9ef',
  containerBorder: '#ccd0da',
  containerShadow: '0 8px 28px rgba(76, 79, 105, 0.14), 0 1px 6px rgba(76, 79, 105, 0.08)',
  cardShadow: '0 2px 8px rgba(76, 79, 105, 0.10)',
  cardShadowCollapsed: '0 2px 6px rgba(76, 79, 105, 0.12)',
  surfacePrimary: '#e6e9ef',
  surfaceSecondary: '#ccd0da',
  surfaceHover: 'rgba(76, 79, 105, 0.06)',
  surfaceActive: 'rgba(76, 79, 105, 0.09)',
  inputBorder: '#bcc0cc',
  inputFocusBorder: 'rgba(254, 100, 11, 0.38)',
  inputPillBg: '#eff1f5',
  textPrimary: '#4c4f69',
  textSecondary: '#5c5f77',
  textTertiary: '#7c7f93',
  textMuted: '#bcc0cc',
  accent: '#fe640b',
  accentLight: 'rgba(254, 100, 11, 0.10)',
  accentSoft: 'rgba(254, 100, 11, 0.14)',
  statusIdle: '#8c8fa1',
  statusRunning: '#fe640b',
  statusRunningBg: 'rgba(254, 100, 11, 0.10)',
  statusComplete: '#40a02b',
  statusCompleteBg: 'rgba(64, 160, 43, 0.10)',
  statusError: '#d20f39',
  statusErrorBg: 'rgba(210, 15, 57, 0.07)',
  statusDead: '#d20f39',
  statusPermission: '#fe640b',
  statusPermissionGlow: 'rgba(254, 100, 11, 0.30)',
  tabActive: '#e6e9ef',
  tabActiveBorder: '#bcc0cc',
  tabHover: 'rgba(76, 79, 105, 0.06)',
  userBubble: '#e6e9ef',
  userBubbleBorder: '#bcc0cc',
  userBubbleText: '#4c4f69',
  toolBg: '#e6e9ef',
  toolBorder: '#bcc0cc',
  toolRunningBorder: 'rgba(254, 100, 11, 0.28)',
  toolRunningBg: 'rgba(254, 100, 11, 0.06)',
  timelineLine: '#ccd0da',
  timelineNode: 'rgba(254, 100, 11, 0.20)',
  timelineNodeActive: '#fe640b',
  sendBg: '#fe640b',
  sendHover: '#df8e1d',
  sendDisabled: 'rgba(254, 100, 11, 0.30)',
  popoverBg: '#eff1f5',
  popoverBorder: '#ccd0da',
  popoverShadow: '0 4px 20px rgba(76, 79, 105, 0.16), 0 1px 4px rgba(76, 79, 105, 0.08)',
  codeBg: '#e6e9ef',
  micBg: '#e6e9ef',
  micColor: '#5c5f77',
  micDisabled: '#ccd0da',
  placeholder: '#9ca0b0',
  btnDisabled: '#bcc0cc',
  textOnAccent: '#eff1f5',
  btnHoverColor: '#4c4f69',
  btnHoverBg: '#e6e9ef',
  accentBorder: 'rgba(254, 100, 11, 0.19)',
  accentBorderMedium: 'rgba(254, 100, 11, 0.25)',
  permissionBorder: 'rgba(223, 142, 29, 0.30)',
  permissionShadow: '0 2px 12px rgba(223, 142, 29, 0.08)',
  permissionHeaderBg: 'rgba(223, 142, 29, 0.08)',
  permissionHeaderBorder: 'rgba(223, 142, 29, 0.15)',
  permissionAllowBg: 'rgba(64, 160, 43, 0.10)',
  permissionAllowHoverBg: 'rgba(64, 160, 43, 0.20)',
  permissionAllowBorder: 'rgba(64, 160, 43, 0.25)',
  permissionDenyBg: 'rgba(210, 15, 57, 0.08)',
  permissionDenyHoverBg: 'rgba(210, 15, 57, 0.16)',
  permissionDenyBorder: 'rgba(210, 15, 57, 0.22)',
  permissionDeniedBorder: 'rgba(210, 15, 57, 0.30)',
  permissionDeniedHeaderBorder: 'rgba(210, 15, 57, 0.12)',
  diffRemovedBg: 'rgba(210, 15, 57, 0.12)',
  diffAddedBg: 'rgba(64, 160, 43, 0.12)',
} as const

const mochaColors = {
  ...darkColors,
  containerBg: '#1e1e2e',
  containerBgCollapsed: '#181825',
  containerBorder: '#45475a',
  containerShadow: '0 8px 28px rgba(17, 17, 27, 0.55), 0 1px 6px rgba(17, 17, 27, 0.35)',
  cardShadow: '0 2px 8px rgba(17, 17, 27, 0.45)',
  cardShadowCollapsed: '0 2px 6px rgba(17, 17, 27, 0.50)',
  surfacePrimary: '#313244',
  surfaceSecondary: '#45475a',
  surfaceHover: 'rgba(205, 214, 244, 0.06)',
  surfaceActive: 'rgba(205, 214, 244, 0.09)',
  inputBorder: '#45475a',
  inputFocusBorder: 'rgba(250, 179, 135, 0.42)',
  inputPillBg: '#181825',
  textPrimary: '#cdd6f4',
  textSecondary: '#bac2de',
  textTertiary: '#9399b2',
  textMuted: '#585b70',
  accent: '#fab387',
  accentLight: 'rgba(250, 179, 135, 0.10)',
  accentSoft: 'rgba(250, 179, 135, 0.15)',
  statusIdle: '#9399b2',
  statusRunning: '#fab387',
  statusRunningBg: 'rgba(250, 179, 135, 0.10)',
  statusComplete: '#a6e3a1',
  statusCompleteBg: 'rgba(166, 227, 161, 0.10)',
  statusError: '#f38ba8',
  statusErrorBg: 'rgba(243, 139, 168, 0.09)',
  statusDead: '#f38ba8',
  statusPermission: '#fab387',
  statusPermissionGlow: 'rgba(250, 179, 135, 0.38)',
  tabActive: '#313244',
  tabActiveBorder: '#585b70',
  tabHover: 'rgba(205, 214, 244, 0.06)',
  userBubble: '#313244',
  userBubbleBorder: '#585b70',
  userBubbleText: '#cdd6f4',
  toolBg: '#313244',
  toolBorder: '#585b70',
  toolRunningBorder: 'rgba(250, 179, 135, 0.30)',
  toolRunningBg: 'rgba(250, 179, 135, 0.06)',
  timelineLine: '#313244',
  timelineNode: 'rgba(250, 179, 135, 0.22)',
  timelineNodeActive: '#fab387',
  sendBg: '#fab387',
  sendHover: '#f9e2af',
  sendDisabled: 'rgba(250, 179, 135, 0.30)',
  popoverBg: '#1e1e2e',
  popoverBorder: '#45475a',
  popoverShadow: '0 4px 20px rgba(17, 17, 27, 0.48), 0 1px 4px rgba(17, 17, 27, 0.32)',
  codeBg: '#11111b',
  micBg: '#313244',
  micColor: '#bac2de',
  micDisabled: '#45475a',
  placeholder: '#7f849c',
  btnDisabled: '#45475a',
  textOnAccent: '#1e1e2e',
  btnHoverColor: '#cdd6f4',
  btnHoverBg: '#313244',
  accentBorder: 'rgba(250, 179, 135, 0.20)',
  accentBorderMedium: 'rgba(250, 179, 135, 0.28)',
  permissionBorder: 'rgba(249, 226, 175, 0.30)',
  permissionShadow: '0 2px 12px rgba(249, 226, 175, 0.08)',
  permissionHeaderBg: 'rgba(249, 226, 175, 0.07)',
  permissionHeaderBorder: 'rgba(249, 226, 175, 0.14)',
  permissionAllowBg: 'rgba(166, 227, 161, 0.10)',
  permissionAllowHoverBg: 'rgba(166, 227, 161, 0.20)',
  permissionAllowBorder: 'rgba(166, 227, 161, 0.25)',
  permissionDenyBg: 'rgba(243, 139, 168, 0.08)',
  permissionDenyHoverBg: 'rgba(243, 139, 168, 0.17)',
  permissionDenyBorder: 'rgba(243, 139, 168, 0.22)',
  permissionDeniedBorder: 'rgba(243, 139, 168, 0.30)',
  permissionDeniedHeaderBorder: 'rgba(243, 139, 168, 0.12)',
  diffRemovedBg: 'rgba(243, 139, 168, 0.11)',
  diffAddedBg: 'rgba(166, 227, 161, 0.11)',
} as const

export type ColorPalette = { [K in keyof typeof darkColors]: string }

// ─── Theme store ───

export type ThemeMode = 'system' | 'light' | 'latte' | 'dark' | 'mocha'

interface ThemeState {
  isDark: boolean
  themeMode: ThemeMode
  soundEnabled: boolean
  expandedUI: boolean
  /** OS-reported dark mode — used when themeMode is 'system' */
  _systemIsDark: boolean
  setIsDark: (isDark: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  setSoundEnabled: (enabled: boolean) => void
  setExpandedUI: (expanded: boolean) => void
  /** Called by OS theme change listener — updates system value */
  setSystemTheme: (isDark: boolean) => void
}

/** Convert camelCase token name to --clui-kebab-case CSS custom property */
function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

/** Sync all JS design tokens to CSS custom properties on :root */
function syncTokensToCss(tokens: ColorPalette): void {
  const style = document.documentElement.style
  for (const [key, value] of Object.entries(tokens)) {
    style.setProperty(`--clui-${camelToKebab(key)}`, value)
  }
}

const themePalettes = {
  light: lightColors,
  latte: latteColors,
  dark: darkColors,
  mocha: mochaColors,
} as const

function paletteForMode(mode: ThemeMode, systemIsDark: boolean): ColorPalette {
  if (mode === 'system') return systemIsDark ? darkColors : lightColors
  return themePalettes[mode]
}

function isDarkTheme(mode: ThemeMode, systemIsDark: boolean): boolean {
  if (mode === 'system') return systemIsDark
  return mode === 'dark' || mode === 'mocha'
}

function applyTheme(mode: ThemeMode, systemIsDark: boolean): void {
  const isDark = isDarkTheme(mode, systemIsDark)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.classList.toggle('light', !isDark)
  document.documentElement.dataset.theme = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode
  syncTokensToCss(paletteForMode(mode, systemIsDark))
}

const SETTINGS_KEY = 'clui-settings'

function loadSettings(): { themeMode: ThemeMode; soundEnabled: boolean; expandedUI: boolean } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        themeMode: ['light', 'latte', 'dark', 'mocha', 'system'].includes(parsed.themeMode) ? parsed.themeMode : 'dark',
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        expandedUI: typeof parsed.expandedUI === 'boolean' ? parsed.expandedUI : false,
      }
    }
  } catch {}
  return { themeMode: 'dark', soundEnabled: true, expandedUI: false }
}

function saveSettings(s: { themeMode: ThemeMode; soundEnabled: boolean; expandedUI: boolean }): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

// Always start in compact UI mode on launch.
const saved = { ...loadSettings(), expandedUI: false }

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: isDarkTheme(saved.themeMode, true),
  themeMode: saved.themeMode,
  soundEnabled: saved.soundEnabled,
  expandedUI: saved.expandedUI,
  _systemIsDark: true,
  setIsDark: (isDark) => {
    const themeMode = isDark ? 'dark' : 'light'
    set({ themeMode, isDark })
    applyTheme(themeMode, get()._systemIsDark)
    saveSettings({ themeMode, soundEnabled: get().soundEnabled, expandedUI: get().expandedUI })
  },
  setThemeMode: (mode) => {
    const resolved = isDarkTheme(mode, get()._systemIsDark)
    set({ themeMode: mode, isDark: resolved })
    applyTheme(mode, get()._systemIsDark)
    saveSettings({ themeMode: mode, soundEnabled: get().soundEnabled, expandedUI: get().expandedUI })
  },
  setSoundEnabled: (enabled) => {
    set({ soundEnabled: enabled })
    saveSettings({ themeMode: get().themeMode, soundEnabled: enabled, expandedUI: get().expandedUI })
  },
  setExpandedUI: (expanded) => {
    set({ expandedUI: expanded })
    saveSettings({ themeMode: get().themeMode, soundEnabled: get().soundEnabled, expandedUI: expanded })
  },
  setSystemTheme: (isDark) => {
    set({ _systemIsDark: isDark })
    // Only apply if following system
    if (get().themeMode === 'system') {
      set({ isDark })
      applyTheme('system', isDark)
    }
  },
}))

// Initialize CSS vars with saved theme
applyTheme(saved.themeMode, true)

/** Reactive hook — returns the active color palette */
export function useColors(): ColorPalette {
  const themeMode = useThemeStore((s) => s.themeMode)
  const systemIsDark = useThemeStore((s) => s._systemIsDark)
  return paletteForMode(themeMode, systemIsDark)
}

/** Non-reactive getter — use outside React components */
export function getColors(isDark: boolean): ColorPalette {
  return isDark ? darkColors : lightColors
}

// ─── Backward compatibility ───
// Legacy static export — components being migrated should use useColors() instead
export const colors = darkColors

// ─── Spacing ───

export const spacing = {
  contentWidth: 460,
  containerRadius: 20,
  containerPadding: 12,
  tabHeight: 32,
  inputMinHeight: 44,
  inputMaxHeight: 160,
  conversationMaxHeight: 380,
  pillRadius: 9999,
  circleSize: 36,
  circleGap: 8,
} as const

// ─── Animation ───

export const motion = {
  spring: { type: 'spring' as const, stiffness: 500, damping: 30 },
  easeOut: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const },
  fadeIn: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: 0.15 },
  },
} as const
