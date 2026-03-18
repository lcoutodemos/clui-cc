import { describe, expect, it, vi } from 'vitest'
import type { AgentMemorySnapshot, TabState } from '../../src/shared/types'
import { applyAgentMemorySnapshotToTabs, createAgentMemoryStore } from '../../src/renderer/stores/agentMemoryStore'

function makeTab(id: string, workingDirectory: string): TabState {
  return {
    id,
    claudeSessionId: null,
    status: 'idle',
    activeRequestId: null,
    hasUnread: false,
    currentActivity: '',
    permissionQueue: [],
    permissionDenied: null,
    retryState: null,
    agentAssignment: null,
    lastRunOptions: null,
    queuedRunOptions: [],
    attachments: [],
    messages: [],
    title: id,
    lastResult: null,
    sessionModel: null,
    sessionTools: [],
    sessionMcpServers: [],
    sessionSkills: [],
    sessionVersion: null,
    queuedPrompts: [],
    workingDirectory,
    hasChosenDirectory: true,
    additionalDirs: [],
  }
}

const snapshot: AgentMemorySnapshot = {
  projectPath: '/repo',
  active: [
    {
      tabId: 'tab-1',
      agentLabel: 'Tab 1',
      projectPath: '/repo',
      workKey: 'issue-74',
      summary: 'Split session store',
      status: 'active',
      startedAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
    },
  ],
  recentDone: [],
}

describe('agentMemoryStore', () => {
  it('applies a snapshot only to tabs that belong to the same project', () => {
    const tabs = applyAgentMemorySnapshotToTabs(
      [makeTab('tab-1', '/repo'), makeTab('tab-2', '/other')],
      snapshot,
      { homePath: '/home' },
    )

    expect(tabs[0].agentAssignment?.summary).toBe('Split session store')
    expect(tabs[1].agentAssignment).toBeNull()
  })

  it('refreshes memory through injected dependencies and updates shared tab state', async () => {
    let tabs = [makeTab('tab-1', '/repo')]
    const agentMemoryGet = vi.fn().mockResolvedValue(snapshot)
    const store = createAgentMemoryStore({
      agentMemoryGet,
      agentMemoryFocus: vi.fn(),
      agentMemoryClaim: vi.fn(),
      agentMemoryDone: vi.fn(),
      agentMemoryRelease: vi.fn(),
      getContext: () => ({
        activeTabId: 'tab-1',
        tabs,
        staticInfo: { homePath: '/home' },
      }),
      commitSnapshot: (nextSnapshot, updater) => {
        tabs = updater(tabs, { homePath: '/home' })
        store.setState({ snapshot: nextSnapshot })
      },
    })

    const result = await store.getState().refreshAgentMemory('/repo')

    expect(agentMemoryGet).toHaveBeenCalledWith('/repo')
    expect(result).toEqual(snapshot)
    expect(store.getState().snapshot).toEqual(snapshot)
    expect(tabs[0].agentAssignment?.workKey).toBe('issue-74')
  })
})
