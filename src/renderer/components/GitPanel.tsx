import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch,
  ArrowClockwise,
  PencilSimple,
  Plus,
  Trash,
  Question,
  CheckCircle,
  X,
  CaretDown,
  CaretRight,
  ArrowsLeftRight,
  SpinnerGap,
  Warning,
} from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useSessionStore } from '../stores/sessionStore'
import type { GitStatus, GitFileStatus } from '../../shared/types'

const TRANSITION = { duration: 0.2, ease: [0.4, 0, 0.1, 1] as const }
const PANEL_WIDTH = 300

interface GitPanelProps {
  open: boolean
  onClose: () => void
}

type PanelState = 'loading' | 'not-repo' | 'clean' | 'changes' | 'error'

const STATUS_ICONS: Record<GitFileStatus['status'], React.ComponentType<{ size: number; style?: React.CSSProperties }>> = {
  M: PencilSimple,
  A: Plus,
  D: Trash,
  R: ArrowsLeftRight,
  '?': Question,
}

function statusLabel(s: GitFileStatus['status']): string {
  switch (s) {
    case 'M': return 'Modified'
    case 'A': return 'Added'
    case 'D': return 'Deleted'
    case 'R': return 'Renamed'
    case '?': return 'Untracked'
  }
}

export function GitPanel({ open, onClose }: GitPanelProps) {
  const colors = useColors()
  const workingDirectory = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId)?.workingDirectory ?? '',
  )

  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [panelState, setPanelState] = useState<PanelState>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [fileDiffs, setFileDiffs] = useState<Record<string, string>>({})
  const [loadingDiff, setLoadingDiff] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!workingDirectory) {
      setPanelState('not-repo')
      return
    }

    setPanelState('loading')
    setErrorMsg(null)
    setExpandedFile(null)
    setFileDiffs({})

    try {
      const status = await window.clui.getGitStatus(workingDirectory)
      setGitStatus(status)

      if (!status.isRepo) {
        setPanelState('not-repo')
      } else if (status.files.length === 0) {
        setPanelState('clean')
      } else {
        setPanelState('changes')
      }
    } catch (err: unknown) {
      setPanelState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to get git status')
    }
  }, [workingDirectory])

  // Auto-refresh when panel opens or working directory changes
  useEffect(() => {
    if (open) {
      void refresh()
    }
  }, [open, workingDirectory, refresh])

  const handleFileClick = useCallback(async (filePath: string) => {
    if (expandedFile === filePath) {
      setExpandedFile(null)
      return
    }

    setExpandedFile(filePath)

    // Fetch diff if not cached
    if (!fileDiffs[filePath]) {
      setLoadingDiff(filePath)
      try {
        const diff = await window.clui.getGitDiff(workingDirectory, filePath)
        setFileDiffs((prev) => ({ ...prev, [filePath]: diff || '(no diff available)' }))
      } catch {
        setFileDiffs((prev) => ({ ...prev, [filePath]: '(failed to load diff)' }))
      } finally {
        setLoadingDiff(null)
      }
    }
  }, [expandedFile, fileDiffs, workingDirectory])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-clui-ui
          initial={{ x: PANEL_WIDTH, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: PANEL_WIDTH, opacity: 0 }}
          transition={TRANSITION}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: PANEL_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            background: colors.containerBg,
            borderLeft: `1px solid ${colors.containerBorder}`,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            zIndex: 40,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 14px',
              borderBottom: `1px solid ${colors.containerBorder}`,
              flexShrink: 0,
            }}
          >
            <GitBranch size={16} style={{ color: colors.accent, flexShrink: 0 }} />
            <span
              style={{
                color: colors.textPrimary,
                fontSize: 13,
                fontWeight: 600,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Git Context
            </span>

            {/* Branch badge */}
            {gitStatus?.branch && (
              <span
                style={{
                  fontSize: 10,
                  color: colors.accent,
                  background: colors.accentLight,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  fontWeight: 500,
                  maxWidth: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title={gitStatus.branch}
              >
                {gitStatus.branch}
              </span>
            )}

            <button
              onClick={refresh}
              title="Refresh"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: colors.textTertiary,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceHover
                e.currentTarget.style.color = colors.textSecondary
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = colors.textTertiary
              }}
            >
              <ArrowClockwise size={14} />
            </button>

            <button
              onClick={onClose}
              title="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: colors.textTertiary,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surfaceHover
                e.currentTarget.style.color = colors.textSecondary
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = colors.textTertiary
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 0',
            }}
            className="overflow-y-auto"
          >
            {panelState === 'loading' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <SpinnerGap size={24} style={{ color: colors.textTertiary }} />
                </motion.div>
              </div>
            )}

            {panelState === 'not-repo' && (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Warning size={28} style={{ color: colors.textTertiary, marginBottom: 8 }} />
                <div style={{ color: colors.textTertiary, fontSize: 12 }}>
                  Not a git repository
                </div>
                <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                  Select a directory with a git repo
                </div>
              </div>
            )}

            {panelState === 'error' && (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Warning size={28} style={{ color: colors.statusError, marginBottom: 8 }} />
                <div style={{ color: colors.statusError, fontSize: 12 }}>
                  {errorMsg || 'An error occurred'}
                </div>
              </div>
            )}

            {panelState === 'clean' && (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <CheckCircle size={28} style={{ color: colors.statusComplete, marginBottom: 8 }} />
                <div style={{ color: colors.textTertiary, fontSize: 12 }}>
                  Working tree clean
                </div>
                <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                  No uncommitted changes
                </div>
              </div>
            )}

            {panelState === 'changes' && gitStatus && (
              <div>
                {/* Summary */}
                <div
                  style={{
                    padding: '4px 14px 8px',
                    fontSize: 10,
                    color: colors.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    fontWeight: 500,
                  }}
                >
                  {gitStatus.files.length} changed file{gitStatus.files.length !== 1 ? 's' : ''}
                </div>

                {/* File list */}
                {gitStatus.files.map((file) => (
                  <FileRow
                    key={file.path}
                    file={file}
                    isExpanded={expandedFile === file.path}
                    diff={fileDiffs[file.path] ?? null}
                    isLoadingDiff={loadingDiff === file.path}
                    onClick={() => handleFileClick(file.path)}
                    colors={colors}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── File row ───

interface FileRowProps {
  file: GitFileStatus
  isExpanded: boolean
  diff: string | null
  isLoadingDiff: boolean
  onClick: () => void
  colors: ReturnType<typeof useColors>
}

function FileRow({ file, isExpanded, diff, isLoadingDiff, onClick, colors }: FileRowProps) {
  const Icon = STATUS_ICONS[file.status]
  const fileName = file.path.split(/[/\\]/).pop() || file.path
  const dirPath = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/') + 1) : ''

  const statusColor =
    file.status === 'A' || file.status === '?' ? colors.diffAddedBorder :
    file.status === 'D' ? colors.diffRemovedBorder :
    file.status === 'R' ? colors.accent :
    colors.textSecondary

  return (
    <div>
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '6px 14px',
          background: isExpanded ? colors.surfaceHover : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: colors.textPrimary,
          fontSize: 12,
        }}
        onMouseEnter={(e) => {
          if (!isExpanded) e.currentTarget.style.background = colors.surfaceHover
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) e.currentTarget.style.background = 'transparent'
        }}
        title={`${statusLabel(file.status)}: ${file.path}`}
      >
        {isExpanded
          ? <CaretDown size={10} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          : <CaretRight size={10} style={{ color: colors.textTertiary, flexShrink: 0 }} />
        }
        <Icon size={13} style={{ color: statusColor, flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {dirPath && (
            <span style={{ color: colors.textTertiary }}>{dirPath}</span>
          )}
          <span style={{ color: colors.textPrimary }}>{fileName}</span>
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: statusColor,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {file.status === '?' ? 'U' : file.status}
        </span>
      </button>

      {/* Inline diff */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                margin: '0 10px 6px',
                borderRadius: 6,
                border: `1px solid ${colors.toolBorder}`,
                background: colors.codeBg,
                overflow: 'hidden',
                fontSize: 11,
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {isLoadingDiff ? (
                <div style={{ padding: 12, textAlign: 'center' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ display: 'inline-block' }}
                  >
                    <SpinnerGap size={16} style={{ color: colors.textTertiary }} />
                  </motion.div>
                </div>
              ) : diff ? (
                <DiffContent diff={diff} colors={colors} />
              ) : (
                <div style={{ padding: 12, color: colors.textTertiary, fontSize: 11 }}>
                  No diff data
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Diff content (simple line-by-line coloring) ───

function DiffContent({ diff, colors }: { diff: string; colors: ReturnType<typeof useColors> }) {
  const lines = diff.split('\n')

  return (
    <div style={{ padding: '4px 0' }}>
      {lines.map((line, i) => {
        let bg = 'transparent'
        let borderLeft = '3px solid transparent'
        let textColor = colors.textTertiary

        if (line.startsWith('+') && !line.startsWith('+++')) {
          bg = colors.diffAddedBg
          borderLeft = `3px solid ${colors.diffAddedBorder}`
          textColor = colors.textPrimary
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          bg = colors.diffRemovedBg
          borderLeft = `3px solid ${colors.diffRemovedBorder}`
          textColor = colors.textPrimary
        } else if (line.startsWith('@@')) {
          textColor = colors.diffHunkHeader
        } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
          textColor = colors.textMuted
        }

        return (
          <div
            key={i}
            style={{
              background: bg,
              borderLeft,
              padding: '0 8px',
              lineHeight: '18px',
              whiteSpace: 'pre',
              color: textColor,
              minHeight: 18,
            }}
          >
            {line}
          </div>
        )
      })}
    </div>
  )
}
