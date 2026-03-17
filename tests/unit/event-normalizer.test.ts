import { describe, it, expect } from 'vitest'
import { normalize } from '../../src/main/claude/event-normalizer'

describe('EventNormalizer', () => {
  describe('system/init events', () => {
    it('normalizes a system init event to session_init', () => {
      const raw = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'sess-123',
        tools: ['Read', 'Write'],
        model: 'claude-sonnet-4-5-20250514',
        mcp_servers: [{ name: 'test', status: 'connected' }],
        skills: ['skill-creator'],
        claude_code_version: '2.1.71',
        cwd: '/tmp',
        permissionMode: 'acceptEdits',
        agents: [],
        plugins: [],
        fast_mode_state: 'off',
        uuid: 'uuid-1',
      }

      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'session_init',
        sessionId: 'sess-123',
        tools: ['Read', 'Write'],
        model: 'claude-sonnet-4-5-20250514',
      })
    })

    it('returns empty array for non-init system events', () => {
      const raw = {
        type: 'system' as const,
        subtype: 'other' as any,
        session_id: 'x',
        cwd: '/',
        tools: [],
        mcp_servers: [],
        model: '',
        permissionMode: '',
        agents: [],
        skills: [],
        plugins: [],
        claude_code_version: '',
        fast_mode_state: '',
        uuid: '',
      }
      expect(normalize(raw)).toEqual([])
    })
  })

  describe('stream events', () => {
    it('normalizes text_delta to text_chunk', () => {
      const raw = {
        type: 'stream_event' as const,
        session_id: 's1',
        parent_tool_use_id: null,
        uuid: 'u1',
        event: {
          type: 'content_block_delta' as const,
          index: 0,
          delta: { type: 'text_delta' as const, text: 'Hello' },
        },
      }

      const result = normalize(raw)
      expect(result).toEqual([{ type: 'text_chunk', text: 'Hello' }])
    })

    it('normalizes tool_use content_block_start to tool_call', () => {
      const raw = {
        type: 'stream_event' as const,
        session_id: 's1',
        parent_tool_use_id: null,
        uuid: 'u1',
        event: {
          type: 'content_block_start' as const,
          index: 1,
          content_block: { type: 'tool_use' as const, id: 'tool-1', name: 'Read' },
        },
      }

      const result = normalize(raw)
      expect(result).toEqual([{
        type: 'tool_call',
        toolName: 'Read',
        toolId: 'tool-1',
        index: 1,
      }])
    })

    it('normalizes input_json_delta to tool_call_update', () => {
      const raw = {
        type: 'stream_event' as const,
        session_id: 's1',
        parent_tool_use_id: null,
        uuid: 'u1',
        event: {
          type: 'content_block_delta' as const,
          index: 1,
          delta: { type: 'input_json_delta' as const, partial_json: '{"path":' },
        },
      }

      const result = normalize(raw)
      expect(result).toEqual([{
        type: 'tool_call_update',
        toolId: '',
        partialInput: '{"path":',
      }])
    })

    it('normalizes content_block_stop to tool_call_complete', () => {
      const raw = {
        type: 'stream_event' as const,
        session_id: 's1',
        parent_tool_use_id: null,
        uuid: 'u1',
        event: {
          type: 'content_block_stop' as const,
          index: 1,
        },
      }

      const result = normalize(raw)
      expect(result).toEqual([{ type: 'tool_call_complete', index: 1 }])
    })

    it('returns empty for message_start/delta/stop structural events', () => {
      for (const subType of ['message_start', 'message_delta', 'message_stop'] as const) {
        const raw = {
          type: 'stream_event' as const,
          session_id: 's1',
          parent_tool_use_id: null,
          uuid: 'u1',
          event: { type: subType, message: {}, delta: {}, usage: {} } as any,
        }
        expect(normalize(raw)).toEqual([])
      }
    })
  })

  describe('result events', () => {
    it('normalizes successful result to task_complete', () => {
      const raw = {
        type: 'result' as const,
        subtype: 'success' as const,
        result: 'Done',
        is_error: false,
        session_id: 's1',
        total_cost_usd: 0.05,
        duration_ms: 1200,
        num_turns: 3,
        usage: { input_tokens: 100, output_tokens: 50 },
      }

      const result = normalize(raw)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'task_complete',
        result: 'Done',
        costUsd: 0.05,
        durationMs: 1200,
        numTurns: 3,
        sessionId: 's1',
      })
    })

    it('normalizes error result to error event', () => {
      const raw = {
        type: 'result' as const,
        subtype: 'error' as const,
        result: 'API key invalid',
        is_error: true,
        session_id: 's1',
        total_cost_usd: 0,
        duration_ms: 100,
        num_turns: 0,
        usage: {},
      }

      const result = normalize(raw)
      expect(result).toEqual([{
        type: 'error',
        message: 'API key invalid',
        isError: true,
        sessionId: 's1',
      }])
    })
  })

  describe('unknown events', () => {
    it('returns empty array for unknown event types', () => {
      const raw = { type: 'completely_unknown' } as any
      expect(normalize(raw)).toEqual([])
    })
  })
})
