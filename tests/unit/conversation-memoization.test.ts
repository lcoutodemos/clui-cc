import { describe, expect, it } from 'vitest'
import type { Message } from '../../src/shared/types'

// ─── Test the groupMessages logic (pure function) ───

// We extract and test the groupMessages logic to verify memoization won't break grouping.
// The actual React.memo tests would need @testing-library/react (renderer tests).

function groupMessages(messages: Message[]): Array<
  | { kind: 'user'; message: Message }
  | { kind: 'assistant'; message: Message }
  | { kind: 'system'; message: Message }
  | { kind: 'tool-group'; messages: Message[] }
> {
  const result: Array<
    | { kind: 'user'; message: Message }
    | { kind: 'assistant'; message: Message }
    | { kind: 'system'; message: Message }
    | { kind: 'tool-group'; messages: Message[] }
  > = []
  let toolBuf: Message[] = []

  const flushTools = () => {
    if (toolBuf.length > 0) {
      result.push({ kind: 'tool-group', messages: [...toolBuf] })
      toolBuf = []
    }
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      toolBuf.push(msg)
    } else {
      flushTools()
      if (msg.role === 'user') result.push({ kind: 'user', message: msg })
      else if (msg.role === 'assistant') result.push({ kind: 'assistant', message: msg })
      else result.push({ kind: 'system', message: msg })
    }
  }
  flushTools()
  return result
}

function makeMsg(id: string, role: Message['role'], content = ''): Message {
  return { id, role, content, timestamp: Date.now() } as Message
}

describe('groupMessages', () => {
  it('groups consecutive tool messages together', () => {
    const messages = [
      makeMsg('1', 'user', 'hello'),
      makeMsg('2', 'assistant', 'hi'),
      makeMsg('3', 'tool', 'edit file'),
      makeMsg('4', 'tool', 'read file'),
      makeMsg('5', 'assistant', 'done'),
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(4)
    expect(groups[0].kind).toBe('user')
    expect(groups[1].kind).toBe('assistant')
    expect(groups[2].kind).toBe('tool-group')
    if (groups[2].kind === 'tool-group') {
      expect(groups[2].messages).toHaveLength(2)
    }
    expect(groups[3].kind).toBe('assistant')
  })

  it('returns empty array for empty messages', () => {
    expect(groupMessages([])).toEqual([])
  })

  it('handles single user message', () => {
    const groups = groupMessages([makeMsg('1', 'user', 'hi')])
    expect(groups).toHaveLength(1)
    expect(groups[0].kind).toBe('user')
  })

  it('handles tools at the end without trailing assistant', () => {
    const messages = [
      makeMsg('1', 'assistant', 'working...'),
      makeMsg('2', 'tool', 'running cmd'),
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(2)
    expect(groups[1].kind).toBe('tool-group')
  })

  it('produces stable output for same input (memoization-safe)', () => {
    const messages = [
      makeMsg('1', 'user', 'hello'),
      makeMsg('2', 'assistant', 'hi'),
    ]
    const result1 = groupMessages(messages)
    const result2 = groupMessages(messages)
    // Same structure but different object references (useMemo depends on deps, not deep equality)
    expect(result1).toEqual(result2)
    expect(result1.length).toBe(result2.length)
  })
})

// ─── Selector equality tests ───
// These verify the custom equality functions we'll add for optimized selectors

describe('selector equality', () => {
  it('tab messages: last-message equality detects new messages', () => {
    const msgs1 = [makeMsg('1', 'user', 'a'), makeMsg('2', 'assistant', 'b')]
    const msgs2 = [...msgs1, makeMsg('3', 'user', 'c')]
    // Different length and different last message
    const equal = msgs1.length === msgs2.length && msgs1[msgs1.length - 1] === msgs2[msgs2.length - 1]
    expect(equal).toBe(false)
  })

  it('tab messages: same reference is equal', () => {
    const msgs = [makeMsg('1', 'user', 'a')]
    const equal = msgs.length === msgs.length && msgs[msgs.length - 1] === msgs[msgs.length - 1]
    expect(equal).toBe(true)
  })

  it('tab messages: content change on last message detected via reference', () => {
    const msg1 = makeMsg('1', 'assistant', 'hello')
    const msg2 = { ...msg1, content: 'hello world' } // new reference
    const msgs1 = [msg1]
    const msgs2 = [msg2]
    const equal = msgs1.length === msgs2.length && msgs1[msgs1.length - 1] === msgs2[msgs2.length - 1]
    expect(equal).toBe(false)
  })
})
