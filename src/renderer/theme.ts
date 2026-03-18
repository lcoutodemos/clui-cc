/**
 * CLUI Design Tokens — Dual theme (dark + light)
 * Colors derived from ChatCN oklch system and design-fixed.html reference.
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
} as const

export type ColorPalette = { [K in keyof typeof darkColors]: string }

// ─── Theme store ───

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  isDark: boolean
  themeMode: ThemeMode
  soundEnabled: boolean
  expandedUI: boolean
  autoResumeEnabled: boolean
  autoResumeMaxRetries: number
  /** OS-reported dark mode — used when themeMode is 'system' */
  _systemIsDark: boolean
  setIsDark: (isDark: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  setSoundEnabled: (enabled: boolean) => void
  setExpandedUI: (expanded: boolean) => void
  setAutoResumeEnabled: (enabled: boolean) => void
  setAutoResumeMaxRetries: (retries: number) => void
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

function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.classList.toggle('light', !isDark)
  syncTokensToCss(isDark ? darkColors : lightColors)
}

const SETTINGS_KEY = 'clui-settings'

function loadSettings(): { themeMode: ThemeMode; soundEnabled: boolean; expandedUI: boolean; autoResumeEnabled: boolean; autoResumeMaxRetries: number } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        themeMode: ['light', 'dark'].includes(parsed.themeMode) ? parsed.themeMode : 'dark',
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        expandedUI: typeof parsed.expandedUI === 'boolean' ? parsed.expandedUI : false,
        autoResumeEnabled: typeof parsed.autoResumeEnabled === 'boolean' ? parsed.autoResumeEnabled : true,
        autoResumeMaxRetries: typeof parsed.autoResumeMaxRetries === 'number' ? parsed.autoResumeMaxRetries : 3,
      }
    }
  } catch {}
  return { themeMode: 'dark', soundEnabled: true, expandedUI: false, autoResumeEnabled: true, autoResumeMaxRetries: 3 }
}

function saveSettings(s: { themeMode: ThemeMode; soundEnabled: boolean; expandedUI: boolean; autoResumeEnabled: boolean; autoResumeMaxRetries: number }): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

// Always start in compact UI mode on launch.
const saved = { ...loadSettings(), expandedUI: false }

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: saved.themeMode === 'dark' ? true : saved.themeMode === 'light' ? false : true,
  themeMode: saved.themeMode,
  soundEnabled: saved.soundEnabled,
  expandedUI: saved.expandedUI,
  autoResumeEnabled: saved.autoResumeEnabled,
  autoResumeMaxRetries: saved.autoResumeMaxRetries,
  _systemIsDark: true,
  setIsDark: (isDark) => {
    set({ isDark })
    applyTheme(isDark)
  },
  setThemeMode: (mode) => {
    const resolved = mode === 'system' ? get()._systemIsDark : mode === 'dark'
    set({ themeMode: mode, isDark: resolved })
    applyTheme(resolved)
    saveSettings({ themeMode: mode, soundEnabled: get().soundEnabled, expandedUI: get().expandedUI, autoResumeEnabled: get().autoResumeEnabled, autoResumeMaxRetries: get().autoResumeMaxRetries })
  },
  setSoundEnabled: (enabled) => {
    set({ soundEnabled: enabled })
    saveSettings({ themeMode: get().themeMode, soundEnabled: enabled, expandedUI: get().expandedUI, autoResumeEnabled: get().autoResumeEnabled, autoResumeMaxRetries: get().autoResumeMaxRetries })
  },
  setExpandedUI: (expanded) => {
    set({ expandedUI: expanded })
    saveSettings({ themeMode: get().themeMode, soundEnabled: get().soundEnabled, expandedUI: expanded, autoResumeEnabled: get().autoResumeEnabled, autoResumeMaxRetries: get().autoResumeMaxRetries })
  },
  setAutoResumeEnabled: (enabled) => {
    set({ autoResumeEnabled: enabled })
    saveSettings({ themeMode: get().themeMode, soundEnabled: get().soundEnabled, expandedUI: get().expandedUI, autoResumeEnabled: enabled, autoResumeMaxRetries: get().autoResumeMaxRetries })
  },
  setAutoResumeMaxRetries: (retries) => {
    const next = Math.max(1, Math.floor(retries))
    set({ autoResumeMaxRetries: next })
    saveSettings({ themeMode: get().themeMode, soundEnabled: get().soundEnabled, expandedUI: get().expandedUI, autoResumeEnabled: get().autoResumeEnabled, autoResumeMaxRetries: next })
  },
  setSystemTheme: (isDark) => {
    set({ _systemIsDark: isDark })
    // Only apply if following system
    if (get().themeMode === 'system') {
      set({ isDark })
      applyTheme(isDark)
    }
  },
}))

// Initialize CSS vars with saved theme
syncTokensToCss(saved.themeMode === 'light' ? lightColors : darkColors)

/** Reactive hook — returns the active color palette */
export function useColors(): ColorPalette {
  const isDark = useThemeStore((s) => s.isDark)
  return isDark ? darkColors : lightColors
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
