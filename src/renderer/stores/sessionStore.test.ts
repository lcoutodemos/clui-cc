import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadLastSession, useSessionStore } from './sessionStore'
import { useThemeStore } from '../theme'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetStore() {
  const homeDir = '/home/user'
  useSessionStore.setState({
    tabs: [{
      id: 'tab-1',
      claudeSessionId: null,
      status: 'idle',
      activeRequestId: null,
      hasUnread: false,
      currentActivity: '',
      permissionQueue: [],
      permissionDenied: null,
      attachments: [],
      messages: [],
      title: 'New Tab',
      lastResult: null,
      sessionModel: null,
      sessionTools: [],
      sessionMcpServers: [],
      sessionSkills: [],
      sessionVersion: null,
      queuedPrompts: [],
      workingDirectory: homeDir,
      hasChosenDirectory: false,
      additionalDirs: [],
    }],
    activeTabId: 'tab-1',
    isExpanded: false,
    staticInfo: { version: '1.0', email: null, subscriptionType: null, projectPath: homeDir, homePath: homeDir },
    preferredModel: null,
    permissionMode: 'ask',
  })
}

// ─── Last-session persistence ─────────────────────────────────────────────────

describe('loadLastSession', () => {
  it('returns null when localStorage is empty', () => {
    expect(loadLastSession()).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    localStorage.setItem('clui-last-session', 'not-json')
    expect(loadLastSession()).toBeNull()
  })

  it('returns null when folder field is missing', () => {
    localStorage.setItem('clui-last-session', JSON.stringify({ other: 'value' }))
    expect(loadLastSession()).toBeNull()
  })

  it('returns null when folder is not a string', () => {
    localStorage.setItem('clui-last-session', JSON.stringify({ folder: 42 }))
    expect(loadLastSession()).toBeNull()
  })

  it('returns the folder when data is valid', () => {
    localStorage.setItem('clui-last-session', JSON.stringify({ folder: '/projects/myapp' }))
    expect(loadLastSession()).toEqual({ folder: '/projects/myapp' })
  })
})

// ─── setBaseDirectory ─────────────────────────────────────────────────────────

describe('setBaseDirectory', () => {
  beforeEach(resetStore)

  it('updates workingDirectory and hasChosenDirectory on the active tab', () => {
    useSessionStore.getState().setBaseDirectory('/new/path')
    const tab = useSessionStore.getState().tabs[0]
    expect(tab.workingDirectory).toBe('/new/path')
    expect(tab.hasChosenDirectory).toBe(true)
  })

  it('clears claudeSessionId and additionalDirs', () => {
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) => ({ ...t, claudeSessionId: 'old-session', additionalDirs: ['/extra'] })),
    }))
    useSessionStore.getState().setBaseDirectory('/new/path')
    const tab = useSessionStore.getState().tabs[0]
    expect(tab.claudeSessionId).toBeNull()
    expect(tab.additionalDirs).toEqual([])
  })

  it('persists the folder to localStorage', () => {
    useSessionStore.getState().setBaseDirectory('/saved/dir')
    const stored = JSON.parse(localStorage.getItem('clui-last-session')!)
    expect(stored.folder).toBe('/saved/dir')
  })

  it('calls resetTabSession on the main process', () => {
    useSessionStore.getState().setBaseDirectory('/any/path')
    expect(window.clui.resetTabSession).toHaveBeenCalledWith('tab-1')
  })
})

// ─── restoreLastSession ────────────────────────────────────────────────────────

describe('restoreLastSession', () => {
  beforeEach(() => {
    resetStore()
    useThemeStore.setState({ useLastFolder: true })
  })

  it('does nothing when useLastFolder is false', async () => {
    useThemeStore.setState({ useLastFolder: false })
    localStorage.setItem('clui-last-session', JSON.stringify({ folder: '/saved' }))
    await useSessionStore.getState().restoreLastSession('tab-1')
    expect(useSessionStore.getState().tabs[0].workingDirectory).toBe('/home/user')
  })

  it('does nothing when localStorage has no saved session', async () => {
    await useSessionStore.getState().restoreLastSession('tab-1')
    expect(useSessionStore.getState().tabs[0].workingDirectory).toBe('/home/user')
    expect(useSessionStore.getState().tabs[0].hasChosenDirectory).toBe(false)
  })

  it('restores the folder from localStorage', async () => {
    localStorage.setItem('clui-last-session', JSON.stringify({ folder: '/restored/project' }))
    await useSessionStore.getState().restoreLastSession('tab-1')
    const tab = useSessionStore.getState().tabs[0]
    expect(tab.workingDirectory).toBe('/restored/project')
    expect(tab.hasChosenDirectory).toBe(true)
  })

  it('only updates the target tab, not others', async () => {
    useSessionStore.setState((s) => ({
      tabs: [
        ...s.tabs,
        { ...s.tabs[0], id: 'tab-2', workingDirectory: '/other' },
      ],
    }))
    localStorage.setItem('clui-last-session', JSON.stringify({ folder: '/restored' }))
    await useSessionStore.getState().restoreLastSession('tab-1')
    const tab2 = useSessionStore.getState().tabs.find((t) => t.id === 'tab-2')!
    expect(tab2.workingDirectory).toBe('/other')
  })
})

// ─── handleNormalizedEvent — text streaming ───────────────────────────────────

describe('handleNormalizedEvent: text_chunk', () => {
  beforeEach(resetStore)

  it('appends a new assistant message for the first chunk', () => {
    useSessionStore.getState().handleNormalizedEvent('tab-1', { type: 'text_chunk', text: 'Hello' })
    const msgs = useSessionStore.getState().tabs[0].messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({ role: 'assistant', content: 'Hello' })
  })

  it('concatenates subsequent chunks onto the last assistant message', () => {
    useSessionStore.getState().handleNormalizedEvent('tab-1', { type: 'text_chunk', text: 'Hello' })
    useSessionStore.getState().handleNormalizedEvent('tab-1', { type: 'text_chunk', text: ' world' })
    const msgs = useSessionStore.getState().tabs[0].messages
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('Hello world')
  })

  it('starts a new message after a tool call', () => {
    useSessionStore.getState().handleNormalizedEvent('tab-1', { type: 'text_chunk', text: 'Before' })
    // Simulate a tool message in between
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) => ({
        ...t,
        messages: [...t.messages, { id: 'tool-1', role: 'tool' as const, content: '', toolName: 'Bash', toolStatus: 'running' as const, timestamp: Date.now() }],
      })),
    }))
    useSessionStore.getState().handleNormalizedEvent('tab-1', { type: 'text_chunk', text: 'After' })
    const msgs = useSessionStore.getState().tabs[0].messages
    expect(msgs).toHaveLength(3)
    expect(msgs[2]).toMatchObject({ role: 'assistant', content: 'After' })
  })
})

// ─── handleNormalizedEvent — task_complete ────────────────────────────────────

describe('handleNormalizedEvent: task_complete', () => {
  beforeEach(resetStore)

  it('sets status to completed and stores lastResult', () => {
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) => ({ ...t, status: 'running' as const })),
    }))
    useSessionStore.getState().handleNormalizedEvent('tab-1', {
      type: 'task_complete',
      result: 'All done',
      costUsd: 0.005,
      durationMs: 2000,
      numTurns: 3,
      usage: {},
      sessionId: 'sess-abc',
    })
    const tab = useSessionStore.getState().tabs[0]
    expect(tab.status).toBe('completed')
    expect(tab.lastResult?.totalCostUsd).toBe(0.005)
    expect(tab.lastResult?.sessionId).toBe('sess-abc')
    expect(tab.activeRequestId).toBeNull()
    expect(tab.permissionQueue).toEqual([])
  })

  it('marks hasUnread when the tab is not the active expanded tab', () => {
    useSessionStore.setState({ isExpanded: false })
    useSessionStore.getState().handleNormalizedEvent('tab-1', {
      type: 'task_complete',
      result: '',
      costUsd: 0,
      durationMs: 0,
      numTurns: 1,
      usage: {},
      sessionId: 'sess-x',
    })
    expect(useSessionStore.getState().tabs[0].hasUnread).toBe(true)
  })
})

// ─── handleNormalizedEvent — session_init ─────────────────────────────────────

describe('handleNormalizedEvent: session_init', () => {
  beforeEach(resetStore)

  it('stores sessionId and model on the tab', () => {
    useSessionStore.getState().handleNormalizedEvent('tab-1', {
      type: 'session_init',
      sessionId: 'new-sess-1',
      tools: ['Bash'],
      model: 'claude-sonnet-4-6',
      mcpServers: [],
      skills: [],
      version: '1.0',
    })
    const tab = useSessionStore.getState().tabs[0]
    expect(tab.claudeSessionId).toBe('new-sess-1')
    expect(tab.sessionModel).toBe('claude-sonnet-4-6')
  })

  it('does not change status for warmup inits', () => {
    useSessionStore.setState((s) => ({
      tabs: s.tabs.map((t) => ({ ...t, status: 'connecting' as const })),
    }))
    useSessionStore.getState().handleNormalizedEvent('tab-1', {
      type: 'session_init',
      sessionId: 'warmup-sess',
      tools: [],
      model: 'claude-sonnet-4-6',
      mcpServers: [],
      skills: [],
      version: '1.0',
      isWarmup: true,
    })
    expect(useSessionStore.getState().tabs[0].status).toBe('connecting')
  })
})

// ─── addDirectory / removeDirectory ──────────────────────────────────────────

describe('addDirectory / removeDirectory', () => {
  beforeEach(resetStore)

  it('adds a directory without duplicates', () => {
    useSessionStore.getState().addDirectory('/extra/dir')
    useSessionStore.getState().addDirectory('/extra/dir')
    expect(useSessionStore.getState().tabs[0].additionalDirs).toEqual(['/extra/dir'])
  })

  it('removes a directory', () => {
    useSessionStore.getState().addDirectory('/a')
    useSessionStore.getState().addDirectory('/b')
    useSessionStore.getState().removeDirectory('/a')
    expect(useSessionStore.getState().tabs[0].additionalDirs).toEqual(['/b'])
  })
})
