import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Terminal, CaretDown, Check, FolderOpen, Plus, X, ShieldCheck } from '@phosphor-icons/react'
import { useSessionStore, FALLBACK_MODELS, getModelDisplayLabel } from '../stores/sessionStore'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'

const CLAUDE_PERMISSION_MODES = [
  { id: null, label: 'Default' },
  { id: 'plan', label: 'Plan' },
  { id: 'acceptEdits', label: 'Accept edits' },
  { id: 'auto', label: 'Auto' },
  { id: 'dontAsk', label: 'Do not ask' },
  { id: 'bypassPermissions', label: 'Bypass' },
] as const

/* ─── Model Picker (inline — tightly coupled to StatusBar) ─── */

function ModelPicker() {
  const preferredModel = useSessionStore((s) => s.preferredModel)
  const setPreferredModel = useSessionStore((s) => s.setPreferredModel)
  const availableModels = useSessionStore((s) => s.availableModels)
  const tab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b && a.status === b.status && a.sessionModel === b.sessionModel),
  )
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  const isBusy = tab?.status === 'running' || tab?.status === 'connecting'
  const models = availableModels.length ? availableModels : FALLBACK_MODELS

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
    })
  }, [])

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

  const handleToggle = () => {
    if (isBusy) return
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  const activeLabel = (() => {
    if (preferredModel) {
      const m = models.find((m) => m.id === preferredModel)
      return m?.label || getModelDisplayLabel(preferredModel)
    }
    if (tab?.sessionModel) {
      const m = models.find((m) => m.id === tab.sessionModel)
      return m?.label || getModelDisplayLabel(tab.sessionModel)
    }
    return models[0]?.label || 'Default'
  })()

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 transition-colors"
        style={{
          color: colors.textTertiary,
          cursor: isBusy ? 'not-allowed' : 'pointer',
        }}
        title={isBusy ? 'Stop the task to change model' : 'Switch model'}
      >
        {activeLabel}
        <CaretDown size={10} style={{ opacity: 0.6 }} />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-clui-ui
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl"
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            left: pos.left,
            width: 192,
            pointerEvents: 'auto',
            background: colors.popoverBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
            border: `1px solid ${colors.popoverBorder}`,
          }}
        >
          <div className="py-1">
            {models.map((m) => {
              const isSelected = preferredModel === m.id || (!preferredModel && (tab?.sessionModel ? m.id === tab.sessionModel : m.id === 'default'))
              return (
                <button
                  key={m.id}
                  onClick={() => { setPreferredModel(m.id); setOpen(false) }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors"
                  style={{
                    color: isSelected ? colors.textPrimary : colors.textSecondary,
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {m.label}
                  {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                </button>
              )
            })}
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}

/* ─── Claude Code Mode Picker ─── */

function ClaudeModePicker() {
  const preferredClaudePermissionMode = useSessionStore((s) => s.preferredClaudePermissionMode)
  const setPreferredClaudePermissionMode = useSessionStore((s) => s.setPreferredClaudePermissionMode)
  const tab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b && a.status === b.status && a.sessionPermissionMode === b.sessionPermissionMode),
  )
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
    })
  }, [])

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

  const handleToggle = () => {
    if (isBusy) return
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  const isBusy = tab?.status === 'running' || tab?.status === 'connecting'
  const activeMode = preferredClaudePermissionMode || tab?.sessionPermissionMode || 'default'
  const activeLabel = CLAUDE_PERMISSION_MODES.find((mode) => (mode.id || 'default') === activeMode)?.label || activeMode

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 transition-colors"
        style={{
          color: colors.textTertiary,
          cursor: isBusy ? 'not-allowed' : 'pointer',
        }}
        title={isBusy ? 'Stop the task to change Claude Code mode' : 'Claude Code permission mode'}
      >
        <ShieldCheck size={11} weight={activeMode === 'default' ? 'regular' : 'fill'} />
        {activeLabel}
        <CaretDown size={10} style={{ opacity: 0.6 }} />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-clui-ui
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl"
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            left: pos.left,
            width: 180,
            pointerEvents: 'auto',
            background: colors.popoverBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
            border: `1px solid ${colors.popoverBorder}`,
          }}
        >
          <div className="py-1">
            {CLAUDE_PERMISSION_MODES.map((mode) => {
              const modeValue = mode.id || 'default'
              const isSelected = activeMode === modeValue
              return (
                <button
                  key={modeValue}
                  onClick={() => {
                    setPreferredClaudePermissionMode(mode.id)
                    setOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors"
                  style={{
                    color: isSelected ? colors.textPrimary : colors.textSecondary,
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={12} weight={modeValue === 'default' ? 'regular' : 'fill'} />
                    {mode.label}
                  </span>
                  {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                </button>
              )
            })}
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}

function formatTokens(n?: number): string {
  return typeof n === 'number' ? n.toLocaleString() : '0'
}

function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${n}`
}

function inferContextLimit(modelId?: string | null): number {
  return modelId && /\[\s*1m\s*\]/i.test(modelId) ? 1_000_000 : 200_000
}

function ContextRing() {
  const tab = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const popoverLayer = usePopoverLayer()
  const colors = useColors()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [pos, setPos] = useState({ bottom: 0, right: 0 })

  const usage = tab?.currentUsage || tab?.lastResult?.usage
  const inputTokens = usage?.input_tokens || 0
  const cacheReadTokens = usage?.cache_read_input_tokens || 0
  const cacheWriteTokens = usage?.cache_creation_input_tokens || 0
  const outputTokens = usage?.output_tokens || 0
  const contextTokens = inputTokens + cacheReadTokens + cacheWriteTokens
  const contextLimit = inferContextLimit(tab?.sessionModel)
  const percent = Math.min(100, Math.round((contextTokens / contextLimit) * 100))
  const radius = 6
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (circumference * percent) / 100

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      right: window.innerWidth - rect.right,
    })
  }, [])

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
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  if (!tab) return null

  const showPopover = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    updatePos()
    setOpen(true)
  }

  const scheduleClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onMouseEnter={showPopover}
        onMouseLeave={scheduleClose}
        onFocus={showPopover}
        onClick={() => { updatePos(); setOpen((next) => !next) }}
        className="flex items-center justify-center rounded-full transition-colors"
        style={{ width: 20, height: 20, color: colors.textTertiary }}
        title="Claude Code context usage"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            stroke={colors.surfaceSecondary}
            strokeWidth="2"
          />
          <circle
            cx="8"
            cy="8"
            r={radius}
            fill="none"
            stroke={contextTokens ? colors.accent : colors.textMuted}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 8 8)"
          />
        </svg>
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-clui-ui
          onMouseEnter={showPopover}
          onMouseLeave={scheduleClose}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl"
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            right: pos.right,
            width: 210,
            pointerEvents: 'auto',
            background: colors.popoverBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
            border: `1px solid ${colors.popoverBorder}`,
          }}
        >
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold" style={{ color: colors.textPrimary }}>Context</span>
              <span className="text-[10px]" style={{ color: colors.textTertiary }}>{percent}%</span>
            </div>
            <div className="text-[10px] mb-2" style={{ color: colors.textTertiary }}>
              {compactTokens(contextTokens)} of {compactTokens(contextLimit)} input context
            </div>
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="flex justify-between gap-3"><span style={{ color: colors.textTertiary }}>Input</span><span style={{ color: colors.textSecondary }}>{formatTokens(inputTokens)}</span></div>
              <div className="flex justify-between gap-3"><span style={{ color: colors.textTertiary }}>Cache read</span><span style={{ color: colors.textSecondary }}>{formatTokens(cacheReadTokens)}</span></div>
              <div className="flex justify-between gap-3"><span style={{ color: colors.textTertiary }}>Cache write</span><span style={{ color: colors.textSecondary }}>{formatTokens(cacheWriteTokens)}</span></div>
              <div className="flex justify-between gap-3"><span style={{ color: colors.textTertiary }}>Output</span><span style={{ color: colors.textSecondary }}>{formatTokens(outputTokens)}</span></div>
              <div className="flex justify-between gap-3"><span style={{ color: colors.textTertiary }}>Cost</span><span style={{ color: colors.textSecondary }}>{tab.lastResult ? `$${tab.lastResult.totalCostUsd.toFixed(4)}` : 'none yet'}</span></div>
            </div>
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}

/* ─── StatusBar ─── */

/** Get a compact display path: basename for deep paths, ~ for home */
function compactPath(fullPath: string): string {
  if (fullPath === '~') return '~'
  const parts = fullPath.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] || fullPath
}

export function StatusBar() {
  const tab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b
      && a.status === b.status
      && a.additionalDirs === b.additionalDirs
      && a.hasChosenDirectory === b.hasChosenDirectory
      && a.workingDirectory === b.workingDirectory
      && a.claudeSessionId === b.claudeSessionId
    ),
  )
  const addDirectory = useSessionStore((s) => s.addDirectory)
  const removeDirectory = useSessionStore((s) => s.removeDirectory)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [dirOpen, setDirOpen] = useState(false)
  const dirRef = useRef<HTMLButtonElement>(null)
  const dirPopRef = useRef<HTMLDivElement>(null)
  const [dirPos, setDirPos] = useState({ bottom: 0, left: 0 })

  // Close popover on outside click
  useEffect(() => {
    if (!dirOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (dirRef.current?.contains(target)) return
      if (dirPopRef.current?.contains(target)) return
      setDirOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dirOpen])

  if (!tab) return null

  const isRunning = tab.status === 'running' || tab.status === 'connecting'
  const isEmpty = tab.messages.length === 0
  const hasExtraDirs = tab.additionalDirs.length > 0

  const handleOpenInTerminal = () => {
    window.clui.openInTerminal(tab.claudeSessionId, tab.workingDirectory)
  }

  const handleDirClick = () => {
    if (isRunning) return
    if (!dirOpen && dirRef.current) {
      const rect = dirRef.current.getBoundingClientRect()
      setDirPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
      })
    }
    setDirOpen((o) => !o)
  }

  const handleAddDir = async () => {
    const dir = await window.clui.selectDirectory()
    if (dir) {
      addDirectory(dir)
    }
  }

  const dirTooltip = tab.hasChosenDirectory
    ? [tab.workingDirectory, ...tab.additionalDirs].join('\n')
    : 'Using home directory by default — click to choose a folder'

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5"
      style={{ minHeight: 28 }}
    >
      {/* Left — directory + model picker */}
      <div className="flex items-center gap-2 text-[11px] min-w-0" style={{ color: colors.textTertiary }}>
        {/* Directory button */}
        <button
          ref={dirRef}
          onClick={handleDirClick}
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors flex-shrink-0"
          style={{
            color: colors.textTertiary,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            maxWidth: 140,
          }}
          title={dirTooltip}
          disabled={isRunning}
        >
          <FolderOpen size={11} className="flex-shrink-0" />
          <span className="truncate">{tab.hasChosenDirectory ? compactPath(tab.workingDirectory) : '—'}</span>
          {hasExtraDirs && (
            <span style={{ color: colors.textTertiary, fontWeight: 600 }}>+{tab.additionalDirs.length}</span>
          )}
        </button>

        {/* Directory popover */}
        {popoverLayer && dirOpen && createPortal(
          <motion.div
            ref={dirPopRef}
            data-clui-ui
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className="rounded-xl"
            style={{
              position: 'fixed',
              bottom: dirPos.bottom,
              left: dirPos.left,
              width: 220,
              pointerEvents: 'auto',
              background: colors.popoverBg,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: colors.popoverShadow,
              border: `1px solid ${colors.popoverBorder}`,
            }}
          >
            <div className="py-1.5 px-1">
              {/* Base directory */}
              <div className="px-2 py-1">
                <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: colors.textTertiary }}>
                  Base directory
                </div>
                <div className="text-[11px] truncate" style={{ color: tab.hasChosenDirectory ? colors.textSecondary : colors.textMuted }} title={tab.hasChosenDirectory ? tab.workingDirectory : 'No folder selected — defaults to home directory'}>
                  {tab.hasChosenDirectory ? tab.workingDirectory : 'None (defaults to ~)'}
                </div>
              </div>

              {/* Additional directories */}
              {hasExtraDirs && (
                <>
                  <div className="mx-2 my-1" style={{ height: 1, background: colors.popoverBorder }} />
                  <div className="px-2 py-1">
                    <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: colors.textTertiary }}>
                      Added directories
                    </div>
                    {tab.additionalDirs.map((dir) => (
                      <div key={dir} className="flex items-center justify-between py-0.5 group">
                        <span className="text-[11px] truncate mr-2" style={{ color: colors.textSecondary }} title={dir}>
                          {compactPath(dir)}
                        </span>
                        <button
                          onClick={() => removeDirectory(dir)}
                          className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: colors.textTertiary }}
                          title="Remove directory"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mx-2 my-1" style={{ height: 1, background: colors.popoverBorder }} />

              {/* Add directory button */}
              <button
                onClick={handleAddDir}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] transition-colors rounded-lg"
                style={{ color: colors.accent }}
              >
                <Plus size={10} />
                Add directory...
              </button>
            </div>
          </motion.div>,
          popoverLayer,
        )}

        <span style={{ color: colors.textMuted, fontSize: 10 }}>|</span>

        <ModelPicker />

        <span style={{ color: colors.textMuted, fontSize: 10 }}>|</span>

        <ClaudeModePicker />
      </div>

      {/* Right — Open in CLI */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <ContextRing />
        <button
          onClick={handleOpenInTerminal}
          className="flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 transition-colors"
          style={{ color: colors.textTertiary }}
          title="Open this session in Terminal"
        >
          Open in CLI
          <Terminal size={11} />
        </button>
      </div>
    </div>
  )
}
