import React, { useEffect, useState } from 'react'
import { TerminalTabStrip } from './TerminalTabStrip'
import { TerminalView } from './TerminalView'
import { TerminalStatusBar } from './TerminalStatusBar'
import { useTerminalStore } from '../stores/terminalStore'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'

export function TerminalPanel() {
  const termTabs = useTerminalStore((s) => s.termTabs)
  const activeTermTabId = useTerminalStore((s) => s.activeTermTabId)
  const createTermTab = useTerminalStore((s) => s.createTermTab)
  const handleTerminalExit = useTerminalStore((s) => s.handleTerminalExit)
  const ptyAvailable = useTerminalStore((s) => s.ptyAvailable)
  const colors = useColors()
  const [error, setError] = useState<string | null>(null)

  // Auto-create first terminal tab using chat's working directory
  useEffect(() => {
    if (termTabs.length === 0 && ptyAvailable) {
      const chatTab = useSessionStore.getState().tabs.find(
        (t) => t.id === useSessionStore.getState().activeTabId,
      )
      const cwd = chatTab?.workingDirectory || undefined
      createTermTab({ cwd }).catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
      })
    }
  }, [ptyAvailable])

  // Listen for terminal exit events
  useEffect(() => {
    const unsub = window.clui.onTerminalExit((termTabId, exitCode) => {
      handleTerminalExit(termTabId, exitCode)
    })
    return unsub
  }, [handleTerminalExit])

  // Listen for terminal shortcuts from TerminalView customKeyEventHandler
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail?.action) return
      const store = useTerminalStore.getState()

      switch (detail.action) {
        case 'new-tab': {
          const chatTab = useSessionStore.getState().tabs.find(
            (t) => t.id === useSessionStore.getState().activeTabId,
          )
          store.createTermTab({ cwd: chatTab?.workingDirectory }).catch(() => {})
          break
        }
        case 'close-tab':
          if (store.activeTermTabId) store.closeTermTab(store.activeTermTabId)
          break
        case 'next-tab': {
          const tabs = store.termTabs
          const idx = tabs.findIndex((t) => t.id === store.activeTermTabId)
          if (tabs.length > 1) store.setActiveTermTab(tabs[(idx + 1) % tabs.length].id)
          break
        }
        case 'prev-tab': {
          const tabs = store.termTabs
          const idx = tabs.findIndex((t) => t.id === store.activeTermTabId)
          if (tabs.length > 1) store.setActiveTermTab(tabs[(idx - 1 + tabs.length) % tabs.length].id)
          break
        }
        case 'zoom-in':
          store.setFontSize(store.fontSize + 1)
          break
        case 'zoom-out':
          store.setFontSize(store.fontSize - 1)
          break
        case 'zoom-reset':
          store.setFontSize(13)
          break
      }
    }
    window.addEventListener('clui-terminal-shortcut', handler)
    return () => window.removeEventListener('clui-terminal-shortcut', handler)
  }, [])

  const activeTab = termTabs.find((t) => t.id === activeTermTabId)

  // node-pty unavailable state
  if (ptyAvailable === false) {
    return (
      <div
        data-clui-ui
        className="flex items-center justify-center h-full"
        style={{ padding: 24 }}
      >
        <div
          style={{
            width: 320,
            background: colors.surfacePrimary,
            border: `1px solid ${colors.containerBorder}`,
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>
            Terminal Unavailable
          </div>
          <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 16 }}>
            The native terminal module (node-pty) could not be loaded.
            Close the app, run <code style={{ color: colors.accent, fontSize: 12 }}>npm rebuild</code>, and restart.
          </div>
          <button
            onClick={() => useTerminalStore.getState().toggleMode()}
            style={{
              background: colors.accent,
              color: colors.textOnAccent,
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Back to Chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-clui-ui
      className="flex flex-col"
      style={{ height: '100%', minHeight: 0 }}
    >
      <TerminalTabStrip />

      {/* Error banner */}
      {error && (
        <div style={{ padding: '8px 12px', fontSize: 12, color: colors.statusError, background: colors.statusErrorBg }}>
          {error}
        </div>
      )}

      {/* Terminal views — all mounted, only active visible */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {termTabs.map((tab) => (
          <TerminalView
            key={tab.id}
            termTabId={tab.id}
            isActive={tab.id === activeTermTabId}
          />
        ))}

        {termTabs.length === 0 && !error && (
          <div
            className="flex items-center justify-center h-full text-[13px]"
            style={{ color: colors.textTertiary }}
          >
            No terminal tabs open
          </div>
        )}
      </div>

      <TerminalStatusBar activeTab={activeTab ?? null} />
    </div>
  )
}
