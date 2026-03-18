import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSessionState = vi.hoisted(() => ({
  tabs: [] as Array<{ sessionSkills?: string[] }>,
}))

vi.mock('../../src/renderer/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => ({ tabs: mockSessionState.tabs }),
  },
}))

class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

async function loadSnippetStore() {
  return import('../../src/renderer/stores/snippetStore')
}

describe('snippetStore', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    vi.resetModules()
    mockSessionState.tabs = []
    storage = new MemoryStorage()
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage')
    mockSessionState.tabs = []
  })

  it('adds snippets and persists them to localStorage', async () => {
    const { useSnippetStore } = await loadSnippetStore()

    const created = useSnippetStore.getState().addSnippet('Code Review', 'review', 'Review this code for bugs.')

    expect(created).not.toBeNull()
    expect(created?.command).toBe('/review')
    expect(useSnippetStore.getState().snippets).toHaveLength(1)

    const persisted = JSON.parse(storage.getItem('clui-snippets') || '[]')
    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toMatchObject({
      name: 'Code Review',
      command: '/review',
      content: 'Review this code for bugs.',
    })
  })

  it('loads persisted snippets on initialization', async () => {
    storage.setItem('clui-snippets', JSON.stringify([{
      id: 'snippet-1',
      name: 'Explain',
      command: 'explain',
      content: 'Explain this file in plain English.',
      createdAt: 10,
      updatedAt: 20,
    }]))

    const { useSnippetStore } = await loadSnippetStore()

    expect(useSnippetStore.getState().snippets).toEqual([{
      id: 'snippet-1',
      name: 'Explain',
      command: '/explain',
      content: 'Explain this file in plain English.',
      createdAt: 10,
      updatedAt: 20,
    }])
  })

  it('rejects built-in, duplicate, and skill-colliding commands', async () => {
    mockSessionState.tabs = [{ sessionSkills: ['review'] }]
    const { useSnippetStore } = await loadSnippetStore()

    expect(useSnippetStore.getState().addSnippet('Help', 'help', 'Show commands.')).toBeNull()
    expect(useSnippetStore.getState().addSnippet('Skill Review', 'review', 'Run the review skill.')).toBeNull()

    const created = useSnippetStore.getState().addSnippet('Tests', 'tests', 'Generate tests for this file.')
    expect(created).not.toBeNull()
    expect(useSnippetStore.getState().addSnippet('Duplicate', '/tests', 'Something else.')).toBeNull()
  })

  it('updates and deletes snippets', async () => {
    const { useSnippetStore } = await loadSnippetStore()
    const created = useSnippetStore.getState().addSnippet('Explain', 'explain', 'Explain this change.')
    expect(created).not.toBeNull()

    const updated = useSnippetStore.getState().updateSnippet(created!.id, {
      name: 'Generate Tests',
      command: 'tests',
      content: 'Write unit tests for this code.',
    })

    expect(updated).toBe(true)
    expect(useSnippetStore.getState().snippets[0]).toMatchObject({
      id: created!.id,
      name: 'Generate Tests',
      command: '/tests',
      content: 'Write unit tests for this code.',
    })

    useSnippetStore.getState().deleteSnippet(created!.id)
    expect(useSnippetStore.getState().snippets).toEqual([])
    expect(storage.getItem('clui-snippets')).toBe('[]')
  })
})
