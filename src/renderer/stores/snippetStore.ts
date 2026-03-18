import { create } from 'zustand'
import { useSessionStore } from './sessionStore'

export interface Snippet {
  id: string
  name: string
  command: string
  content: string
  createdAt: number
  updatedAt: number
}

interface SnippetState {
  snippets: Snippet[]
  managerOpen: boolean
  addSnippet: (name: string, command: string, content: string) => Snippet | null
  updateSnippet: (id: string, updates: Partial<Pick<Snippet, 'name' | 'command' | 'content'>>) => boolean
  deleteSnippet: (id: string) => void
  openManager: () => void
  closeManager: () => void
}

const STORAGE_KEY = 'clui-snippets'
const BUILT_IN_COMMANDS = new Set([
  '/clear',
  '/focus',
  '/claim',
  '/done',
  '/release',
  '/memory',
  '/export',
  '/cost',
  '/model',
  '/mcp',
  '/skills',
  '/workflow',
  '/help',
])

function loadSnippets(): Snippet[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const rawSnippet = entry as Partial<Snippet>
      if (typeof rawSnippet.id !== 'string' || typeof rawSnippet.name !== 'string' || typeof rawSnippet.command !== 'string' || typeof rawSnippet.content !== 'string') {
        return []
      }
      return [{
        id: rawSnippet.id,
        name: rawSnippet.name.trim(),
        command: normalizeCommand(rawSnippet.command),
        content: rawSnippet.content,
        createdAt: typeof rawSnippet.createdAt === 'number' ? rawSnippet.createdAt : Date.now(),
        updatedAt: typeof rawSnippet.updatedAt === 'number' ? rawSnippet.updatedAt : Date.now(),
      }]
    })
  } catch {
    return []
  }
}

function saveSnippets(snippets: Snippet[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets))
  } catch {}
}

function normalizeCommand(command: string): string {
  const trimmed = command.trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function isValidCommand(command: string): boolean {
  return /^\/[a-zA-Z0-9-]+$/.test(command)
}

function collides(command: string, snippets: Snippet[], currentId?: string): boolean {
  if (BUILT_IN_COMMANDS.has(command)) {
    return true
  }
  const skillCommands = new Set(
    useSessionStore.getState().tabs.flatMap((tab) =>
      (tab.sessionSkills || []).map((skill) => `/${skill}`.toLowerCase()),
    ),
  )
  if (skillCommands.has(command.toLowerCase())) {
    return true
  }
  return snippets.some((snippet) => snippet.command === command && snippet.id !== currentId)
}

const initialSnippets = loadSnippets()

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: initialSnippets,
  managerOpen: false,

  addSnippet: (name, command, content) => {
    const nextCommand = normalizeCommand(command)
    const nextName = name.trim()
    const nextContent = content.trim()
    if (!nextName || !nextContent || !isValidCommand(nextCommand) || collides(nextCommand, get().snippets)) {
      return null
    }

    const snippet: Snippet = {
      id: crypto.randomUUID(),
      name: nextName,
      command: nextCommand,
      content: nextContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const snippets = [...get().snippets, snippet].sort((a, b) => b.updatedAt - a.updatedAt)
    saveSnippets(snippets)
    set({ snippets })
    return snippet
  },

  updateSnippet: (id, updates) => {
    const current = get().snippets.find((snippet) => snippet.id === id)
    if (!current) return false

    const nextName = (updates.name ?? current.name).trim()
    const nextCommand = normalizeCommand(updates.command ?? current.command)
    const nextContent = (updates.content ?? current.content).trim()

    if (!nextName || !nextContent || !isValidCommand(nextCommand) || collides(nextCommand, get().snippets, id)) {
      return false
    }

    const snippets = get().snippets
      .map((snippet) => snippet.id === id ? {
        ...snippet,
        name: nextName,
        command: nextCommand,
        content: nextContent,
        updatedAt: Date.now(),
      } : snippet)
      .sort((a, b) => b.updatedAt - a.updatedAt)

    saveSnippets(snippets)
    set({ snippets })
    return true
  },

  deleteSnippet: (id) => {
    const snippets = get().snippets.filter((snippet) => snippet.id !== id)
    saveSnippets(snippets)
    set({ snippets })
  },

  openManager: () => set({ managerOpen: true }),
  closeManager: () => set({ managerOpen: false }),
}))
