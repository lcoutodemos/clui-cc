import React, { useState, useEffect } from 'react'
import { DotsThree, Bell, ArrowsOutSimple, ArrowsHorizontal, Moon, Terminal, Check } from '@phosphor-icons/react'
import { useThemeStore } from '../theme'
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

/* ─── Width slider ─── */

function PillScaleSlider() {
  const pillScale = useThemeStore((s) => s.pillScale)
  const setPillScale = useThemeStore((s) => s.setPillScale)
  const colors = useColors()
  const [local, setLocal] = useState(pillScale)
  const [dragging, setDragging] = useState(false)

  // Sync local when store changes externally
  useEffect(() => { if (!dragging) setLocal(pillScale) }, [pillScale, dragging])

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowsHorizontal size={14} style={{ color: colors.textTertiary }} />
          <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
            Width
          </div>
        </div>
        <div className="text-[11px]" style={{ color: colors.textTertiary }}>{local}%</div>
      </div>
      <input
        type="range"
        min={75}
        max={150}
        step={5}
        value={local}
        onChange={(e) => {
          const v = Number(e.target.value)
          setLocal(v)
          setPillScale(v)
          // Sync Full Width toggle with slider position
          const expanded = useThemeStore.getState().expandedUI
          if (v >= 150 && !expanded) useThemeStore.getState().setExpandedUI(true)
          if (v < 150 && expanded) useThemeStore.getState().setExpandedUI(false)
        }}
        onPointerDown={() => {
          setDragging(true)
          window.dispatchEvent(new CustomEvent('clui-scale-start'))
          // Use window-level listener so pointerUp fires even if released outside the slider
          const onUp = () => {
            setDragging(false)
            window.dispatchEvent(new CustomEvent('clui-scale-done'))
          }
          window.addEventListener('pointerup', onUp, { once: true })
        }}
        className="w-full mt-1 cursor-pointer"
        style={{ accentColor: colors.accent, height: 4 }}
      />
    </div>
  )
}

/* ─── Terminal picker (inline dropdown) ─── */

function TerminalPicker() {
  const terminalApp = useThemeStore((s) => s.terminalApp)
  const setTerminalApp = useThemeStore((s) => s.setTerminalApp)
  const colors = useColors()
  const [terminals, setTerminals] = useState<Array<{ id: string; label: string; installed: boolean; hasTmux?: boolean }>>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    window.clui.detectTerminals?.().then(setTerminals).catch(() => {})
  }, [])

  const installed = terminals.filter((t) => t.installed)
  const autoTerminal = installed[0]
  const currentLabel = terminalApp === 'auto'
    ? `Auto${autoTerminal ? ` (${autoTerminal.label})` : ''}`
    : installed.find((t) => t.id === terminalApp)?.label || 'Auto'

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal size={14} style={{ color: colors.textTertiary }} />
          <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
            Terminal
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          style={{ color: colors.textSecondary, background: colors.surfacePrimary }}
        >
          {currentLabel}
        </button>
      </div>
      {open && (
        <div className="mt-1.5 rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.popoverBorder}` }}>
          {/* Auto option */}
          <button
            onClick={() => { setTerminalApp('auto'); setOpen(false) }}
            className="w-full text-left text-[11px] px-2.5 py-1.5 transition-colors cursor-pointer flex items-center justify-between"
            style={{
              color: terminalApp === 'auto' ? colors.accent : colors.textSecondary,
              background: terminalApp === 'auto' ? colors.accentLight : 'transparent',
            }}
          >
            <span>Auto{autoTerminal ? ` (${autoTerminal.label})` : ''}</span>
            {terminalApp === 'auto' && <Check size={12} />}
          </button>
          {/* Installed terminals */}
          {installed.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTerminalApp(t.id as 'terminal' | 'ghostty' | 'iterm'); setOpen(false) }}
              className="w-full text-left text-[11px] px-2.5 py-1.5 transition-colors cursor-pointer flex items-center justify-between"
              style={{
                color: terminalApp === t.id ? colors.accent : colors.textSecondary,
                background: terminalApp === t.id ? colors.accentLight : 'transparent',
              }}
            >
              <span>{t.label}{t.id === 'iterm' && t.hasTmux ? ' (tmux)' : ''}</span>
              {terminalApp === t.id && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Settings content (rendered inline in App.tsx) ─── */

export function SettingsContent() {
  const soundEnabled = useThemeStore((s) => s.soundEnabled)
  const setSoundEnabled = useThemeStore((s) => s.setSoundEnabled)
  const themeMode = useThemeStore((s) => s.themeMode)
  const setThemeMode = useThemeStore((s) => s.setThemeMode)
  const expandedUI = useThemeStore((s) => s.expandedUI)
  const setExpandedUI = useThemeStore((s) => s.setExpandedUI)
  const setPillScale = useThemeStore((s) => s.setPillScale)
  const colors = useColors()

  return (
    <div className="p-3 flex flex-col gap-2.5">
      {/* Pill scale */}
      <PillScaleSlider />

      <div style={{ height: 1, background: colors.popoverBorder }} />

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
              setPillScale(next ? 150 : 100)
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

      {/* Terminal */}
      <TerminalPicker />
    </div>
  )
}

/* ─── Settings trigger button (used in TabStrip) ─── */

export function SettingsPopover() {
  const toggleSettings = useThemeStore((s) => s.toggleSettings)
  const colors = useColors()

  return (
    <button
      data-settings-trigger
      onClick={toggleSettings}
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
      style={{ color: colors.textTertiary }}
      title="Settings"
    >
      <DotsThree size={16} weight="bold" />
    </button>
  )
}
