import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'

interface PinnedSessionEntry {
  pinnedAt: number
  projectPath: string
}

interface PinnedSessionFile {
  pins: Record<string, PinnedSessionEntry>
}

const DEFAULT_FILE_PATH = join(homedir(), '.clui', 'pinned-sessions.json')

export class PinnedSessionStore {
  private filePath: string

  constructor(filePath = DEFAULT_FILE_PATH) {
    this.filePath = filePath
  }

  isPinned(sessionId: string, projectPath: string): boolean {
    const entry = this.readState().pins[sessionId]
    return !!entry && entry.projectPath === projectPath
  }

  getPinnedAt(sessionId: string, projectPath: string): number | null {
    const entry = this.readState().pins[sessionId]
    if (!entry || entry.projectPath !== projectPath) {
      return null
    }
    return entry.pinnedAt
  }

  pin(sessionId: string, projectPath: string): void {
    const state = this.readState()
    state.pins[sessionId] = {
      pinnedAt: Date.now(),
      projectPath,
    }
    this.writeState(state)
  }

  unpin(sessionId: string): void {
    const state = this.readState()
    if (!state.pins[sessionId]) {
      return
    }
    delete state.pins[sessionId]
    this.writeState(state)
  }

  private readState(): PinnedSessionFile {
    try {
      if (!existsSync(this.filePath)) {
        return { pins: {} }
      }

      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      const pins: Record<string, PinnedSessionEntry> = {}

      if (raw?.pins && typeof raw.pins === 'object') {
        for (const [sessionId, entry] of Object.entries(raw.pins as Record<string, any>)) {
          if (typeof entry?.pinnedAt !== 'number' || typeof entry?.projectPath !== 'string') {
            continue
          }
          pins[sessionId] = {
            pinnedAt: entry.pinnedAt,
            projectPath: entry.projectPath,
          }
        }
      }

      return { pins }
    } catch {
      return { pins: {} }
    }
  }

  private writeState(state: PinnedSessionFile): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8')
  }
}
