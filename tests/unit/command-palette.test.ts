import { describe, expect, it } from 'vitest'
import {
  fuzzyScore,
  fuzzyFilter,
  addRecentCommand,
  getRecentCommands,
  MAX_RECENT_COMMANDS,
  type PaletteCommand,
} from '../../src/shared/command-palette'

// ─── Test Data ───

const commands: PaletteCommand[] = [
  { id: 'new-tab', category: 'action', icon: 'Plus', label: 'New Tab' },
  { id: 'history', category: 'action', icon: 'ClockCounterClockwise', label: 'Open History', shortcut: 'Ctrl+H' },
  { id: 'marketplace', category: 'action', icon: 'HeadCircuit', label: 'Marketplace' },
  { id: 'settings', category: 'action', icon: 'GearSix', label: 'Settings' },
  { id: 'export', category: 'action', icon: 'DownloadSimple', label: 'Export Session' },
  { id: 'snippets', category: 'action', icon: 'Lightning', label: 'Manage Snippets' },
  { id: 'tab-1', category: 'tab', icon: 'Browser', label: 'API refactor' },
  { id: 'tab-2', category: 'tab', icon: 'Browser', label: 'Bug fix #342' },
  { id: 'model-opus', category: 'model', icon: 'Cpu', label: 'Switch to Opus 4.6' },
  { id: 'model-sonnet', category: 'model', icon: 'Cpu', label: 'Switch to Sonnet 4.6' },
  { id: 'theme-dark', category: 'theme', icon: 'Moon', label: 'Dark Theme' },
  { id: 'theme-light', category: 'theme', icon: 'Sun', label: 'Light Theme' },
]

// ─── Fuzzy Score ───

describe('fuzzyScore', () => {
  it('returns high score for exact prefix match', () => {
    const score = fuzzyScore('new', 'New Tab')
    expect(score).toBeGreaterThan(0)
  })

  it('returns positive score for substring match', () => {
    const score = fuzzyScore('tab', 'New Tab')
    expect(score).toBeGreaterThan(0)
  })

  it('returns positive score for fuzzy character match', () => {
    const score = fuzzyScore('nt', 'New Tab')
    expect(score).toBeGreaterThan(0)
  })

  it('returns 0 for no match', () => {
    const score = fuzzyScore('xyz', 'New Tab')
    expect(score).toBe(0)
  })

  it('scores exact prefix higher than substring', () => {
    const prefixScore = fuzzyScore('new', 'New Tab')
    const substringScore = fuzzyScore('tab', 'New Tab')
    expect(prefixScore).toBeGreaterThan(substringScore)
  })

  it('scores substring higher than fuzzy character match', () => {
    const substringScore = fuzzyScore('hist', 'Open History')
    const fuzzyCharScore = fuzzyScore('ohst', 'Open History')
    expect(substringScore).toBeGreaterThan(fuzzyCharScore)
  })

  it('is case-insensitive', () => {
    expect(fuzzyScore('NEW', 'New Tab')).toBe(fuzzyScore('new', 'New Tab'))
  })

  it('returns 0 for empty query', () => {
    expect(fuzzyScore('', 'New Tab')).toBe(0)
  })
})

// ─── Fuzzy Filter ───

describe('fuzzyFilter', () => {
  it('returns all commands when query is empty', () => {
    const result = fuzzyFilter(commands, '')
    expect(result).toHaveLength(commands.length)
  })

  it('filters commands by label match', () => {
    const result = fuzzyFilter(commands, 'exp')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].id).toBe('export')
  })

  it('matches against description when provided', () => {
    const cmdsWithDesc: PaletteCommand[] = [
      { id: 'test', category: 'action', icon: 'Plus', label: 'Foo', description: 'Export data' },
    ]
    const result = fuzzyFilter(cmdsWithDesc, 'export')
    expect(result).toHaveLength(1)
  })

  it('returns results sorted by score descending', () => {
    const result = fuzzyFilter(commands, 'tab')
    // 'New Tab' should score higher than 'API refactor' for "tab"
    const ids = result.map((c) => c.id)
    expect(ids.indexOf('new-tab')).toBeLessThan(ids.indexOf('tab-1'))
  })

  it('returns empty array when nothing matches', () => {
    const result = fuzzyFilter(commands, 'zzzzzzz')
    expect(result).toHaveLength(0)
  })

  it('matches by id as fallback', () => {
    const result = fuzzyFilter(commands, 'model-opus')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].id).toBe('model-opus')
  })
})

// ─── Recent Commands ───

describe('recent commands', () => {
  it('adds a command id to recent list', () => {
    const recent = addRecentCommand([], 'new-tab')
    expect(recent).toEqual(['new-tab'])
  })

  it('moves duplicate to front instead of adding twice', () => {
    const recent = addRecentCommand(['history', 'settings'], 'history')
    expect(recent).toEqual(['history', 'settings'])
    expect(recent[0]).toBe('history')
  })

  it('limits to MAX_RECENT_COMMANDS entries', () => {
    let recent: string[] = []
    for (let i = 0; i < MAX_RECENT_COMMANDS + 5; i++) {
      recent = addRecentCommand(recent, `cmd-${i}`)
    }
    expect(recent).toHaveLength(MAX_RECENT_COMMANDS)
  })

  it('most recently added is first', () => {
    let recent: string[] = []
    recent = addRecentCommand(recent, 'a')
    recent = addRecentCommand(recent, 'b')
    recent = addRecentCommand(recent, 'c')
    expect(recent[0]).toBe('c')
  })

  it('getRecentCommands filters out commands that no longer exist', () => {
    const recentIds = ['deleted-cmd', 'new-tab', 'also-gone', 'settings']
    const result = getRecentCommands(recentIds, commands)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('new-tab')
    expect(result[1].id).toBe('settings')
  })

  it('getRecentCommands preserves order', () => {
    const recentIds = ['settings', 'new-tab']
    const result = getRecentCommands(recentIds, commands)
    expect(result[0].id).toBe('settings')
    expect(result[1].id).toBe('new-tab')
  })
})
