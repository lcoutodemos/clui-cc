import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { DotsThree, Bell, ArrowsOutSimple, Moon, Keyboard, Target, X } from '@phosphor-icons/react'
import { useThemeStore } from '../theme'
import { useSessionStore } from '../stores/sessionStore'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'
import { DEFAULT_SHORTCUT_SETTINGS } from '../../shared/types'

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

function eventToShortcut(e: React.KeyboardEvent): { value: string | null; preview: string } {
  const modifiers: string[] = []
  if (e.metaKey) modifiers.push('CommandOrControl')
  if (e.ctrlKey) modifiers.push('Control')
  if (e.altKey) modifiers.push('Alt')
  if (e.shiftKey) modifiers.push('Shift')

  const key = e.key
  const preview = [...modifiers, ...(!MODIFIER_KEYS.has(key) ? [normalizeKey(key)] : [])].join('+')

  if (MODIFIER_KEYS.has(key)) {
    return { value: null, preview: modifiers.join('+') }
  }

  return {
    value: [...modifiers, normalizeKey(key)].join('+'),
    preview,
  }
}

function normalizeKey(key: string): string {
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  if (key === 'ArrowUp') return 'Up'
  if (key === 'ArrowDown') return 'Down'
  if (key === 'ArrowLeft') return 'Left'
  if (key === 'ArrowRight') return 'Right'
  if (key === 'Escape') return 'Escape'
  return key
}

function RowToggle({
  checked,
  onChange,
  colors,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  colors: ReturnType<typeof useColors>
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className="relative w-9 h-5 rounded-full transition-colors"
      style={{
        background: checked ? colors.accent : colors.surfaceSecondary,
        border: `1px solid ${checked ? colors.accent : colors.containerBorder}`,
      }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all"
        style={{
          left: checked ? 18 : 2,
          background: '#fff',
        }}
      />
    </button>
  )
}

/* ─── Settings popover ─── */

export function SettingsPopover() {
  const soundEnabled = useThemeStore((s) => s.soundEnabled)
  const setSoundEnabled = useThemeStore((s) => s.setSoundEnabled)
  const themeMode = useThemeStore((s) => s.themeMode)
  const setThemeMode = useThemeStore((s) => s.setThemeMode)
  const expandedUI = useThemeStore((s) => s.expandedUI)
  const setExpandedUI = useThemeStore((s) => s.setExpandedUI)
  const isExpanded = useSessionStore((s) => s.isExpanded)
  const shortcutSettings = useSessionStore((s) => s.shortcutSettings)
  const shortcutSettingsSaving = useSessionStore((s) => s.shortcutSettingsSaving)
  const shortcutSettingsError = useSessionStore((s) => s.shortcutSettingsError)
  const loadShortcutSettings = useSessionStore((s) => s.loadShortcutSettings)
  const saveShortcutSettings = useSessionStore((s) => s.saveShortcutSettings)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
  const [primaryShortcut, setPrimaryShortcut] = useState(DEFAULT_SHORTCUT_SETTINGS.primaryShortcut || '')
  const [secondaryShortcut, setSecondaryShortcut] = useState(DEFAULT_SHORTCUT_SETTINGS.secondaryShortcut || '')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [recordingTarget, setRecordingTarget] = useState<'primary' | 'secondary' | null>(null)
  const [recordingPreview, setRecordingPreview] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number; maxHeight?: number }>({ right: 0 })

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const gap = 6 // Match HistoryPicker spacing exactly.
    const margin = 8
    const right = window.innerWidth - rect.right

    if (isExpanded) {
      // Keep anchored below trigger (so it never covers the dots button),
      // and shrink if needed instead of shifting upward onto the trigger.
      const top = rect.bottom + gap
      setPos({
        top,
        right,
        maxHeight: Math.max(120, window.innerHeight - top - margin),
      })
      return
    }

    // Same logic as HistoryPicker for collapsed mode: open upward from trigger.
    setPos({
      bottom: window.innerHeight - rect.top + gap,
      right,
      maxHeight: undefined,
    })
  }, [isExpanded])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onResize = () => updatePos()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, updatePos])

  // Keep panel tracking the trigger continuously while open so it follows
  // width/position animations of the top bar without feeling "stuck in space."
  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      updatePos()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [open, expandedUI, isExpanded, updatePos])

  useEffect(() => {
    if (!open || shortcutSettings) return
    void loadShortcutSettings()
  }, [open, shortcutSettings, loadShortcutSettings])

  useEffect(() => {
    if (!shortcutSettings) return
    setPrimaryShortcut(shortcutSettings.primaryShortcut || '')
    setSecondaryShortcut(shortcutSettings.secondaryShortcut || '')
  }, [shortcutSettings])

  const handleToggle = () => {
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  const handleSaveShortcuts = async () => {
    setSaveMessage(null)
    const ok = await saveShortcutSettings({
      primaryShortcut: primaryShortcut.trim() || null,
      secondaryShortcut: secondaryShortcut.trim() || null,
    })
    if (ok) setSaveMessage('Shortcut updated')
  }

  const stopRecording = () => {
    setRecordingTarget(null)
    setRecordingPreview('')
  }

  const handleRecorderKeyDown = (target: 'primary' | 'secondary') => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setSaveMessage(null)

    if (e.key === 'Escape') {
      stopRecording()
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (target === 'primary') setPrimaryShortcut('')
      else setSecondaryShortcut('')
      stopRecording()
      return
    }

    const { value, preview } = eventToShortcut(e)
    setRecordingPreview(preview)
    if (!value) return

    if (target === 'primary') setPrimaryShortcut(value)
    else setSecondaryShortcut(value)
    stopRecording()
  }

  const renderShortcutRecorder = (
    label: string,
    value: string,
    target: 'primary' | 'secondary',
    placeholder: string,
  ) => {
    const isRecording = recordingTarget === target

    return (
      <div className="flex flex-col gap-1">
        <label className="text-[10px]" style={{ color: colors.textTertiary }}>
          {label}
        </label>
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => {
              if (target === 'primary') setPrimaryShortcut(e.target.value)
              else setSecondaryShortcut(e.target.value)
              setSaveMessage(null)
            }}
            placeholder={isRecording ? 'Press shortcut...' : placeholder}
            className="flex-1 px-2 py-1.5 rounded-md text-[11px] outline-none min-w-0"
            style={{
              background: colors.surfaceSecondary,
              color: value ? colors.textPrimary : colors.textMuted,
              border: `1px solid ${isRecording ? colors.accent : colors.containerBorder}`,
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (isRecording) {
                stopRecording()
              } else {
                setRecordingTarget(target)
                setRecordingPreview('')
                setSaveMessage(null)
              }
            }}
            onBlur={() => {
              if (recordingTarget === target) stopRecording()
            }}
            onKeyDown={handleRecorderKeyDown(target)}
            aria-label={isRecording ? `Stop recording ${label} shortcut` : `Record ${label} shortcut`}
            title={isRecording ? 'Stop recording' : 'Record shortcut'}
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: isRecording ? colors.accent : colors.surfaceSecondary,
              color: isRecording ? '#fff' : colors.textSecondary,
              border: `1px solid ${isRecording ? colors.accent : colors.containerBorder}`,
            }}
          >
            <Target size={13} weight={isRecording ? 'fill' : 'bold'} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (target === 'primary') setPrimaryShortcut('')
              else setSecondaryShortcut('')
              setSaveMessage(null)
              if (recordingTarget === target) stopRecording()
            }}
            aria-label={`Clear ${label} shortcut`}
            title="Clear shortcut"
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: colors.surfaceSecondary,
              color: colors.textSecondary,
              border: `1px solid ${colors.containerBorder}`,
              opacity: value ? 1 : 0.55,
            }}
          >
            <X size={13} weight="bold" />
          </button>
        </div>
        {isRecording && recordingPreview && (
          <div className="text-[10px] leading-[1.4]" style={{ color: colors.accent }}>
            {recordingPreview}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
        style={{ color: colors.textTertiary }}
        title="Settings"
      >
        <DotsThree size={16} weight="bold" />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-clui-ui
          initial={{ opacity: 0, y: isExpanded ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isExpanded ? -4 : 4 }}
          transition={{ duration: 0.12 }}
            className="rounded-xl"
          style={{
            position: 'fixed',
            ...(pos.top != null ? { top: pos.top } : {}),
            ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
            right: pos.right,
            width: 264,
            pointerEvents: 'auto',
            background: colors.popoverBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
            border: `1px solid ${colors.popoverBorder}`,
            ...(pos.maxHeight != null ? { maxHeight: pos.maxHeight, overflowY: 'auto' as const } : {}),
          }}
        >
          <div className="p-3 flex flex-col gap-2.5">
            {/* Full width */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowsOutSimple size={14} style={{ color: colors.textTertiary }} />
                  <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                    Full width
                  </div>
                </div>
                <RowToggle
                  checked={expandedUI}
                  onChange={(next) => {
                    setExpandedUI(next)
                  }}
                  colors={colors}
                  label="Toggle full width panel"
                />
              </div>
            </div>

            <div style={{ height: 1, background: colors.popoverBorder }} />

            {/* Notification sound */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bell size={14} style={{ color: colors.textTertiary }} />
                  <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                    Notification sound
                  </div>
                </div>
                <RowToggle
                  checked={soundEnabled}
                  onChange={setSoundEnabled}
                  colors={colors}
                  label="Toggle notification sound"
                />
              </div>
            </div>

            <div style={{ height: 1, background: colors.popoverBorder }} />

            {/* Shortcuts */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Keyboard size={14} style={{ color: colors.textTertiary }} />
                <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                  Shortcuts
                </div>
              </div>

              {renderShortcutRecorder('Primary', primaryShortcut, 'primary', 'Alt+Space')}
              {renderShortcutRecorder('Secondary', secondaryShortcut, 'secondary', 'CommandOrControl+Shift+K')}

              {shortcutSettingsError && (
                <div className="text-[10px] leading-[1.4]" style={{ color: colors.statusError }}>
                  {shortcutSettingsError}
                </div>
              )}

              {!shortcutSettingsError && saveMessage && (
                <div className="text-[10px] leading-[1.4]" style={{ color: colors.accent }}>
                  {saveMessage}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveShortcuts}
                  disabled={shortcutSettingsSaving}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-opacity"
                  style={{
                    background: colors.accent,
                    color: '#fff',
                    opacity: shortcutSettingsSaving ? 0.65 : 1,
                  }}
                >
                  {shortcutSettingsSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryShortcut(DEFAULT_SHORTCUT_SETTINGS.primaryShortcut || '')
                    setSecondaryShortcut(DEFAULT_SHORTCUT_SETTINGS.secondaryShortcut || '')
                    setSaveMessage(null)
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium"
                  style={{
                    background: colors.surfaceSecondary,
                    color: colors.textSecondary,
                    border: `1px solid ${colors.containerBorder}`,
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div style={{ height: 1, background: colors.popoverBorder }} />

            {/* Theme */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Moon size={14} style={{ color: colors.textTertiary }} />
                  <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                    Dark theme
                  </div>
                </div>
                <RowToggle
                  checked={themeMode === 'dark'}
                  onChange={(next) => setThemeMode(next ? 'dark' : 'light')}
                  colors={colors}
                  label="Toggle dark theme"
                />
              </div>
            </div>
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}
