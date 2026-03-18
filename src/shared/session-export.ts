import type { ExportOptions, Message, SessionExportData } from './types'

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'markdown',
  includeUserMessages: true,
  includeAssistantMessages: true,
  includeToolCalls: true,
  includeMetadata: false,
}

export function getFilteredExportMessages(messages: Message[], options: ExportOptions): Message[] {
  return messages.filter((message) => {
    if (message.role === 'user') return options.includeUserMessages
    if (message.role === 'assistant' || message.role === 'system') return options.includeAssistantMessages
    if (message.role === 'tool') return options.includeToolCalls
    return false
  })
}

export function hasExportableMessages(data: SessionExportData, options: ExportOptions): boolean {
  return getFilteredExportMessages(data.messages, options).length > 0
}

export function buildSessionExportContent(data: SessionExportData, options: ExportOptions): string {
  return options.format === 'json'
    ? buildJsonExport(data, options)
    : buildMarkdownExport(data, options)
}

function buildMarkdownExport(data: SessionExportData, options: ExportOptions): string {
  const filteredMessages = getFilteredExportMessages(data.messages, options)
  const title = getExportTitle(data)
  const lines: string[] = [`# Session: ${title}`]

  const metaParts = [`Exported: ${new Date(data.exportedAt).toLocaleString()}`]
  if (data.model) {
    metaParts.push(`Model: ${data.model}`)
  }
  if (options.includeMetadata && data.lastResult) {
    metaParts.push(`Cost: $${data.lastResult.totalCostUsd.toFixed(4)}`)
    metaParts.push(`Duration: ${formatDuration(data.lastResult.durationMs)}`)
    metaParts.push(`Turns: ${data.lastResult.numTurns}`)
    if (data.lastResult.usage.input_tokens || data.lastResult.usage.output_tokens) {
      metaParts.push(
        `Tokens: ${(data.lastResult.usage.input_tokens || 0).toLocaleString()} in / ${(data.lastResult.usage.output_tokens || 0).toLocaleString()} out`,
      )
    }
  }

  lines.push(`*${metaParts.join(' | ')}*`)
  lines.push('')
  lines.push('---')
  lines.push('')

  if (filteredMessages.length === 0) {
    lines.push('Nothing to export.')
    return `${lines.join('\n').trim()}\n`
  }

  filteredMessages.forEach((message, index) => {
    if (message.role === 'user') {
      lines.push('## User')
      lines.push(message.content.trim() || '(empty)')
    } else if (message.role === 'assistant') {
      lines.push('## Assistant')
      lines.push(message.content.trim() || '(empty)')
    } else if (message.role === 'system') {
      lines.push('## System')
      lines.push(message.content.trim() || '(empty)')
    } else if (message.role === 'tool') {
      lines.push(`### Tool: ${message.toolName || 'Tool'}`)
      if (message.toolInput?.trim()) {
        lines.push('```json')
        lines.push(message.toolInput.trim())
        lines.push('```')
      }
      if (message.content.trim()) {
        lines.push(message.content.trim())
      }
      if (!message.toolInput?.trim() && !message.content.trim()) {
        lines.push('(no output captured)')
      }
    }

    if (index < filteredMessages.length - 1) {
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  })

  return `${lines.join('\n').trim()}\n`
}

function buildJsonExport(data: SessionExportData, options: ExportOptions): string {
  const filteredMessages = getFilteredExportMessages(data.messages, options)
  const payload: Record<string, unknown> = {
    exportedAt: data.exportedAt,
    title: getExportTitle(data),
    sessionId: data.sessionId,
    model: data.model,
    projectPath: data.projectPath,
    messages: filteredMessages.map((message) => ({
      role: message.role,
      content: message.content,
      toolName: message.toolName,
      toolInput: message.toolInput,
      toolStatus: message.toolStatus,
      timestamp: new Date(message.timestamp).toISOString(),
    })),
  }

  if (options.includeMetadata && data.lastResult) {
    payload.metadata = {
      totalCostUsd: data.lastResult.totalCostUsd,
      durationMs: data.lastResult.durationMs,
      numTurns: data.lastResult.numTurns,
      usage: data.lastResult.usage,
    }
  }

  return `${JSON.stringify(payload, null, 2)}\n`
}

function getExportTitle(data: SessionExportData): string {
  const trimmedTitle = data.title.trim()
  if (trimmedTitle) {
    return trimmedTitle
  }

  const firstUserMessage = data.messages.find((message) => message.role === 'user' && message.content.trim())
  if (firstUserMessage) {
    const normalized = firstUserMessage.content.replace(/\s+/g, ' ').trim()
    return normalized.length > 60 ? `${normalized.slice(0, 57).trimEnd()}...` : normalized
  }

  return data.sessionId ? `Session ${data.sessionId.slice(0, 8)}` : 'Untitled Session'
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${totalSeconds}s`
  return `${minutes}m ${seconds}s`
}
