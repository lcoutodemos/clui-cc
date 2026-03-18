import React from 'react'
import { AnimatePresence, Reorder } from 'framer-motion'
import { Plus, X } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { orderTabsByTabOrder } from '../stores/tabOrder'
import { HistoryPicker } from './HistoryPicker'
import { SettingsPopover } from './SettingsPopover'
import { useColors } from '../theme'
import type { TabStatus } from '../../shared/types'

function StatusDot({ status, hasUnread, hasPermission }: { status: TabStatus; hasUnread: boolean; hasPermission: boolean }) {
  const colors = useColors()
  let bg: string = colors.statusIdle
  let pulse = false
  let glow = false

  if (status === 'dead' || status === 'failed') {
    bg = colors.statusError
  } else if (hasPermission) {
    bg = colors.statusPermission
    glow = true
  } else if (status === 'connecting' || status === 'running') {
    bg = colors.statusRunning
    pulse = true
  } else if (hasUnread) {
    bg = colors.statusComplete
  }

  return (
    <span
      className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${pulse ? 'animate-pulse-dot' : ''}`}
      style={{
        background: bg,
        ...(glow ? { boxShadow: `0 0 6px 2px ${colors.statusPermissionGlow}` } : {}),
      }}
    />
  )
}

export function TabStrip() {
  const tabs = useSessionStore((s) => s.tabs)
  const tabOrder = useSessionStore((s) => s.tabOrder)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const selectTab = useSessionStore((s) => s.selectTab)
  const createTab = useSessionStore((s) => s.createTab)
  const closeTab = useSessionStore((s) => s.closeTab)
  const reorderTabs = useSessionStore((s) => s.reorderTabs)
  const colors = useColors()
  const [draggingTabId, setDraggingTabId] = React.useState<string | null>(null)

  const orderedTabs = orderTabsByTabOrder(tabs, tabOrder)
  const orderedTabIds = orderedTabs.map((tab) => tab.id)

  return (
    <div
      data-clui-ui
      className="flex items-center no-drag"
      style={{ padding: '8px 0' }}
    >
      <div className="relative min-w-0 flex-1">
        <Reorder.Group
          axis="x"
          values={orderedTabIds}
          onReorder={reorderTabs}
          role="tablist"
          aria-dropeffect="move"
          className="flex items-center gap-1 overflow-x-auto min-w-0"
          style={{
            scrollbarWidth: 'none',
            paddingLeft: 8,
            paddingRight: 14,
            maskImage: 'linear-gradient(to right, black 0%, black calc(100% - 40px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(100% - 40px), transparent 100%)',
          }}
        >
          <AnimatePresence mode="popLayout">
            {orderedTabs.map((tab) => {
              const isActive = tab.id === activeTabId
              const isDragging = tab.id === draggingTabId

              return (
                <Reorder.Item
                  key={tab.id}
                  value={tab.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15, type: 'spring', stiffness: 320, damping: 28 }}
                  onClick={() => selectTab(tab.id)}
                  onDragStart={() => setDraggingTabId(tab.id)}
                  onDragEnd={() => setDraggingTabId(null)}
                  whileDrag={{
                    scale: 1.03,
                    opacity: 0.9,
                    zIndex: 20,
                    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
                  }}
                  role="tab"
                  aria-selected={isActive}
                  aria-grabbed={isDragging}
                  className="group flex items-center gap-1.5 select-none flex-shrink-0 max-w-[160px] transition-all duration-150"
                  style={{
                    background: isActive ? colors.tabActive : 'transparent',
                    border: isActive ? `1px solid ${colors.tabActiveBorder}` : '1px solid transparent',
                    borderRadius: 9999,
                    padding: '4px 10px',
                    fontSize: 12,
                    color: isActive ? colors.textPrimary : colors.textTertiary,
                    fontWeight: isActive ? 500 : 400,
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                >
                  <StatusDot status={tab.status} hasUnread={tab.hasUnread} hasPermission={tab.permissionQueue.length > 0} />
                  <span className="truncate flex-1">{tab.title}</span>
                  {orderedTabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.id)
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="flex-shrink-0 rounded-full w-4 h-4 flex items-center justify-center transition-opacity"
                      style={{
                        opacity: isActive ? 0.5 : 0,
                        color: colors.textSecondary,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = isActive ? '0.5' : '0' }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </Reorder.Item>
              )
            })}
          </AnimatePresence>
        </Reorder.Group>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0 ml-1 pr-2">
        <button
          onClick={() => createTab()}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
          style={{ color: colors.textTertiary }}
          title="New tab"
        >
          <Plus size={14} />
        </button>

        <HistoryPicker />

        <SettingsPopover />
      </div>
    </div>
  )
}
