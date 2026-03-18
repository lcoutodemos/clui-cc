import React from 'react'
import { Plus, X, TerminalWindow, CheckCircle, XCircle } from '@phosphor-icons/react'
import { useTerminalStore } from '../stores/terminalStore'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'

export function TerminalTabStrip() {
  const termTabs = useTerminalStore((s) => s.termTabs)
  const activeTermTabId = useTerminalStore((s) => s.activeTermTabId)
  const setActiveTermTab = useTerminalStore((s) => s.setActiveTermTab)
  const createTermTab = useTerminalStore((s) => s.createTermTab)
  const closeTermTab = useTerminalStore((s) => s.closeTermTab)
  const colors = useColors()

  const handleNewTab = () => {
    const chatTab = useSessionStore.getState().tabs.find(
      (t) => t.id === useSessionStore.getState().activeTabId,
    )
    createTermTab({ cwd: chatTab?.workingDirectory }).catch(() => {})
  }

  return (
    <div
      data-clui-ui
      className="flex items-center no-drag"
      style={{
        height: 36,
        padding: '0 8px',
        borderBottom: `1px solid ${colors.containerBorder}`,
        gap: 2,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {termTabs.map((tab) => {
        const isActive = tab.id === activeTermTabId
        const isExited = tab.status === 'exited'
        const exitSuccess = isExited && tab.exitCode === 0
        const exitFail = isExited && tab.exitCode !== 0

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTermTab(tab.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] flex-shrink-0 border-0 cursor-pointer"
            style={{
              background: isActive ? colors.tabActive : 'transparent',
              color: isActive ? colors.textPrimary : colors.textTertiary,
              border: isActive ? `1px solid ${colors.tabActiveBorder}` : '1px solid transparent',
              borderBottom: isExited ? `2px solid ${exitSuccess ? '#4ade80' : '#f87171'}` : undefined,
              transition: 'background 0.1s, color 0.1s',
            }}
            aria-label={`Terminal tab: ${tab.title}`}
            aria-selected={isActive}
          >
            {exitSuccess && <CheckCircle size={12} style={{ color: '#4ade80' }} />}
            {exitFail && <XCircle size={12} style={{ color: '#f87171' }} />}
            {!isExited && <TerminalWindow size={12} weight={isActive ? 'fill' : 'regular'} />}
            <span className="truncate" style={{ maxWidth: 100 }}>
              {tab.title}
              {exitFail && ` [${tab.exitCode}]`}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation()
                closeTermTab(tab.id)
              }}
              className="flex items-center justify-center rounded-full hover:bg-white/10"
              style={{ width: 14, height: 14, cursor: 'pointer' }}
              aria-label="Close tab"
            >
              <X size={9} />
            </span>
          </button>
        )
      })}

      {/* New terminal tab button */}
      <button
        onClick={handleNewTab}
        className="flex items-center justify-center rounded-full flex-shrink-0 border-0 cursor-pointer"
        style={{
          width: 22,
          height: 22,
          background: 'transparent',
          color: colors.textTertiary,
        }}
        title="New terminal tab (Ctrl+Shift+T)"
        aria-label="New terminal tab"
      >
        <Plus size={12} />
      </button>
    </div>
  )
}
