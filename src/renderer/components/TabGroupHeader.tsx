import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CaretDown, CaretRight, Circle, X } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useTabGroupStore, GROUP_COLORS } from '../stores/tabGroupStore'
import { useSessionStore } from '../stores/sessionStore'
import type { TabGroup, TabStatus } from '../../shared/types'

/** Given a list of tab statuses, return the most "urgent" one for the aggregate dot. */
function aggregateStatus(statuses: TabStatus[]): TabStatus {
  if (statuses.some((s) => s === 'dead' || s === 'failed')) return 'failed'
  if (statuses.some((s) => s === 'running' || s === 'connecting')) return 'running'
  if (statuses.some((s) => s === 'completed')) return 'completed'
  return 'idle'
}

function statusDotColor(
  status: TabStatus,
  colors: ReturnType<typeof useColors>,
): string {
  if (status === 'dead' || status === 'failed') return colors.statusError
  if (status === 'running' || status === 'connecting') return colors.statusRunning
  if (status === 'completed') return colors.statusComplete
  return colors.statusIdle
}

interface TabGroupHeaderProps {
  group: TabGroup
  tabCount: number
  tabStatuses: TabStatus[]
}

export function TabGroupHeader({ group, tabCount, tabStatuses }: TabGroupHeaderProps) {
  const colors = useColors()
  const toggleCollapsed = useTabGroupStore((s) => s.toggleCollapsed)
  const renameGroup = useTabGroupStore((s) => s.renameGroup)
  const deleteGroup = useTabGroupStore((s) => s.deleteGroup)
  const setTabGroup = useSessionStore((s) => s.setTabGroup)
  const tabs = useSessionStore((s) => s.tabs)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(group.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== group.name) {
      renameGroup(group.id, trimmed)
    } else {
      setRenameValue(group.name)
    }
    setIsRenaming(false)
  }

  const groupColor = group.color ? GROUP_COLORS[group.color] : colors.textTertiary
  const aggStatus = aggregateStatus(tabStatuses)

  return (
    <motion.div
      data-clui-ui
      layout
      className="flex items-center gap-1.5 select-none cursor-pointer group/header"
      style={{
        padding: '3px 8px 3px 4px',
        fontSize: 11,
        color: colors.textSecondary,
        borderLeft: `3px solid ${groupColor}`,
        borderRadius: 4,
        marginBottom: 2,
      }}
      onClick={() => {
        if (!isRenaming) toggleCollapsed(group.id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setRenameValue(group.name)
        setIsRenaming(true)
      }}
    >
      {/* Caret */}
      {group.collapsed ? (
        <CaretRight size={10} weight="bold" style={{ color: colors.textTertiary, flexShrink: 0 }} />
      ) : (
        <CaretDown size={10} weight="bold" style={{ color: colors.textTertiary, flexShrink: 0 }} />
      )}

      {/* Aggregate status dot */}
      <Circle
        size={6}
        weight="fill"
        style={{
          color: statusDotColor(aggStatus, colors),
          flexShrink: 0,
        }}
      />

      {/* Name or rename input */}
      {isRenaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') {
              setRenameValue(group.name)
              setIsRenaming(false)
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-none outline-none text-inherit flex-1 min-w-0"
          style={{
            fontSize: 11,
            padding: '0 2px',
            color: colors.textPrimary,
          }}
        />
      ) : (
        <span className="truncate flex-1 min-w-0" style={{ fontWeight: 500 }}>
          {group.name}
        </span>
      )}

      {/* Tab count badge */}
      <span
        className="flex-shrink-0 rounded-full flex items-center justify-center"
        style={{
          fontSize: 9,
          minWidth: 14,
          height: 14,
          padding: '0 4px',
          background: colors.surfaceHover,
          color: colors.textTertiary,
        }}
      >
        {tabCount}
      </span>

      {/* Delete group button */}
      <button
        className="flex-shrink-0 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover/header:opacity-60 hover:!opacity-100 transition-opacity"
        style={{ color: colors.textSecondary }}
        onClick={(e) => {
          e.stopPropagation()
          // Ungroup all tabs in this group before deleting
          for (const tab of tabs) {
            if (tab.groupId === group.id) {
              setTabGroup(tab.id, undefined)
            }
          }
          deleteGroup(group.id)
        }}
        title="Delete group (tabs become ungrouped)"
      >
        <X size={9} />
      </button>
    </motion.div>
  )
}
