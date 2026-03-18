import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { PinnedSessionStore } from '../../src/main/pinned-sessions'

describe('PinnedSessionStore', () => {
  const testDir = join(tmpdir(), `clui-pinned-sessions-${Date.now()}`)
  const filePath = join(testDir, 'pinned-sessions.json')
  let store: PinnedSessionStore

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
    store = new PinnedSessionStore(filePath)
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('pins a session for a project and persists it', () => {
    store.pin('session-1', 'C:/repo')

    const reloaded = new PinnedSessionStore(filePath)
    expect(reloaded.isPinned('session-1', 'C:/repo')).toBe(true)
    expect(reloaded.getPinnedAt('session-1', 'C:/repo')).toBeTypeOf('number')
  })

  it('does not report a session as pinned for a different project', () => {
    store.pin('session-1', 'C:/repo-a')

    expect(store.isPinned('session-1', 'C:/repo-b')).toBe(false)
    expect(store.getPinnedAt('session-1', 'C:/repo-b')).toBeNull()
  })

  it('unpins a session cleanly', () => {
    store.pin('session-1', 'C:/repo')
    store.unpin('session-1')

    expect(store.isPinned('session-1', 'C:/repo')).toBe(false)
    expect(store.getPinnedAt('session-1', 'C:/repo')).toBeNull()
  })
})
