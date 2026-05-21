import React from 'react'
import { motion } from 'framer-motion'
import { ShieldWarning, Terminal, ArrowSquareOut } from '@phosphor-icons/react'
import { useColors, useThemeStore } from '../theme'

interface Props {
  tools: Array<{ toolName: string; toolUseId: string }>
  sessionId: string | null
  projectPath: string
  onDismiss: () => void
}

export function PermissionDeniedCard({ tools, sessionId, projectPath, onDismiss }: Props) {
  const colors = useColors()
  const cliTerminal = useThemeStore((s) => s.cliTerminal)

  const handleOpenInCli = () => {
    if (sessionId) {
      window.clui.openInTerminal(sessionId, projectPath, cliTerminal)
    }
    onDismiss()
  }

  const toolNames = [...new Set(tools.map((t) => t.toolName))]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="mx-4 mb-2"
    >
      <div
        style={{
          background: colors.containerBg,
          border: `1px solid ${colors.permissionDeniedBorder}`,
          borderRadius: 14,
          boxShadow: `0 2px 12px ${colors.statusErrorBg}`,
        }}
        className="overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: colors.statusErrorBg,
            borderBottom: `1px solid ${colors.permissionDeniedHeaderBorder}`,
          }}
        >
          <ShieldWarning size={14} style={{ color: colors.statusError }} />
          <span className="text-[12px] font-semibold" style={{ color: colors.statusError }}>
            Tools Denied by Permission Settings
          </span>
        </div>

        {/* Body */}
        <div className="px-3 py-2">
          <p className="text-[11px] leading-[1.5] mb-2" style={{ color: colors.textSecondary }}>
            Interactive approvals are not supported in the current CLI mode.
            {toolNames.length > 0 && (
              <> Denied: <span style={{ color: colors.textPrimary }}>{toolNames.join(', ')}</span>.</>
            )}
          </p>

          {/* Tool list */}
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {toolNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md"
                  style={{
                    background: colors.surfacePrimary,
                    color: colors.textTertiary,
                    border: `1px solid ${colors.surfaceSecondary}`,
                  }}
                >
                  <Terminal size={10} />
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1.5">
            {sessionId && (
              <button
                onClick={handleOpenInCli}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer flex items-center gap-1.5"
                style={{
                  background: colors.accentLight,
                  color: colors.accent,
                  border: `1px solid ${colors.accentBorderMedium}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.accentSoft
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.accentLight
                }}
              >
                <ArrowSquareOut size={12} />
                Open in CLI
              </button>
            )}
            <button
              onClick={onDismiss}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer"
              style={{
                background: colors.surfaceHover,
                color: colors.textTertiary,
                border: `1px solid ${colors.surfaceSecondary}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceActive
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.surfaceHover
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
