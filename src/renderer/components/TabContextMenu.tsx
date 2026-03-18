import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useTabGroupStore, GROUP_COLORS } from '../stores/tabGroupStore'
import { useSessionStore } from '../stores/sessionStore'
import { usePopoverLayer } from './PopoverLayer'
import type { TabGroup } from '../../shared/types'

export function TabContextMenu() {
  const colors = useColors()
  const popoverLayer = usePopoverLayer()
  const tabId = useTabGroupStore((s) => s.contextMenuTabId)
  const position = useTabGroupStore((s) => s.contextMenuPosition)
  const closeContextMenu = useTabGroupStore((s) => s.closeContextMenu)
  const groups = useTabGroupStore((s) => s.groups)
  const createGroup = useTabGroupStore((s) => s.createGroup)
  const setTabGroup = useSessionStore((s) => s.setTabGroup)
  const tab = useSessionStore((s) => s.tabs.find((t) => t.id === tabId))

  const menuRef = useRef<HTMLDivElement>(null)
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!tabId) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    // Delay to avoid immediately closing from the right-click event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [tabId, closeContextMenu])

  // Close on Escape
  useEffect(() => {
    if (!tabId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [tabId, closeContextMenu])

  // Focus input when showing new group input
  useEffect(() => {
    if (showNewGroupInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showNewGroupInput])

  // Reset state when menu closes
  useEffect(() => {
    if (!tabId) {
      setShowNewGroupInput(false)
      setNewGroupName('')
    }
  }, [tabId])

  if (!tabId || !position || !popoverLayer) return null

  const handleMoveToGroup = (groupId: string) => {
    setTabGroup(tabId, groupId)
    closeContextMenu()
  }

  const handleRemoveFromGroup = () => {
    setTabGroup(tabId, undefined)
    closeContextMenu()
  }

  const handleCreateGroup = () => {
    const trimmed = newGroupName.trim()
    if (!trimmed) return
    const groupId = createGroup(trimmed)
    setTabGroup(tabId, groupId)
    closeContextMenu()
  }

  const sortedGroups = [...groups].sort((a, b) => a.order - b.order)

  const menuContent = (
    <div
      ref={menuRef}
      data-clui-ui
      className="pointer-events-auto"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 10000,
        minWidth: 180,
        background: colors.popoverBg,
        border: `1px solid ${colors.popoverBorder}`,
        borderRadius: 10,
        boxShadow: colors.popoverShadow,
        padding: '4px 0',
        fontSize: 12,
      }}
    >
      {/* Move to group section */}
      {sortedGroups.length > 0 && (
        <>
          <div
            style={{
              padding: '4px 12px 2px',
              fontSize: 10,
              color: colors.textTertiary,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Move to group
          </div>
          {sortedGroups.map((group: TabGroup) => (
            <button
              key={group.id}
              className="w-full text-left flex items-center gap-2 transition-colors"
              style={{
                padding: '6px 12px',
                color: tab?.groupId === group.id ? colors.accent : colors.textPrimary,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = colors.surfaceHover
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
              onClick={() => handleMoveToGroup(group.id)}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: group.color ? GROUP_COLORS[group.color] : colors.textTertiary,
                }}
              />
              <span className="truncate">{group.name}</span>
              {tab?.groupId === group.id && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: colors.textTertiary }}>
                  current
                </span>
              )}
            </button>
          ))}
          <div style={{ height: 1, background: colors.popoverBorder, margin: '4px 0' }} />
        </>
      )}

      {/* New group */}
      {showNewGroupInput ? (
        <div style={{ padding: '4px 12px' }}>
          <input
            ref={inputRef}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateGroup()
              if (e.key === 'Escape') {
                setShowNewGroupInput(false)
                setNewGroupName('')
              }
            }}
            placeholder="Group name..."
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: 12,
              color: colors.textPrimary,
              padding: '4px 0',
              borderBottom: `1px solid ${colors.popoverBorder}`,
            }}
          />
        </div>
      ) : (
        <button
          className="w-full text-left flex items-center gap-2 transition-colors"
          style={{
            padding: '6px 12px',
            color: colors.textSecondary,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = colors.surfaceHover
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
          onClick={() => setShowNewGroupInput(true)}
        >
          <Plus size={12} />
          <span>New Group...</span>
        </button>
      )}

      {/* Remove from group */}
      {tab?.groupId && (
        <>
          <div style={{ height: 1, background: colors.popoverBorder, margin: '4px 0' }} />
          <button
            className="w-full text-left flex items-center gap-2 transition-colors"
            style={{
              padding: '6px 12px',
              color: colors.textSecondary,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = colors.surfaceHover
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
            onClick={handleRemoveFromGroup}
          >
            Remove from group
          </button>
        </>
      )}
    </div>
  )

  return createPortal(menuContent, popoverLayer)
}
