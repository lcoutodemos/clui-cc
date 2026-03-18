import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Clock, ChatCircle, PushPin, DownloadSimple } from '@phosphor-icons/react'
import { useExportStore } from '../stores/exportStore'
import { useSessionStore } from '../stores/sessionStore'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'
import type { Message, SessionMeta } from '../../shared/types'

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

function getSessionTitle(session: SessionMeta): string {
  return session.firstMessage
    ? (session.firstMessage.length > 30 ? session.firstMessage.substring(0, 27) + '...' : session.firstMessage)
    : session.slug || 'Resumed'
}

export function HistoryPicker() {
  const resumeSession = useSessionStore((s) => s.resumeSession)
  const addSystemMessage = useSessionStore((s) => s.addSystemMessage)
  const openExportDialog = useExportStore((s) => s.openDialog)
  const isExpanded = useSessionStore((s) => s.isExpanded)
  const activeTab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b && a.hasChosenDirectory === b.hasChosenDirectory && a.workingDirectory === b.workingDirectory),
  )
  const staticInfo = useSessionStore((s) => s.staticInfo)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()
  const effectiveProjectPath = activeTab?.hasChosenDirectory
    ? activeTab.workingDirectory
    : (staticInfo?.homePath || activeTab?.workingDirectory || '~')

  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number; maxHeight?: number }>({ right: 0 })

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    if (isExpanded) {
      const top = rect.bottom + 6
      setPos({
        top,
        right: window.innerWidth - rect.right,
        maxHeight: window.innerHeight - top - 12,
      })
    } else {
      setPos({
        bottom: window.innerHeight - rect.top + 6,
        right: window.innerWidth - rect.right,
      })
    }
  }, [isExpanded])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.clui.listSessions(effectiveProjectPath)
      setSessions(result)
    } catch {
      setSessions([])
    }
    setLoading(false)
  }, [effectiveProjectPath])

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
    if (!open) {
      updatePos()
      void loadSessions()
    }
    setOpen((o) => !o)
  }

  const handleSelect = (session: SessionMeta) => {
    setOpen(false)
    void resumeSession(session.sessionId, getSessionTitle(session), effectiveProjectPath)
  }

  const handleExportSession = async (session: SessionMeta, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      const history = await window.clui.loadSession(session.sessionId, effectiveProjectPath)
      if (history.length === 0) {
        addSystemMessage('Nothing to export for that session.')
        return
      }

      const messages: Message[] = history.map((message) => ({
        id: `${session.sessionId}-${message.timestamp}-${message.role}`,
        role: message.role as Message['role'],
        content: message.content,
        toolName: message.toolName,
        toolStatus: message.toolName ? 'completed' : undefined,
        timestamp: message.timestamp,
      }))

      openExportDialog({
        title: getSessionTitle(session),
        exportedAt: new Date().toISOString(),
        sessionId: session.sessionId,
        projectPath: effectiveProjectPath,
        model: null,
        messages,
        lastResult: null,
      })
      setOpen(false)
    } catch {
      addSystemMessage('Failed to load that session for export.')
    }
  }

  const handleTogglePin = async (session: SessionMeta, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      if (session.pinned) {
        await window.clui.unpinSession(session.sessionId)
      } else {
        await window.clui.pinSession(session.sessionId, effectiveProjectPath)
      }
      await loadSessions()
    } catch {}
  }

  const pinnedSessions = sessions.filter((session) => session.pinned)
  const recentSessions = sessions.filter((session) => !session.pinned)

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
        style={{ color: colors.textTertiary }}
        title="Resume a previous session"
      >
        <Clock size={13} />
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
            width: 280,
            pointerEvents: 'auto',
            background: colors.popoverBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
            border: `1px solid ${colors.popoverBorder}`,
            ...(pos.maxHeight != null ? { maxHeight: pos.maxHeight } : {}),
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column' as const,
          }}
        >
          <div className="px-3 py-2 text-[11px] font-medium flex-shrink-0" style={{ color: colors.textTertiary, borderBottom: `1px solid ${colors.popoverBorder}` }}>
            Session History
          </div>

          <div className="overflow-y-auto py-1" style={{ maxHeight: pos.maxHeight != null ? undefined : 180 }}>
            {loading && (
              <div className="px-3 py-4 text-center text-[11px]" style={{ color: colors.textTertiary }}>
                Loading...
              </div>
            )}

            {!loading && sessions.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px]" style={{ color: colors.textTertiary }}>
                No previous sessions found
              </div>
            )}

            {!loading && pinnedSessions.length > 0 && (
              <>
                <div
                  className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider"
                  style={{ color: colors.textTertiary }}
                >
                  Pinned ({pinnedSessions.length})
                </div>
                {pinnedSessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="flex items-start gap-2.5 px-3 py-2"
                    style={{ borderLeft: `2px solid ${colors.accent}` }}
                  >
                    <button
                      onClick={() => handleSelect(session)}
                      className="min-w-0 flex-1 flex items-start gap-2.5 text-left transition-colors"
                    >
                      <ChatCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: colors.accent }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] truncate" style={{ color: colors.textPrimary }}>
                          {session.firstMessage || session.slug || session.sessionId.substring(0, 8)}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: colors.textTertiary }}>
                          <span>{formatTimeAgo(session.lastTimestamp)}</span>
                          <span>{formatSize(session.size)}</span>
                          {session.slug && <span className="truncate">{session.slug}</span>}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      <button
                        onClick={(event) => void handleExportSession(session, event)}
                        className="flex-shrink-0"
                        style={{ color: colors.textTertiary }}
                        title="Export session"
                      >
                        <DownloadSimple size={13} />
                      </button>
                      <button
                        onClick={(event) => void handleTogglePin(session, event)}
                        className="flex-shrink-0"
                        style={{ color: colors.accent }}
                        title="Unpin session"
                      >
                        <PushPin size={13} weight="fill" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="mx-3 my-1" style={{ height: 1, background: colors.popoverBorder }} />
              </>
            )}

            {!loading && recentSessions.length > 0 && (
              <>
                <div
                  className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider"
                  style={{ color: colors.textTertiary }}
                >
                  Recent
                </div>
                {recentSessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="flex items-start gap-2.5 px-3 py-2"
                  >
                    <button
                      onClick={() => handleSelect(session)}
                      className="min-w-0 flex-1 flex items-start gap-2.5 text-left transition-colors"
                    >
                      <ChatCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: colors.textTertiary }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] truncate" style={{ color: colors.textPrimary }}>
                          {session.firstMessage || session.slug || session.sessionId.substring(0, 8)}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: colors.textTertiary }}>
                          <span>{formatTimeAgo(session.lastTimestamp)}</span>
                          <span>{formatSize(session.size)}</span>
                          {session.slug && <span className="truncate">{session.slug}</span>}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      <button
                        onClick={(event) => void handleExportSession(session, event)}
                        className="flex-shrink-0"
                        style={{ color: colors.textTertiary }}
                        title="Export session"
                      >
                        <DownloadSimple size={13} />
                      </button>
                      <button
                        onClick={(event) => void handleTogglePin(session, event)}
                        className="flex-shrink-0"
                        style={{ color: colors.textTertiary }}
                        title="Pin session"
                      >
                        <PushPin size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}
