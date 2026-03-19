import React from 'react'
import { Terminal as TerminalIcon } from '@phosphor-icons/react'
import { useTerminalStore } from '../stores/terminalStore'
import { useColors } from '../theme'

export function ModeToggle() {
  const terminalMode = useTerminalStore((s) => s.terminalMode)
  const ptyAvailable = useTerminalStore((s) => s.ptyAvailable)
  const toggleMode = useTerminalStore((s) => s.toggleMode)
  const colors = useColors()

  const disabled = ptyAvailable === false || ptyAvailable === null

  return (
    <button
      className="stack-btn stack-btn-0 glass-surface"
      title={disabled ? 'Terminal unavailable — node-pty not loaded' : terminalMode ? 'Switch to Chat (Ctrl+`)' : 'Terminal (Ctrl+`)'}
      onClick={disabled ? undefined : toggleMode}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: terminalMode ? colors.accent : undefined,
        color: disabled ? colors.textMuted : terminalMode ? colors.textOnAccent : colors.textSecondary,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s, color 0.15s, opacity 0.15s',
      }}
      aria-label={terminalMode ? 'Switch to Chat' : 'Open Terminal'}
      aria-disabled={disabled}
    >
      <TerminalIcon size={17} weight={terminalMode ? 'fill' : 'regular'} />
    </button>
  )
}
