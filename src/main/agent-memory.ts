import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import type { AgentAssignment, AgentMemorySnapshot, AgentMemoryClaimResult } from '../shared/types'

interface AgentMemoryFile {
  version: 1
  projects: Record<string, { active: AgentAssignment[]; recentDone: AgentAssignment[] }>
}

interface AssignmentInput {
  tabId: string
  projectPath: string
  agentLabel: string
  summary: string
  workKey?: string
}

const MAX_PROMPT_ACTIVE = 8
const MAX_PROMPT_RECENT = 6
const DEFAULT_MAX_RECENT_DONE = 12
const MAX_SUMMARY_LENGTH = 140

export class AgentMemory {
  private filePath: string
  private maxRecentDone: number

  constructor(filePath: string, maxRecentDone = DEFAULT_MAX_RECENT_DONE) {
    this.filePath = filePath
    this.maxRecentDone = maxRecentDone
  }

  getSnapshot(projectPath: string): AgentMemorySnapshot {
    const state = this.readState()
    const project = this.getProjectState(state, projectPath)
    return this.cloneSnapshot(projectPath, project)
  }

  setFocus(input: AssignmentInput): { snapshot: AgentMemorySnapshot; assignment: AgentAssignment } {
    const state = this.readState()
    const assignment = this.upsertActiveAssignment(state, input)
    this.writeState(state)
    return {
      snapshot: this.cloneSnapshot(input.projectPath, this.getProjectState(state, input.projectPath)),
      assignment: { ...assignment },
    }
  }

  claim(input: AssignmentInput & { workKey: string }): AgentMemoryClaimResult {
    const state = this.readState()
    const project = this.getProjectState(state, input.projectPath)
    const conflict = project.active.find((item) => item.workKey === input.workKey && item.tabId !== input.tabId)

    if (conflict) {
      return {
        ok: false,
        snapshot: this.cloneSnapshot(input.projectPath, project),
        conflict: { ...conflict },
      }
    }

    const assignment = this.upsertActiveAssignment(state, input)
    this.writeState(state)
    return {
      ok: true,
      snapshot: this.cloneSnapshot(input.projectPath, this.getProjectState(state, input.projectPath)),
      assignment: { ...assignment },
    }
  }

  markDone(tabId: string, note?: string): { ok: boolean; snapshot: AgentMemorySnapshot | null; assignment?: AgentAssignment } {
    const state = this.readState()
    const found = this.findActiveAssignment(state, tabId)
    if (!found) {
      return { ok: false, snapshot: null }
    }

    const now = new Date().toISOString()
    const completed: AgentAssignment = {
      ...found.assignment,
      status: 'done',
      updatedAt: now,
      doneAt: now,
      ...(note?.trim() ? { note: note.trim() } : {}),
    }

    found.project.active.splice(found.index, 1)
    found.project.recentDone = [completed, ...found.project.recentDone].slice(0, this.maxRecentDone)
    this.writeState(state)

    return {
      ok: true,
      snapshot: this.cloneSnapshot(found.projectPath, found.project),
      assignment: completed,
    }
  }

  release(tabId: string): { ok: boolean; snapshots: AgentMemorySnapshot[] } {
    const state = this.readState()
    const touchedProjects: string[] = []

    for (const [projectPath, project] of Object.entries(state.projects)) {
      const before = project.active.length
      project.active = project.active.filter((assignment) => assignment.tabId !== tabId)
      if (project.active.length !== before) {
        touchedProjects.push(projectPath)
      }
    }

    if (touchedProjects.length === 0) {
      return { ok: false, snapshots: [] }
    }

    this.writeState(state)

    return {
      ok: true,
      snapshots: touchedProjects.map((projectPath) =>
        this.cloneSnapshot(projectPath, this.getProjectState(state, projectPath))
      ),
    }
  }

  pruneProject(projectPath: string): AgentMemorySnapshot {
    const state = this.readState()
    const project = this.getProjectState(state, projectPath)
    project.recentDone = project.recentDone.slice(0, this.maxRecentDone)
    this.writeState(state)
    return this.cloneSnapshot(projectPath, project)
  }

  pruneStaleTabs(liveTabIds: Iterable<string>): void {
    const live = new Set(liveTabIds)
    const state = this.readState()
    let changed = false

    for (const project of Object.values(state.projects)) {
      const before = project.active.length
      project.active = project.active.filter((assignment) => live.has(assignment.tabId))
      if (project.active.length !== before) {
        changed = true
      }
      if (project.recentDone.length > this.maxRecentDone) {
        project.recentDone = project.recentDone.slice(0, this.maxRecentDone)
        changed = true
      }
    }

    if (changed) {
      this.writeState(state)
    }
  }

  buildPromptContext(projectPath: string, currentTabId: string): string {
    const snapshot = this.getSnapshot(projectPath)
    const current = snapshot.active.find((item) => item.tabId === currentTabId)
    const otherActive = snapshot.active
      .filter((item) => item.tabId !== currentTabId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_PROMPT_ACTIVE)
    const recentDone = snapshot.recentDone
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_PROMPT_RECENT)

    if (!current && otherActive.length === 0 && recentDone.length === 0) {
      return ''
    }

    const lines: string[] = ['Shared agent memory for this project:']

    if (current) {
      lines.push(`Current assignment: ${formatAssignment(current)}`)
    }

    if (otherActive.length > 0) {
      lines.push('Other active work:')
      for (const assignment of otherActive) {
        lines.push(`- ${formatAssignment(assignment)}`)
      }
    }

    if (recentDone.length > 0) {
      lines.push('Recent completed work:')
      for (const assignment of recentDone) {
        lines.push(`- ${formatDoneAssignment(assignment)}`)
      }
    }

    return lines.join('\n')
  }

  private upsertActiveAssignment(state: AgentMemoryFile, input: AssignmentInput): AgentAssignment {
    const now = new Date().toISOString()
    const project = this.getProjectState(state, input.projectPath)
    const previous = this.findActiveAssignment(state, input.tabId)?.assignment

    this.removeActiveAssignmentsForTab(state, input.tabId)

    const assignment: AgentAssignment = {
      tabId: input.tabId,
      agentLabel: sanitizeText(input.agentLabel, 48) || `Tab ${input.tabId.slice(0, 8)}`,
      projectPath: input.projectPath,
      ...(input.workKey ? { workKey: sanitizeText(input.workKey, 80) } : {}),
      summary: sanitizeText(input.summary, MAX_SUMMARY_LENGTH),
      status: 'active',
      startedAt: previous?.startedAt ?? now,
      updatedAt: now,
    }

    project.active = [assignment, ...project.active]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return assignment
  }

  private findActiveAssignment(state: AgentMemoryFile, tabId: string): {
    projectPath: string
    project: { active: AgentAssignment[]; recentDone: AgentAssignment[] }
    assignment: AgentAssignment
    index: number
  } | null {
    for (const [projectPath, project] of Object.entries(state.projects)) {
      const index = project.active.findIndex((assignment) => assignment.tabId === tabId)
      if (index !== -1) {
        return {
          projectPath,
          project,
          assignment: project.active[index],
          index,
        }
      }
    }

    return null
  }

  private removeActiveAssignmentsForTab(state: AgentMemoryFile, tabId: string): void {
    for (const project of Object.values(state.projects)) {
      project.active = project.active.filter((assignment) => assignment.tabId !== tabId)
    }
  }

  private readState(): AgentMemoryFile {
    try {
      if (!existsSync(this.filePath)) {
        return defaultState()
      }

      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      const projects: AgentMemoryFile['projects'] = {}

      if (parsed?.projects && typeof parsed.projects === 'object') {
        for (const [projectPath, value] of Object.entries(parsed.projects as Record<string, any>)) {
          projects[projectPath] = {
            active: normalizeAssignments(value?.active, projectPath, 'active'),
            recentDone: normalizeAssignments(value?.recentDone, projectPath, 'done').slice(0, this.maxRecentDone),
          }
        }
      }

      return { version: 1, projects }
    } catch {
      return defaultState()
    }
  }

  private writeState(state: AgentMemoryFile): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8')
  }

  private getProjectState(state: AgentMemoryFile, projectPath: string): { active: AgentAssignment[]; recentDone: AgentAssignment[] } {
    if (!state.projects[projectPath]) {
      state.projects[projectPath] = { active: [], recentDone: [] }
    }

    return state.projects[projectPath]
  }

  private cloneSnapshot(projectPath: string, project: { active: AgentAssignment[]; recentDone: AgentAssignment[] }): AgentMemorySnapshot {
    return {
      projectPath,
      active: project.active.map((assignment) => ({ ...assignment })),
      recentDone: project.recentDone.map((assignment) => ({ ...assignment })),
    }
  }
}

function defaultState(): AgentMemoryFile {
  return {
    version: 1,
    projects: {},
  }
}

function normalizeAssignments(value: unknown, projectPath: string, fallbackStatus: 'active' | 'done'): AgentAssignment[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }

    const raw = entry as Partial<AgentAssignment>
    if (typeof raw.tabId !== 'string' || typeof raw.summary !== 'string') {
      return []
    }

    const startedAt = typeof raw.startedAt === 'string' ? raw.startedAt : new Date().toISOString()
    const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : startedAt
    const status = raw.status === 'active' || raw.status === 'done' ? raw.status : fallbackStatus

    return [{
      tabId: raw.tabId,
      agentLabel: typeof raw.agentLabel === 'string' && raw.agentLabel.trim().length > 0
        ? sanitizeText(raw.agentLabel, 48)
        : `Tab ${raw.tabId.slice(0, 8)}`,
      projectPath,
      ...(typeof raw.workKey === 'string' && raw.workKey.trim().length > 0
        ? { workKey: sanitizeText(raw.workKey, 80) }
        : {}),
      summary: sanitizeText(raw.summary, MAX_SUMMARY_LENGTH),
      status,
      startedAt,
      updatedAt,
      ...(typeof raw.doneAt === 'string' ? { doneAt: raw.doneAt } : {}),
      ...(typeof raw.note === 'string' && raw.note.trim().length > 0
        ? { note: sanitizeText(raw.note, MAX_SUMMARY_LENGTH) }
        : {}),
    }]
  })
}

function sanitizeText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function formatAssignment(assignment: AgentAssignment): string {
  const prefix = assignment.workKey
    ? `${assignment.workKey} -> ${assignment.agentLabel}`
    : assignment.agentLabel
  return `${prefix}: ${assignment.summary}`
}

function formatDoneAssignment(assignment: AgentAssignment): string {
  const base = formatAssignment(assignment)
  if (!assignment.note) {
    return base
  }
  return `${base} (${assignment.note})`
}
