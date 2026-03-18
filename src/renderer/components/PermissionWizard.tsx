import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ShieldWarning, Lock, Lightning } from '@phosphor-icons/react'
import { useColors } from '../theme'

interface Props {
  onComplete: () => void
}

type PresetKey = 'permissive' | 'balanced' | 'strict'

const PRESETS: Array<{
  key: PresetKey
  icon: React.ReactNode
  title: string
  description: string
  details: string[]
}> = [
  {
    key: 'permissive',
    icon: <Lightning size={20} weight="fill" />,
    title: 'Permissive',
    description: 'Auto-approve all tools. Best for trusted local development.',
    details: ['Bash, Edit, Write auto-approved', 'All MCP tools auto-approved', 'No interruptions'],
  },
  {
    key: 'balanced',
    icon: <ShieldCheck size={20} weight="fill" />,
    title: 'Balanced',
    description: 'Auto-approve reads, git, and package managers. Ask for edits.',
    details: ['Git, gh, npm, node auto-approved', 'Read-only commands allowed', 'Edit/Write still require approval'],
  },
  {
    key: 'strict',
    icon: <Lock size={20} weight="fill" />,
    title: 'Strict',
    description: 'Minimal auto-approvals. Claude asks before most actions.',
    details: ['Only web search auto-approved', 'All other tools require approval', 'Maximum control'],
  },
]

export function PermissionWizard({ onComplete }: Props) {
  const colors = useColors()
  const [selected, setSelected] = useState<PresetKey>('balanced')
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    setApplying(true)
    try {
      await window.clui.applyPermissionPreset(selected)
      await window.clui.dismissPermissionSetup()
    } catch {}
    setApplying(false)
    onComplete()
  }

  const handleSkip = async () => {
    try {
      await window.clui.dismissPermissionSetup()
    } catch {}
    onComplete()
  }

  return (
    <motion.div
      data-testid="permission-wizard"
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -8 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.1, 1] }}
      className="mx-4 mb-3"
    >
      <div
        style={{
          background: colors.containerBg,
          border: `1px solid ${colors.containerBorder}`,
          borderRadius: 16,
          boxShadow: colors.containerShadow,
        }}
        className="overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{
            background: colors.permissionHeaderBg,
            borderBottom: `1px solid ${colors.permissionHeaderBorder}`,
          }}
        >
          <ShieldWarning size={16} style={{ color: colors.accent }} />
          <span className="text-[13px] font-semibold" style={{ color: colors.textPrimary }}>
            Permission Setup
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-[11px] leading-[1.5] mb-3" style={{ color: colors.textSecondary }}>
            Choose how Claude Code interacts with your system. You can change this later in Settings.
          </p>

          {/* Preset cards */}
          <div className="flex flex-col gap-2 mb-3">
            {PRESETS.map((preset) => {
              const isSelected = selected === preset.key
              return (
                <button
                  key={preset.key}
                  data-testid={`permission-preset-${preset.key}`}
                  onClick={() => setSelected(preset.key)}
                  className="text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer"
                  style={{
                    background: isSelected ? colors.accentLight : colors.surfacePrimary,
                    border: `1.5px solid ${isSelected ? colors.accent : colors.surfaceSecondary}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: isSelected ? colors.accent : colors.textTertiary }}>
                      {preset.icon}
                    </span>
                    <span className="text-[12px] font-semibold" style={{ color: isSelected ? colors.accent : colors.textPrimary }}>
                      {preset.title}
                    </span>
                  </div>
                  <p className="text-[10px] leading-[1.4] mb-1.5" style={{ color: colors.textSecondary }}>
                    {preset.description}
                  </p>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        {preset.details.map((d, i) => (
                          <li key={i} className="text-[9px] leading-[1.5] flex items-center gap-1" style={{ color: colors.textTertiary }}>
                            <span style={{ color: colors.statusComplete }}>&#10003;</span>
                            {d}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              data-testid="permission-wizard-skip"
              onClick={handleSkip}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full cursor-pointer transition-colors"
              style={{
                background: colors.surfaceHover,
                color: colors.textTertiary,
                border: `1px solid ${colors.surfaceSecondary}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceActive }}
              onMouseLeave={(e) => { e.currentTarget.style.background = colors.surfaceHover }}
            >
              Skip
            </button>
            <button
              data-testid="permission-wizard-apply"
              onClick={handleApply}
              disabled={applying}
              className="text-[11px] font-semibold px-4 py-1.5 rounded-full cursor-pointer transition-colors disabled:opacity-40"
              style={{
                background: colors.sendBg,
                color: colors.textOnAccent,
                border: 'none',
              }}
              onMouseEnter={(e) => { if (!applying) e.currentTarget.style.background = colors.sendHover }}
              onMouseLeave={(e) => { if (!applying) e.currentTarget.style.background = colors.sendBg }}
            >
              {applying ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
