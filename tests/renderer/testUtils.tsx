import React from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { PopoverLayerProvider } from '../../src/renderer/components/PopoverLayer'
import { useCommandPaletteStore } from '../../src/renderer/stores/commandPaletteStore'
import { useComparisonStore } from '../../src/renderer/stores/comparisonStore'
import { useExportStore } from '../../src/renderer/stores/exportStore'
import { useNotificationStore } from '../../src/renderer/stores/notificationStore'
import { useSessionStore } from '../../src/renderer/stores/sessionStore'
import { useShortcutStore } from '../../src/renderer/stores/shortcutStore'
import { useSnippetStore } from '../../src/renderer/stores/snippetStore'
import { useTabGroupStore } from '../../src/renderer/stores/tabGroupStore'
import { useWorkflowStore, type Workflow } from '../../src/renderer/stores/workflowStore'
import { useThemeStore } from '../../src/renderer/theme'
import type { CostSummary, Message, TabState } from '../../src/shared/types'

type ResettableStore = {
  getInitialState: () => unknown
  setState: (state: unknown, replace?: boolean) => void
}

function resetStore(store: ResettableStore) {
  store.setState(store.getInitialState(), true)
}

const stores: ResettableStore[] = [
  useThemeStore,
  useSessionStore,
  useCommandPaletteStore,
  useComparisonStore,
  useExportStore,
  useNotificationStore,
  useShortcutStore,
  useSnippetStore,
  useTabGroupStore,
  useWorkflowStore,
]

export function makeMessage(overrides: Partial<Message> & Pick<Message, 'role' | 'content'>): Message {
  return {
    id: overrides.id || crypto.randomUUID(),
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  }
}

export function makeTab(overrides: Partial<TabState> = {}): TabState {
  return {
    id: overrides.id || crypto.randomUUID(),
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
    title: 'Test Tab',
    lastResult: null,
    sessionModel: null,
    sessionTools: [],
    sessionMcpServers: [],
    sessionSkills: [],
    sessionVersion: null,
    queuedPrompts: [],
    workingDirectory: 'C:/repo',
    hasChosenDirectory: true,
    additionalDirs: [],
    ...overrides,
  }
}

export function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  const now = Date.now()
  return {
    id: overrides.id || crypto.randomUUID(),
    name: overrides.name || 'Workflow',
    steps: overrides.steps || [
      { id: crypto.randomUUID(), prompt: 'First step', order: 0 },
      { id: crypto.randomUUID(), prompt: 'Second step', order: 1 },
    ],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

export function makeCostSummary(overrides: Partial<CostSummary> = {}): CostSummary {
  return {
    totalCostUsd: 0,
    totalDurationMs: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
    runCount: 0,
    byDay: [],
    byModel: {},
    byProject: {},
    ...overrides,
  }
}

export function installCluiMock(overrides: Partial<typeof window.clui> = {}) {
  const base = {
    onWindowShown: vi.fn(() => () => {}),
    hideWindow: vi.fn(),
    openExternal: vi.fn().mockResolvedValue(true),
    getCostSummary: vi.fn().mockResolvedValue(makeCostSummary()),
    getPermissions: vi.fn().mockResolvedValue({ allow: [], deny: [] }),
    addPermission: vi.fn().mockResolvedValue(undefined),
    removePermission: vi.fn().mockResolvedValue(undefined),
    applyPermissionPreset: vi.fn().mockResolvedValue(undefined),
    setPermissionMode: vi.fn(),
    respondPermission: vi.fn().mockResolvedValue(true),
    createTab: vi.fn().mockResolvedValue({ tabId: 'new-tab-id' }),
    listSessionHistory: vi.fn().mockResolvedValue([]),
    prompt: vi.fn().mockResolvedValue(undefined),
    stopTab: vi.fn().mockResolvedValue(undefined),
    resetTabSession: vi.fn(),
    getAutoAttachConfig: vi.fn().mockResolvedValue({ config: { projectPath: 'C:/repo', files: [] }, attachments: [], warnings: [] }),
    pasteImage: vi.fn().mockResolvedValue(null),
    getTheme: vi.fn().mockResolvedValue({ isDark: true }),
    onThemeChange: vi.fn(() => () => {}),
    transcribeAudio: vi.fn().mockResolvedValue('transcribed'),
    isVisible: vi.fn().mockResolvedValue(true),
  }

  window.clui = {
    ...base,
    ...overrides,
  } as typeof window.clui

  return window.clui
}

export function resetTestState() {
  localStorage.clear()
  for (const store of stores) {
    resetStore(store)
  }
  installCluiMock()
}

export function renderWithProviders(ui: React.ReactElement) {
  return render(<PopoverLayerProvider>{ui}</PopoverLayerProvider>)
}
