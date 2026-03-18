import React from 'react'
import { ChatCircle, TerminalWindow, Broom, CheckCircle, XCircle } from '@phosphor-icons/react'
import { useTerminalStore } from '../stores/terminalStore'
import { useColors } from '../theme'
import type { TerminalTab } from '../../shared/types'

interface Props {
  activeTab: TerminalTab | null
}

export function TerminalStatusBar({ activeTab }: Props) {
  const toggleMode = useTerminalStore((s) => s.toggleMode)
  const fontSize = useTerminalStore((s) => s.fontSize)
  const colors = useColors()

  const handleClear = () => {
    window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: 'clear' } }))
  }

  const zoomPct = Math.round((fontSize / 13) * 100)

  return (
    <div
      data-clui-ui
      className="flex items-center no-drag"
      style={{
        height: 28,
        minHeight: 28,
        padding: '0 8px',
        borderTop: `1px solid ${colors.containerBorder}`,
        background: colors.surfaceHover,
        gap: 8,
      }}
    >
      {/* Back to chat button */}
      <button
        onClick={toggleMode}
        className="flex items-center gap-1 border-0 cursor-pointer rounded px-1.5 py-0.5"
        style={{
          background: 'transparent',
          color: colors.textTertiary,
          fontSize: 11,
          transition: 'color 0.1s',
        }}
        title="Switch to Chat (Ctrl+`)"
        aria-label="Switch to Chat"
        onMouseEnter={(e) => (e.currentTarget.style.color = colors.accent)}
        onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
      >
        <ChatCircle size={12} />
        <span>Chat</span>
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: colors.containerBorder }} />

      {activeTab && (
        <>
          {/* Shell info */}
          <div className="flex items-center gap-1" style={{ color: colors.textTertiary, fontSize: 11 }}>
            <TerminalWindow size={11} />
            <span>{activeTab.title}</span>
          </div>

          {/* CWD */}
          <div
            className="truncate"
            style={{
              color: colors.textTertiary,
              fontSize: 11,
              maxWidth: '40%',
              direction: 'rtl',
              textAlign: 'left',
            }}
          >
            {activeTab.cwd}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Zoom badge (only when not 100%) */}
          {zoomPct !== 100 && (
            <span
              style={{
                fontSize: 10,
                color: colors.textSecondary,
                background: colors.surfaceHover,
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              {zoomPct}%
            </span>
          )}

          {/* Clear button */}
          <button
            onClick={handleClear}
            className="flex items-center justify-center border-0 cursor-pointer rounded"
            style={{
              width: 24,
              height: 24,
              background: 'transparent',
              color: colors.textMuted,
              transition: 'color 0.1s',
            }}
            title="Clear Terminal (Ctrl+L)"
            aria-label="Clear Terminal"
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.textMuted)}
          >
            <Broom size={14} />
          </button>

          {/* Exit status */}
          {activeTab.status === 'exited' && (
            <span
              className="flex items-center gap-1 rounded"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '1px 6px',
                color: activeTab.exitCode === 0 ? '#4ade80' : '#f87171',
                background: activeTab.exitCode === 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                borderRadius: 4,
              }}
            >
              {activeTab.exitCode === 0 ? <CheckCircle size={12} /> : <XCircle size={12} />}
              exit {activeTab.exitCode}
            </span>
          )}
        </>
      )}
    </div>
  )
}
