import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdirSync, rmSync } from 'fs'
import { AgentMemory } from '../../src/main/agent-memory'

describe('AgentMemory', () => {
  const testDir = join(tmpdir(), `clui-agent-memory-${Date.now()}`)
  const filePath = join(testDir, 'agent-memory.json')
  let memory: AgentMemory

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
    memory = new AgentMemory(filePath, 3)
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('persists focus assignments per project', () => {
    memory.setFocus({
      tabId: 'tab-1',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 1',
      summary: 'Investigate CI failure',
    })

    const reloaded = new AgentMemory(filePath, 3)
    const snapshot = reloaded.getSnapshot('C:/repo')

    expect(snapshot.active).toHaveLength(1)
    expect(snapshot.active[0].summary).toBe('Investigate CI failure')
    expect(snapshot.active[0].agentLabel).toBe('Tab 1')
  })

  it('rejects a duplicate workKey claim in the same project', () => {
    const first = memory.claim({
      tabId: 'tab-1',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 1',
      workKey: 'github#123',
      summary: 'Fix permissions flow',
    })

    const second = memory.claim({
      tabId: 'tab-2',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 2',
      workKey: 'github#123',
      summary: 'Implement same issue',
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.conflict.tabId).toBe('tab-1')
      expect(second.conflict.summary).toBe('Fix permissions flow')
    }
  })

  it('allows the same workKey in different projects', () => {
    memory.claim({
      tabId: 'tab-1',
      projectPath: 'C:/repo-a',
      agentLabel: 'Tab 1',
      workKey: 'github#123',
      summary: 'Repo A issue',
    })

    const result = memory.claim({
      tabId: 'tab-2',
      projectPath: 'C:/repo-b',
      agentLabel: 'Tab 2',
      workKey: 'github#123',
      summary: 'Repo B issue',
    })

    expect(result.ok).toBe(true)
  })

  it('moves the active assignment into recentDone when marked done', () => {
    memory.claim({
      tabId: 'tab-1',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 1',
      workKey: 'github#321',
      summary: 'Ship retry banner',
    })

    const result = memory.markDone('tab-1', 'PR opened')

    expect(result.ok).toBe(true)
    expect(result.snapshot?.active).toHaveLength(0)
    expect(result.snapshot?.recentDone).toHaveLength(1)
    expect(result.snapshot?.recentDone[0].status).toBe('done')
    expect(result.snapshot?.recentDone[0].note).toBe('PR opened')
  })

  it('releases active assignments for a tab without marking them done', () => {
    memory.setFocus({
      tabId: 'tab-1',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 1',
      summary: 'Explore notification UX',
    })

    const result = memory.release('tab-1')
    const snapshot = memory.getSnapshot('C:/repo')

    expect(result.ok).toBe(true)
    expect(snapshot.active).toHaveLength(0)
    expect(snapshot.recentDone).toHaveLength(0)
  })

  it('prunes stale active assignments using the live tab set', () => {
    memory.setFocus({
      tabId: 'tab-live',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 1',
      summary: 'Keep this one',
    })
    memory.setFocus({
      tabId: 'tab-stale',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 2',
      summary: 'Remove this one',
    })

    memory.pruneStaleTabs(['tab-live'])

    const snapshot = memory.getSnapshot('C:/repo')
    expect(snapshot.active).toHaveLength(1)
    expect(snapshot.active[0].tabId).toBe('tab-live')
  })

  it('builds a compact prompt context with current, active, and recent work', () => {
    memory.claim({
      tabId: 'tab-1',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 1',
      workKey: 'github#10',
      summary: 'Implement memory persistence',
    })
    memory.claim({
      tabId: 'tab-2',
      projectPath: 'C:/repo',
      agentLabel: 'Tab 2',
      workKey: 'github#11',
      summary: 'Fix retry UX',
    })
    memory.markDone('tab-2', 'Merged')

    const prompt = memory.buildPromptContext('C:/repo', 'tab-1')

    expect(prompt).toContain('Shared agent memory for this project:')
    expect(prompt).toContain('Current assignment:')
    expect(prompt).toContain('github#10 -> Tab 1: Implement memory persistence')
    expect(prompt).toContain('Recent completed work:')
    expect(prompt).toContain('github#11 -> Tab 2: Fix retry UX (Merged)')
  })
})
