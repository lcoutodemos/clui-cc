#!/usr/bin/env node

const { randomUUID } = require('crypto')

const args = process.argv.slice(2)

function writeEvent(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getArgValue(flag) {
  const index = args.indexOf(flag)
  if (index === -1) return null
  return args[index + 1] ?? null
}

function extractPrompt(payload) {
  if (!payload || payload.type !== 'user') return ''
  const content = payload.message && Array.isArray(payload.message.content)
    ? payload.message.content
    : []

  return content
    .filter((part) => part && part.type === 'text')
    .map((part) => part.text || '')
    .join('\n')
    .trim()
}

function emitVersion() {
  process.stdout.write('claude 0.0.0-e2e\n')
}

function emitAuthStatus() {
  process.stdout.write(JSON.stringify({
    email: 'e2e@local.test',
    subscriptionType: 'Max',
    authMethod: 'mock',
  }))
}

function emitInit(sessionId, model) {
  writeEvent({
    type: 'system',
    subtype: 'init',
    cwd: process.cwd(),
    session_id: sessionId,
    tools: ['Read', 'Edit', 'Write', 'Bash'],
    mcp_servers: [],
    model,
    permissionMode: 'default',
    agents: [],
    skills: [],
    plugins: [],
    claude_code_version: 'e2e-fake-claude',
    fast_mode_state: 'off',
    uuid: randomUUID(),
  })
}

async function emitPromptResponse(sessionId, model, prompt) {
  const responseText = `Fake response to: ${prompt || 'empty prompt'}`
  const chunks = ['Fake response to: ', prompt || 'empty prompt']

  writeEvent({
    type: 'stream_event',
    event: {
      type: 'message_start',
      message: {
        model,
        id: `msg-${randomUUID()}`,
        role: 'assistant',
        content: [],
        stop_reason: null,
        usage: {},
      },
    },
    session_id: sessionId,
    parent_tool_use_id: null,
    uuid: randomUUID(),
  })

  writeEvent({
    type: 'stream_event',
    event: {
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'text',
        text: '',
      },
    },
    session_id: sessionId,
    parent_tool_use_id: null,
    uuid: randomUUID(),
  })

  for (const chunk of chunks) {
    await sleep(40)
    writeEvent({
      type: 'stream_event',
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: chunk,
        },
      },
      session_id: sessionId,
      parent_tool_use_id: null,
      uuid: randomUUID(),
    })
  }

  writeEvent({
    type: 'stream_event',
    event: {
      type: 'content_block_stop',
      index: 0,
    },
    session_id: sessionId,
    parent_tool_use_id: null,
    uuid: randomUUID(),
  })

  await sleep(20)

  writeEvent({
    type: 'assistant',
    message: {
      model,
      id: `msg-${randomUUID()}`,
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 12,
        output_tokens: 24,
      },
    },
    parent_tool_use_id: null,
    session_id: sessionId,
    uuid: randomUUID(),
  })

  await sleep(20)

  writeEvent({
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 120,
    num_turns: 1,
    result: responseText,
    total_cost_usd: 0.0012,
    session_id: sessionId,
    usage: {
      input_tokens: 12,
      output_tokens: 24,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    permission_denials: [],
    uuid: randomUUID(),
  })
}

if (args.length === 1 && (args[0] === '-v' || args[0] === '--version')) {
  emitVersion()
  process.exit(0)
}

if (args[0] === 'auth' && args[1] === 'status') {
  emitAuthStatus()
  process.exit(0)
}

if (args[0] === 'mcp' && args[1] === 'list') {
  process.exit(0)
}

const sessionId = getArgValue('--resume') || randomUUID()
const model = getArgValue('--model') || 'claude-sonnet-4-6'
let responded = false
let buffer = ''

emitInit(sessionId, model)

process.stdin.setEncoding('utf8')

process.stdin.on('data', (chunk) => {
  buffer += chunk
  const lines = buffer.split(/\r?\n/)
  buffer = lines.pop() || ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || responded) continue

    let payload = null
    try {
      payload = JSON.parse(trimmed)
    } catch {
      continue
    }

    const prompt = extractPrompt(payload)
    if (!prompt && payload.type !== 'user') continue

    responded = true
    void emitPromptResponse(sessionId, model, prompt).then(() => {
      setTimeout(() => process.exit(0), 10)
    })
  }
})

process.stdin.on('end', () => {
  if (!responded) {
    process.exit(0)
  }
})

process.on('SIGINT', () => {
  process.exit(130)
})
