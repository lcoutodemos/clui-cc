import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Plus, ClockCounterClockwise, GearSix, HeadCircuit, Lightning, DownloadSimple,
  Browser, Cpu, Moon, Sun, ArrowsOutSimple, ArrowsInSimple, X, GitBranch,
  TerminalWindow, Broom,
} from '@phosphor-icons/react'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'
import { useThemeStore } from '../theme'
import { useCommandPaletteStore } from '../stores/commandPaletteStore'
import { useSessionStore, AVAILABLE_MODELS } from '../stores/sessionStore'
import { useTerminalStore } from '../stores/terminalStore'
import { useShortcutStore } from '../stores/shortcutStore'
import { useSnippetStore } from '../stores/snippetStore'
import type { PaletteCommand } from '../../shared/command-palette'

const ICON_SIZE = 14

const ICON_MAP: Record<string, React.ReactNode> = {
  Plus: <Plus size={ICON_SIZE} />,
  ClockCounterClockwise: <ClockCounterClockwise size={ICON_SIZE} />,
  GearSix: <GearSix size={ICON_SIZE} />,
  HeadCircuit: <HeadCircuit size={ICON_SIZE} />,
  Lightning: <Lightning size={ICON_SIZE} />,
  DownloadSimple: <DownloadSimple size={ICON_SIZE} />,
  Browser: <Browser size={ICON_SIZE} />,
  Cpu: <Cpu size={ICON_SIZE} />,
  Moon: <Moon size={ICON_SIZE} />,
  Sun: <Sun size={ICON_SIZE} />,
  ArrowsOutSimple: <ArrowsOutSimple size={ICON_SIZE} />,
  ArrowsInSimple: <ArrowsInSimple size={ICON_SIZE} />,
  X: <X size={ICON_SIZE} />,
  GitBranch: <GitBranch size={ICON_SIZE} />,
  TerminalWindow: <TerminalWindow size={ICON_SIZE} />,
  Broom: <Broom size={ICON_SIZE} />,
}

function resolveIcon(name: string): React.ReactNode {
  return ICON_MAP[name] ?? <Lightning size={ICON_SIZE} />
}

// ─── Command execution ───

function executeCommand(command: PaletteCommand): void {
  const { id } = command
  const session = useSessionStore.getState()
  const theme = useThemeStore.getState()
  const snippets = useSnippetStore.getState()

  if (id === 'new-tab') {
    session.createTab()
  } else if (id === 'close-tab') {
    const { activeTabId, tabs } = session
    if (tabs.length > 1) session.closeTab(activeTabId)
  } else if (id === 'clear-tab') {
    session.clearTab()
  } else if (id === 'history') {
    if (!session.isExpanded) session.toggleExpanded()
    window.dispatchEvent(new Event('clui-open-history'))
  } else if (id === 'marketplace') {
    session.toggleMarketplace()
  } else if (id === 'snippets') {
    snippets.openManager()
  } else if (id === 'git-panel') {
    window.dispatchEvent(new Event('clui-toggle-git-panel'))
  } else if (id === 'toggle-expanded') {
    session.toggleExpanded()
  } else if (id === 'theme-dark') {
    theme.setThemeMode('dark')
  } else if (id === 'theme-light') {
    theme.setThemeMode('light')
  } else if (id.startsWith('model:')) {
    const modelId = id.replace('model:', '')
    session.setPreferredModel(modelId)
  } else if (id.startsWith('tab:')) {
    const tabId = id.replace('tab:', '')
    session.selectTab(tabId)
    if (!session.isExpanded) session.toggleExpanded()
  } else if (id === 'terminal-toggle') {
    useTerminalStore.getState().toggleMode()
  } else if (id === 'terminal-new-tab') {
    useTerminalStore.getState().toggleMode()
    useTerminalStore.getState().createTermTab().catch(() => {})
  } else if (id === 'terminal-close-tab') {
    const term = useTerminalStore.getState()
    if (term.activeTermTabId) term.closeTermTab(term.activeTermTabId)
  } else if (id === 'terminal-clear') {
    window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: 'clear' } }))
  }
}

// ─── Dynamic command builder ───

function buildCommands(): PaletteCommand[] {
  const { tabs, activeTabId, isExpanded, preferredModel } = useSessionStore.getState()
  const { themeMode } = useThemeStore.getState()
  const shortcutMap = useShortcutStore.getState().getShortcutMap()

  const commands: PaletteCommand[] = [
    // Actions
    { id: 'new-tab', category: 'action', icon: 'Plus', label: 'New Tab', shortcut: shortcutMap['new-tab'] },
    { id: 'close-tab', category: 'action', icon: 'X', label: 'Close Tab', shortcut: shortcutMap['close-tab'] },
    { id: 'clear-tab', category: 'action', icon: 'X', label: 'Clear Conversation' },
    { id: 'history', category: 'action', icon: 'ClockCounterClockwise', label: 'Open History', shortcut: shortcutMap['open-history'] },
    { id: 'marketplace', category: 'action', icon: 'HeadCircuit', label: 'Marketplace', shortcut: shortcutMap['open-marketplace'] },
    { id: 'snippets', category: 'action', icon: 'Lightning', label: 'Manage Snippets' },
    { id: 'git-panel', category: 'action', icon: 'GitBranch', label: 'Git Context Panel' },
    {
      id: 'toggle-expanded',
      category: 'action',
      icon: isExpanded ? 'ArrowsInSimple' : 'ArrowsOutSimple',
      label: isExpanded ? 'Collapse Panel' : 'Expand Panel',
      shortcut: shortcutMap['toggle-expand'],
    },
  ]

  // Theme commands
  commands.push({
    id: 'theme-dark',
    category: 'theme',
    icon: 'Moon',
    label: 'Dark Theme',
    description: themeMode === 'dark' ? 'Active' : undefined,
  })
  commands.push({
    id: 'theme-light',
    category: 'theme',
    icon: 'Sun',
    label: 'Light Theme',
    description: themeMode === 'light' ? 'Active' : undefined,
  })

  // Model commands
  for (const model of AVAILABLE_MODELS) {
    commands.push({
      id: `model:${model.id}`,
      category: 'model',
      icon: 'Cpu',
      label: `Switch to ${model.label}`,
      description: preferredModel === model.id ? 'Active' : undefined,
    })
  }

  // Tab switching commands
  for (const tab of tabs) {
    if (tab.id === activeTabId) continue
    const title = tab.title || tab.workingDirectory?.split(/[\\/]/).pop() || 'Untitled'
    commands.push({
      id: `tab:${tab.id}`,
      category: 'tab',
      icon: 'Browser',
      label: `Switch to "${title}"`,
    })
  }

  // Terminal commands
  const { terminalMode, ptyAvailable } = useTerminalStore.getState()
  if (ptyAvailable !== false) {
    commands.push({
      id: 'terminal-toggle',
      category: 'terminal',
      icon: 'TerminalWindow',
      label: terminalMode ? 'Switch to Chat' : 'Open Terminal',
      shortcut: 'Ctrl+`',
    })
    commands.push({
      id: 'terminal-new-tab',
      category: 'terminal',
      icon: 'TerminalWindow',
      label: 'New Terminal Tab',
      shortcut: 'Ctrl+Shift+T',
    })
    if (terminalMode) {
      commands.push({
        id: 'terminal-close-tab',
        category: 'terminal',
        icon: 'X',
        label: 'Close Terminal Tab',
        shortcut: 'Ctrl+Shift+W',
      })
      commands.push({
        id: 'terminal-clear',
        category: 'terminal',
        icon: 'Broom',
        label: 'Clear Terminal',
      })
    }
  }

  return commands
}

// ─── Category labels ───

const CATEGORY_LABELS: Record<string, string> = {
  action: 'Actions',
  tab: 'Tabs',
  model: 'Models',
  theme: 'Theme',
  terminal: 'Terminal',
}

const CATEGORY_ORDER = ['action', 'tab', 'model', 'theme', 'terminal']

function groupByCategory(commands: PaletteCommand[]): Array<{ category: string; label: string; items: PaletteCommand[] }> {
  const map = new Map<string, PaletteCommand[]>()
  for (const cmd of commands) {
    const arr = map.get(cmd.category) ?? []
    arr.push(cmd)
    map.set(cmd.category, arr)
  }
  const groups: Array<{ category: string; label: string; items: PaletteCommand[] }> = []
  for (const cat of CATEGORY_ORDER) {
    const items = map.get(cat)
    if (items && items.length > 0) {
      groups.push({ category: cat, label: CATEGORY_LABELS[cat] ?? cat, items })
    }
  }
  return groups
}

// ─── Component ───

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen)
  const searchQuery = useCommandPaletteStore((s) => s.searchQuery)
  const selectedIndex = useCommandPaletteStore((s) => s.selectedIndex)
  const setSearch = useCommandPaletteStore((s) => s.setSearch)
  const setSelectedIndex = useCommandPaletteStore((s) => s.setSelectedIndex)
  const close = useCommandPaletteStore((s) => s.close)
  const recordExecution = useCommandPaletteStore((s) => s.recordExecution)
  const getFiltered = useCommandPaletteStore((s) => s.getFilteredCommands)
  const getRecent = useCommandPaletteStore((s) => s.getRecentCommands)

  const popoverLayer = usePopoverLayer()
  const colors = useColors()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Build commands fresh each time palette is open
  const allCommands = useMemo(() => (isOpen ? buildCommands() : []), [isOpen])
  const filtered = useMemo(() => getFiltered(allCommands), [allCommands, searchQuery, getFiltered])
  const recentCommands = useMemo(() => getRecent(allCommands), [allCommands, getRecent])

  // Show recents when no search, otherwise show filtered
  const hasSearch = searchQuery.trim().length > 0
  const displayCommands = hasSearch ? filtered : allCommands
  const showRecents = !hasSearch && recentCommands.length > 0

  // Flat list for keyboard navigation (recents + grouped commands)
  const flatList = useMemo(() => {
    const items: PaletteCommand[] = []
    if (showRecents) {
      items.push(...recentCommands)
    }
    items.push(...displayCommands)
    return items
  }, [showRecents, recentCommands, displayCommands])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleExecute = useCallback((cmd: PaletteCommand) => {
    recordExecution(cmd.id)
    close()
    executeCommand(cmd)
  }, [recordExecution, close])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(Math.min(selectedIndex + 1, flatList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(Math.max(selectedIndex - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = flatList[selectedIndex]
      if (cmd) handleExecute(cmd)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }, [selectedIndex, flatList, handleExecute, close, setSelectedIndex])

  if (!isOpen || !popoverLayer) return null

  // Track flat index for rendering
  let flatIndex = -1

  return createPortal(
    <div
      data-clui-ui
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 80,
        pointerEvents: 'auto',
        zIndex: 50,
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)' }}
        onClick={close}
      />

      {/* Palette */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.1 }}
        style={{
          position: 'relative',
          width: 400,
          maxHeight: 420,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          background: colors.popoverBg,
          border: `1px solid ${colors.popoverBorder}`,
          boxShadow: colors.popoverShadow,
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${colors.popoverBorder}` }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: colors.textPrimary,
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          className="overflow-y-auto"
          style={{ flex: 1, padding: '4px 0' }}
        >
          {/* Recent commands section */}
          {showRecents && (
            <>
              <div
                className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.12em] font-medium"
                style={{ color: colors.textTertiary }}
              >
                Recently Used
              </div>
              {recentCommands.map((cmd) => {
                flatIndex++
                const idx = flatIndex
                return (
                  <CommandRow
                    key={`recent-${cmd.id}`}
                    command={cmd}
                    isSelected={selectedIndex === idx}
                    colors={colors}
                    onExecute={handleExecute}
                    onHover={() => setSelectedIndex(idx)}
                    dataSelected={selectedIndex === idx}
                  />
                )
              })}
            </>
          )}

          {/* Grouped commands */}
          {hasSearch ? (
            // Flat filtered list — no grouping
            filtered.length === 0 ? (
              <div
                className="px-3 py-6 text-center text-[12px]"
                style={{ color: colors.textTertiary }}
              >
                No commands found
              </div>
            ) : (
              filtered.map((cmd) => {
                flatIndex++
                const idx = flatIndex
                return (
                  <CommandRow
                    key={cmd.id}
                    command={cmd}
                    isSelected={selectedIndex === idx}
                    colors={colors}
                    onExecute={handleExecute}
                    onHover={() => setSelectedIndex(idx)}
                    dataSelected={selectedIndex === idx}
                  />
                )
              })
            )
          ) : (
            // Grouped by category
            groupByCategory(displayCommands).map((group) => (
              <React.Fragment key={group.category}>
                <div
                  className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.12em] font-medium"
                  style={{ color: colors.textTertiary }}
                >
                  {group.label}
                </div>
                {group.items.map((cmd) => {
                  flatIndex++
                  const idx = flatIndex
                  return (
                    <CommandRow
                      key={cmd.id}
                      command={cmd}
                      isSelected={selectedIndex === idx}
                      colors={colors}
                      onExecute={handleExecute}
                      onHover={() => setSelectedIndex(idx)}
                      dataSelected={selectedIndex === idx}
                    />
                  )
                })}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '6px 14px',
            borderTop: `1px solid ${colors.popoverBorder}`,
            display: 'flex',
            gap: 12,
          }}
        >
          <span className="text-[10px]" style={{ color: colors.textTertiary }}>
            <kbd style={{ opacity: 0.7 }}>↑↓</kbd> navigate
          </span>
          <span className="text-[10px]" style={{ color: colors.textTertiary }}>
            <kbd style={{ opacity: 0.7 }}>↵</kbd> execute
          </span>
          <span className="text-[10px]" style={{ color: colors.textTertiary }}>
            <kbd style={{ opacity: 0.7 }}>esc</kbd> close
          </span>
        </div>
      </motion.div>
    </div>,
    popoverLayer,
  )
}

// ─── Command row ───

interface CommandRowProps {
  command: PaletteCommand
  isSelected: boolean
  colors: ReturnType<typeof useColors>
  onExecute: (cmd: PaletteCommand) => void
  onHover: () => void
  dataSelected: boolean
}

function CommandRow({ command, isSelected, colors, onExecute, onHover, dataSelected }: CommandRowProps) {
  return (
    <button
      data-selected={dataSelected}
      onClick={() => onExecute(command)}
      onMouseEnter={onHover}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
      style={{ background: isSelected ? colors.accentLight : 'transparent' }}
    >
      <span
        className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
        style={{
          background: isSelected ? colors.accentSoft : colors.surfaceHover,
          color: isSelected ? colors.accent : colors.textTertiary,
        }}
      >
        {resolveIcon(command.icon)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[12px] font-medium truncate"
            style={{ color: isSelected ? colors.accent : colors.textPrimary }}
          >
            {command.label}
          </span>
          {command.description && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                color: isSelected ? colors.accent : colors.textTertiary,
                background: isSelected ? colors.accentSoft : colors.surfaceHover,
              }}
            >
              {command.description}
            </span>
          )}
        </div>
      </div>
      {command.shortcut && (
        <span
          className="text-[10px] font-mono flex-shrink-0"
          style={{ color: colors.textTertiary, opacity: 0.7 }}
        >
          {command.shortcut}
        </span>
      )}
    </button>
  )
}
