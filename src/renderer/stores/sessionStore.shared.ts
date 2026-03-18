import type { TabState } from '../../shared/types'

export interface StaticInfo {
  version: string
  email: string | null
  subscriptionType: string | null
  projectPath: string
  homePath: string
}

export function getResolvedProjectPath(
  tab: TabState | undefined,
  staticInfo: Pick<StaticInfo, 'homePath'> | null,
): string {
  if (!tab) {
    return staticInfo?.homePath || '~'
  }

  return tab.hasChosenDirectory
    ? tab.workingDirectory
    : (staticInfo?.homePath || tab.workingDirectory || '~')
}

export function getAgentLabel(tabId: string, tabs: TabState[]): string {
  const index = tabs.findIndex((tab) => tab.id === tabId)
  return index === -1 ? `Tab ${tabId.slice(0, 8)}` : `Tab ${index + 1}`
}

export function inferFocusSummary(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 120) {
    return normalized
  }
  return `${normalized.slice(0, 119).trimEnd()}…`
}

export function makeLocalTab(): TabState {
  return {
    id: crypto.randomUUID(),
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
    title: 'New Tab',
    lastResult: null,
    sessionModel: null,
    sessionTools: [],
    sessionMcpServers: [],
    sessionSkills: [],
    sessionVersion: null,
    queuedPrompts: [],
    workingDirectory: '~',
    hasChosenDirectory: false,
    additionalDirs: [],
  }
}
