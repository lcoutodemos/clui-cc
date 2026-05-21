import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { DotsThree, Bell, ArrowsOutSimple, Moon, Robot, Terminal, CaretDown, Check } from '@phosphor-icons/react'
import { useThemeStore, CLI_TERMINAL_OPTIONS } from '../theme'
import { useSessionStore } from '../stores/sessionStore'
import { AVAILABLE_MODELS, getModelDisplayLabel } from '../stores/sessionStore'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'

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
  const defaultModel = useThemeStore((s) => s.defaultModel)
  const setDefaultModel = useThemeStore((s) => s.setDefaultModel)
  const cliTerminal = useThemeStore((s) => s.cliTerminal)
  const setCliTerminal = useThemeStore((s) => s.setCliTerminal)
  const isExpanded = useSessionStore((s) => s.isExpanded)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [cliMenuOpen, setCliMenuOpen] = useState(false)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
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
      setModelMenuOpen(false)
      setCliMenuOpen(false)
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

  const handleToggle = () => {
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="clui-pointer flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
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
            width: 240,
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

            <div style={{ height: 1, background: colors.popoverBorder }} />

            {/* Default model */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Robot size={14} style={{ color: colors.textTertiary }} />
                  <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                    Default model
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((o) => !o)}
                  className="flex items-center gap-0.5 text-[11px] rounded-full px-2 py-0.5 transition-colors"
                  style={{ color: colors.textSecondary, border: `1px solid ${colors.containerBorder}` }}
                  aria-expanded={modelMenuOpen}
                  aria-haspopup="listbox"
                >
                  {getModelDisplayLabel(defaultModel)}
                  <CaretDown size={10} style={{ opacity: 0.6 }} />
                </button>
              </div>
              {modelMenuOpen && (
                <div
                  className="mt-2 rounded-lg overflow-hidden"
                  style={{ border: `1px solid ${colors.popoverBorder}` }}
                  role="listbox"
                >
                  {AVAILABLE_MODELS.map((m) => {
                    const isSelected = defaultModel === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setDefaultModel(m.id)
                          setModelMenuOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] transition-colors"
                        style={{
                          color: isSelected ? colors.textPrimary : colors.textSecondary,
                          fontWeight: isSelected ? 600 : 400,
                          background: isSelected ? colors.surfaceSecondary : 'transparent',
                        }}
                      >
                        {m.label}
                        {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: colors.popoverBorder }} />

            {/* Open in CLI app */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Terminal size={14} style={{ color: colors.textTertiary }} />
                  <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                    Open in CLI
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCliMenuOpen((o) => !o)}
                  className="flex items-center gap-0.5 text-[11px] rounded-full px-2 py-0.5 transition-colors"
                  style={{ color: colors.textSecondary, border: `1px solid ${colors.containerBorder}` }}
                  aria-expanded={cliMenuOpen}
                  aria-haspopup="listbox"
                >
                  {CLI_TERMINAL_OPTIONS.find((o) => o.id === cliTerminal)?.label ?? 'Terminal'}
                  <CaretDown size={10} style={{ opacity: 0.6 }} />
                </button>
              </div>
              {cliMenuOpen && (
                <div
                  className="mt-2 rounded-lg overflow-hidden"
                  style={{ border: `1px solid ${colors.popoverBorder}` }}
                  role="listbox"
                >
                  {CLI_TERMINAL_OPTIONS.map((o) => {
                    const isSelected = cliTerminal === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setCliTerminal(o.id)
                          setCliMenuOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] transition-colors"
                        style={{
                          color: isSelected ? colors.textPrimary : colors.textSecondary,
                          fontWeight: isSelected ? 600 : 400,
                          background: isSelected ? colors.surfaceSecondary : 'transparent',
                        }}
                      >
                        {o.label}
                        {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}
