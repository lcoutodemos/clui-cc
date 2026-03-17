import { describe, it, expect } from 'vitest'
import { StreamParser } from '../../src/main/stream-parser'
import { Readable } from 'stream'

describe('StreamParser', () => {
  it('parses valid NDJSON lines into events', async () => {
    const events: unknown[] = []
    const input = new Readable({ read() {} })

    const parser = StreamParser.fromStream(input)
    parser.on('event', (e: unknown) => events.push(e))

    const done = new Promise<void>((resolve) => input.on('end', () => setTimeout(resolve, 50)))

    input.push('{"type":"system","subtype":"init","session_id":"abc"}\n')
    input.push('{"type":"result","result":"done"}\n')
    input.push(null)

    await done

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'system', subtype: 'init', session_id: 'abc' })
    expect(events[1]).toEqual({ type: 'result', result: 'done' })
  })

  it('emits parse-error for invalid JSON lines', async () => {
    const errors: string[] = []
    const input = new Readable({ read() {} })

    const parser = StreamParser.fromStream(input)
    parser.on('parse-error', (line: string) => errors.push(line))

    const done = new Promise<void>((resolve) => input.on('end', () => setTimeout(resolve, 50)))

    input.push('not valid json\n')
    input.push('{"type":"result"}\n')
    input.push(null)

    await done

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('not valid json')
  })

  it('handles empty lines gracefully', async () => {
    const events: unknown[] = []
    const errors: string[] = []
    const input = new Readable({ read() {} })

    const parser = StreamParser.fromStream(input)
    parser.on('event', (e: unknown) => events.push(e))
    parser.on('parse-error', (line: string) => errors.push(line))

    const done = new Promise<void>((resolve) => input.on('end', () => setTimeout(resolve, 50)))

    input.push('\n')
    input.push('  \n')
    input.push('{"type":"result"}\n')
    input.push(null)

    await done

    expect(events).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })
})
