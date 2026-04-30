import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Trash, CurrencyDollar, Question, Sparkle,
  Pulse, FirstAid, ArrowsIn, FilePlus,
  Cpu, HardDrives, Robot, Brain, ShieldCheck,
  ArrowCounterClockwise, Export, Bug, GitPullRequest,
  Eye, Note, Lock, ArrowFatUp,
  Cube, SignIn, SignOut, ListChecks, Lightning,
  Gear, Terminal as TerminalIcon, ListBullets,
} from '@phosphor-icons/react'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'

export interface SlashCommand {
  command: string
  description: string
  icon: React.ReactNode
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/agents', description: 'Manage AI subagents', icon: <Robot size={13} /> },
  { command: '/background-tasks', description: 'View or manage background tasks', icon: <ListBullets size={13} /> },
  { command: '/bug', description: 'Submit feedback about Claude Code', icon: <Bug size={13} /> },
  { command: '/clear', description: 'Clear conversation history', icon: <Trash size={13} /> },
  { command: '/compact', description: 'Compact conversation history', icon: <ArrowsIn size={13} /> },
  { command: '/config', description: 'View or modify configuration', icon: <Gear size={13} /> },
  { command: '/cost', description: 'Show token usage and cost', icon: <CurrencyDollar size={13} /> },
  { command: '/doctor', description: 'Run environment diagnostics', icon: <FirstAid size={13} /> },
  { command: '/export', description: 'Export the current conversation', icon: <Export size={13} /> },
  { command: '/help', description: 'Show all available commands', icon: <Question size={13} /> },
  { command: '/hooks', description: 'Manage hook configuration', icon: <Lightning size={13} /> },
  { command: '/init', description: 'Initialize CLAUDE.md for this project', icon: <FilePlus size={13} /> },
  { command: '/login', description: 'Sign in to Claude Code', icon: <SignIn size={13} /> },
  { command: '/logout', description: 'Sign out of Claude Code', icon: <SignOut size={13} /> },
  { command: '/mcp', description: 'Manage MCP servers', icon: <HardDrives size={13} /> },
  { command: '/memory', description: 'View or edit memory files', icon: <Brain size={13} /> },
  { command: '/model', description: 'Switch the active model', icon: <Cpu size={13} /> },
  { command: '/permissions', description: 'Manage tool permissions', icon: <ShieldCheck size={13} /> },
  { command: '/pr-comments', description: 'View PR comments', icon: <GitPullRequest size={13} /> },
  { command: '/privacy-settings', description: 'View privacy settings', icon: <Lock size={13} /> },
  { command: '/release-notes', description: 'View Claude Code release notes', icon: <Note size={13} /> },
  { command: '/resume', description: 'Resume a previous session', icon: <ArrowCounterClockwise size={13} /> },
  { command: '/review', description: 'Review code', icon: <Eye size={13} /> },
  { command: '/skills', description: 'Show available skills', icon: <Sparkle size={13} /> },
  { command: '/status', description: 'Show session status', icon: <Pulse size={13} /> },
  { command: '/terminal-setup', description: 'Set up shell keybindings', icon: <TerminalIcon size={13} /> },
  { command: '/todos', description: 'View todo list', icon: <ListChecks size={13} /> },
  { command: '/upgrade', description: 'Upgrade Claude Code', icon: <ArrowFatUp size={13} /> },
  { command: '/vim', description: 'Toggle vim editing mode', icon: <Cube size={13} /> },
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
                <span
                  className="text-[12px] font-mono font-medium"
                  style={{ color: isSelected ? colors.accent : colors.textPrimary }}
                >
                  {cmd.command}
                </span>
                <span
                  className="text-[11px] ml-2"
                  style={{ color: colors.textTertiary }}
                >
                  {cmd.description}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </motion.div>,
    popoverLayer,
  )
}
