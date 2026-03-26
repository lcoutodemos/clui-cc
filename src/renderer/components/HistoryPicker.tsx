import React, { useState, useEffect, useCallback } from 'react'
import { Clock, ChatCircle } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'
import type { SessionMeta } from '../../shared/types'

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

/* ─── History trigger button (used in TabStrip) ─── */

export function HistoryTrigger() {
  const toggleHistory = useSessionStore((s) => s.toggleHistory)
  const colors = useColors()

  return (
    <button
      data-history-trigger
      onClick={toggleHistory}
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
      style={{ color: colors.textTertiary }}
      title="Resume a previous session"
    >
      <Clock size={13} />
    </button>
  )
}

/* ─── History content (rendered inline in App.tsx) ─── */

export function HistoryContent() {
  const resumeSession = useSessionStore((s) => s.resumeSession)
  const activeTab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId),
    (a, b) => a === b || (!!a && !!b && a.hasChosenDirectory === b.hasChosenDirectory && a.workingDirectory === b.workingDirectory),
  )
  const staticInfo = useSessionStore((s) => s.staticInfo)
  const colors = useColors()

  const effectiveProjectPath = activeTab?.hasChosenDirectory
    ? activeTab.workingDirectory
    : (staticInfo?.homePath || activeTab?.workingDirectory || '~')

  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(false)

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

  // Load sessions on mount (fires when historyOpen becomes true and this component mounts)
  useEffect(() => { void loadSessions() }, [loadSessions])

  const handleSelect = (session: SessionMeta) => {
    useSessionStore.setState({ historyOpen: false })
    const title = session.firstMessage
      ? (session.firstMessage.length > 30 ? session.firstMessage.substring(0, 27) + '...' : session.firstMessage)
      : session.slug || 'Resumed'
    void resumeSession(session.sessionId, title, effectiveProjectPath)
  }

  return (
    <div>
      <div
        className="px-3 py-2 text-[11px] font-medium flex-shrink-0"
        style={{ color: colors.textTertiary, borderBottom: `1px solid ${colors.popoverBorder}` }}
      >
        Recent Sessions
      </div>

      <div className="overflow-y-auto py-1" style={{ maxHeight: 280, minHeight: 280 }}>
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

        {!loading && sessions.map((session) => (
          <button
            key={session.sessionId}
            onClick={() => handleSelect(session)}
            className="w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer"
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
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
        ))}
      </div>
    </div>
  )
}
