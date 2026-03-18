import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, CaretDown, Check, FolderOpen, Plus, X, ShieldCheck, ArrowsClockwise } from '@phosphor-icons/react'
import { useSessionStore, AVAILABLE_MODELS } from '../stores/sessionStore'
import { usePermissionStore } from '../stores/permissionStore'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'
import type { AutoAttachState } from '../../shared/types'

/* ─── Model Picker (inline — tightly coupled to StatusBar) ─── */

function ModelPicker() {
  const preferredModel = useSessionStore((s) => s.preferredModel)
  const setPreferredModel = useSessionStore((s) => s.setPreferredModel)
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
      const m = AVAILABLE_MODELS.find((m) => m.id === preferredModel)
      return m?.label || preferredModel
    }
    if (tab?.sessionModel) {
      const m = AVAILABLE_MODELS.find((m) => m.id === tab.sessionModel)
      return m?.label || tab.sessionModel
    }
    return AVAILABLE_MODELS[0].label
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
            {AVAILABLE_MODELS.map((m) => {
              const isSelected = preferredModel === m.id || (!preferredModel && m.id === AVAILABLE_MODELS[0].id)
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

/* ─── Permission Mode Picker (global — affects all tabs) ─── */

function PermissionModePicker() {
  const permissionMode = usePermissionStore((s) => s.permissionMode)
  const setPermissionMode = usePermissionStore((s) => s.setPermissionMode)
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
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  const isAuto = permissionMode === 'auto'

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-0.5 text-[10px] rounded-full px-1.5 py-0.5 transition-colors"
        style={{
          color: colors.textTertiary,
          cursor: 'pointer',
        }}
        title="Permission mode (global)"
      >
        <ShieldCheck size={11} weight={isAuto ? 'fill' : 'regular'} />
        {isAuto ? 'Auto' : 'Ask'}
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
            <button
              onClick={() => { setPermissionMode('ask'); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors"
              style={{
                color: !isAuto ? colors.textPrimary : colors.textSecondary,
                fontWeight: !isAuto ? 600 : 400,
              }}
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={12} />
                Ask
              </span>
              {!isAuto && <Check size={12} style={{ color: colors.accent }} />}
            </button>

            <div className="mx-2 my-0.5" style={{ height: 1, background: colors.popoverBorder }} />

            <button
              onClick={() => { setPermissionMode('auto'); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors"
              style={{
                color: isAuto ? colors.textPrimary : colors.textSecondary,
                fontWeight: isAuto ? 600 : 400,
              }}
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={12} weight="fill" />
                Auto
              </span>
              {isAuto && <Check size={12} style={{ color: colors.accent }} />}
            </button>
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
  const parts = fullPath.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || fullPath
}

function compactAssignmentLabel(assignment: NonNullable<ReturnType<typeof useSessionStore.getState>['tabs'][number]['agentAssignment']>): string {
  const base = assignment.workKey
    ? `${assignment.workKey}: ${assignment.summary}`
    : assignment.summary

  if (base.length <= 44) {
    return base
  }

  return `${base.slice(0, 43).trimEnd()}…`
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
      && a.agentAssignment?.updatedAt === b.agentAssignment?.updatedAt
      && a.agentAssignment?.summary === b.agentAssignment?.summary
      && a.agentAssignment?.workKey === b.agentAssignment?.workKey
    ),
  )
  const addDirectory = useSessionStore((s) => s.addDirectory)
  const removeDirectory = useSessionStore((s) => s.removeDirectory)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [dirOpen, setDirOpen] = useState(false)
  const [autoAttachState, setAutoAttachState] = useState<AutoAttachState | null>(null)
  const [autoAttachLoading, setAutoAttachLoading] = useState(false)
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

  const applyAutoAttachState = useCallback((tabId: string, state: AutoAttachState) => {
    useSessionStore.setState((store) => ({
      tabs: store.tabs.map((currentTab) => {
        if (currentTab.id !== tabId) return currentTab

        const manualAttachments = currentTab.attachments.filter((attachment) => !attachment.autoAttached)
        const manualPaths = new Set(manualAttachments.map((attachment) => attachment.path.toLowerCase()))
        const autoAttachments = state.attachments.filter((attachment) => !manualPaths.has(attachment.path.toLowerCase()))

        return {
          ...currentTab,
          attachments: [...manualAttachments, ...autoAttachments],
        }
      }),
    }))
  }, [])

  const loadAutoAttachState = useCallback(async (tabId: string, projectPath: string) => {
    setAutoAttachLoading(true)
    try {
      const state = await window.clui.getAutoAttachConfig(projectPath)
      setAutoAttachState(state)
      applyAutoAttachState(tabId, state)
    } catch {
      setAutoAttachState({
        config: { projectPath, files: [] },
        attachments: [],
        warnings: ['Failed to load auto-attach config.'],
      })
    } finally {
      setAutoAttachLoading(false)
    }
  }, [applyAutoAttachState])

  useEffect(() => {
    if (!dirOpen) return
    if (!tab?.hasChosenDirectory || !tab.workingDirectory) {
      setAutoAttachState(null)
      setAutoAttachLoading(false)
      return
    }
    void loadAutoAttachState(tab.id, tab.workingDirectory)
  }, [dirOpen, tab?.hasChosenDirectory, tab?.id, tab?.workingDirectory, loadAutoAttachState])

  if (!tab) return null

  const isRunning = tab.status === 'running' || tab.status === 'connecting'
  const isEmpty = tab.messages.length === 0
  const hasExtraDirs = tab.additionalDirs.length > 0
  const autoAttachFiles = autoAttachState?.config.files || []
  const hasAutoAttachFiles = autoAttachFiles.length > 0

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

  const handleAddAutoAttach = async () => {
    if (!tab.hasChosenDirectory || autoAttachLoading) return
    setAutoAttachLoading(true)
    try {
      const state = await window.clui.addAutoAttachFile(tab.workingDirectory)
      setAutoAttachState(state)
      applyAutoAttachState(tab.id, state)
    } finally {
      setAutoAttachLoading(false)
    }
  }

  const handleRemoveAutoAttach = async (relativePath: string) => {
    if (!tab.hasChosenDirectory || autoAttachLoading) return
    setAutoAttachLoading(true)
    try {
      const state = await window.clui.removeAutoAttachFile(tab.workingDirectory, relativePath)
      setAutoAttachState(state)
      applyAutoAttachState(tab.id, state)
    } finally {
      setAutoAttachLoading(false)
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
              width: 260,
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

              <div className="px-2 py-1">
                <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: colors.textTertiary }}>
                  Auto-attach files
                </div>
                {!tab.hasChosenDirectory ? (
                  <div className="text-[11px]" style={{ color: colors.textMuted }}>
                    Choose a base directory to configure auto-attach.
                  </div>
                ) : autoAttachLoading && !autoAttachState ? (
                  <div className="text-[11px]" style={{ color: colors.textMuted }}>
                    Loading...
                  </div>
                ) : hasAutoAttachFiles ? (
                  <div className="flex flex-col gap-1">
                    {autoAttachFiles.map((file) => (
                      <div key={file} className="flex items-center justify-between gap-2 group">
                        <span className="text-[11px] truncate min-w-0" style={{ color: colors.textSecondary }} title={file}>
                          {file}
                        </span>
                        <button
                          onClick={() => void handleRemoveAutoAttach(file)}
                          className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: colors.textTertiary }}
                          title="Remove auto-attach file"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px]" style={{ color: colors.textMuted }}>
                    No auto-attach files yet.
                  </div>
                )}
                {autoAttachState?.warnings.length ? (
                  <div
                    className="mt-1.5 flex items-start gap-1.5 text-[10px]"
                  style={{ color: colors.textTertiary }}
                  title={autoAttachState.warnings.join('\n')}
                >
                  <ArrowsClockwise size={10} className="flex-shrink-0 mt-[1px]" />
                  <span>{autoAttachState.warnings[0]}</span>
                </div>
                ) : null}
              </div>

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

              <button
                onClick={() => void handleAddAutoAttach()}
                disabled={!tab.hasChosenDirectory || autoAttachLoading}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] transition-colors rounded-lg"
                style={{
                  color: tab.hasChosenDirectory ? colors.accent : colors.textMuted,
                  cursor: !tab.hasChosenDirectory || autoAttachLoading ? 'not-allowed' : 'pointer',
                }}
              >
                <ArrowsClockwise size={10} />
                {autoAttachLoading ? 'Updating auto-attach...' : 'Add file to auto-attach...'}
              </button>
            </div>
          </motion.div>,
          popoverLayer,
        )}

        <span style={{ color: colors.textMuted, fontSize: 10 }}>|</span>

        <ModelPicker />

        <span style={{ color: colors.textMuted, fontSize: 10 }}>|</span>

        <PermissionModePicker />

        {tab.agentAssignment && (
          <>
            <span style={{ color: colors.textMuted, fontSize: 10 }}>|</span>
            <span
              className="max-w-[220px] truncate rounded-full px-1.5 py-0.5 text-[10px]"
              style={{
                color: colors.textSecondary,
                background: colors.accentLight,
                border: `1px solid ${colors.accentBorder}`,
              }}
              title={tab.agentAssignment.workKey
                ? `${tab.agentAssignment.workKey}\n${tab.agentAssignment.summary}`
                : tab.agentAssignment.summary}
            >
              {compactAssignmentLabel(tab.agentAssignment)}
            </span>
          </>
        )}
      </div>

      {/* Right — Open in CLI */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
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
