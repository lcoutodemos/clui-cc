import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Trash, Cpu, CurrencyDollar, Question, HardDrives, Sparkle, Export,
} from '@phosphor-icons/react'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'

export interface SlashCommand {
  command: string
  description: string
  icon: React.ReactNode
  badge?: string
  insertOnly?: boolean
  insertText?: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/clear', description: 'Clear conversation history', icon: <Trash size={13} /> },
  { command: '/focus', description: 'Set the current work focus', icon: <Sparkle size={13} />, insertOnly: true },
  { command: '/claim', description: 'Claim a work item by key', icon: <HardDrives size={13} />, insertOnly: true },
  { command: '/done', description: 'Mark the current work as done', icon: <Question size={13} />, insertOnly: true },
  { command: '/release', description: 'Release the current claim', icon: <Trash size={13} />, insertOnly: true },
  { command: '/memory', description: 'Show active and recent shared work', icon: <HardDrives size={13} /> },
  { command: '/export', description: 'Export this session to Markdown or JSON', icon: <Export size={13} /> },
  { command: '/cost', description: 'Show token usage and cost', icon: <CurrencyDollar size={13} /> },
  { command: '/model', description: 'Show current model info', icon: <Cpu size={13} /> },
  { command: '/mcp', description: 'Show MCP server status', icon: <HardDrives size={13} /> },
  { command: '/skills', description: 'Show available skills', icon: <Sparkle size={13} /> },
  { command: '/help', description: 'Show available commands', icon: <Question size={13} /> },
]

interface Props {
  filter: string
  selectedIndex: number
  onSelect: (cmd: SlashCommand) => void
  anchorRect: DOMRect | null
  extraCommands?: SlashCommand[]
}

export function getFilteredCommands(filter: string): SlashCommand[] {
  return getFilteredCommandsWithExtras(filter, [])
}

export function getFilteredCommandsWithExtras(filter: string, extraCommands: SlashCommand[]): SlashCommand[] {
  const q = filter.toLowerCase()
  const merged: SlashCommand[] = [...SLASH_COMMANDS]
  for (const cmd of extraCommands) {
    if (!merged.some((c) => c.command === cmd.command)) {
      merged.push(cmd)
    }
  }
  return merged.filter((c) => c.command.startsWith(q))
}

export function SlashCommandMenu({ filter, selectedIndex, onSelect, anchorRect, extraCommands = [] }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const popoverLayer = usePopoverLayer()
  const filtered = getFilteredCommandsWithExtras(filter, extraCommands)
  const colors = useColors()

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (filtered.length === 0 || !anchorRect || !popoverLayer) return null

  return createPortal(
    <motion.div
      data-clui-ui
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'fixed',
        bottom: window.innerHeight - anchorRect.top + 4,
        left: anchorRect.left + 12,
        right: window.innerWidth - anchorRect.right + 12,
        pointerEvents: 'auto',
      }}
    >
      <div
        ref={listRef}
        className="overflow-y-auto rounded-xl py-1"
        style={{
          maxHeight: 220,
          background: colors.popoverBg,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${colors.popoverBorder}`,
          boxShadow: colors.popoverShadow,
        }}
      >
        {filtered.map((cmd, i) => {
          const isSelected = i === selectedIndex
          return (
            <button
              key={cmd.command}
              onClick={() => onSelect(cmd)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
              style={{
                background: isSelected ? colors.accentLight : 'transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.accentLight
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                }
              }}
            >
              <span
                className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
                style={{
                  background: isSelected ? colors.accentSoft : colors.surfaceHover,
                  color: isSelected ? colors.accent : colors.textTertiary,
                }}
              >
                {cmd.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-[12px] font-mono font-medium"
                    style={{ color: isSelected ? colors.accent : colors.textPrimary }}
                  >
                    {cmd.command}
                  </span>
                  {cmd.badge && (
                    <span
                      className="text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full"
                      style={{
                        color: isSelected ? colors.accent : colors.textTertiary,
                        background: isSelected ? colors.accentSoft : colors.surfaceHover,
                      }}
                    >
                      {cmd.badge}
                    </span>
                  )}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: colors.textTertiary }}
                >
                  {cmd.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </motion.div>,
    popoverLayer,
  )
}
