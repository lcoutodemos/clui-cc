import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  FileText, PencilSimple, FileArrowUp, Terminal, MagnifyingGlass, Globe,
  Robot, Question, Wrench, FolderOpen, Copy, Check, CaretRight, CaretDown,
  SpinnerGap, ArrowCounterClockwise, Square,
} from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { PermissionCard } from './PermissionCard'
import { PermissionDeniedCard } from './PermissionDeniedCard'
import { RetryBanner } from './RetryBanner'
import { DiffViewer } from './DiffViewer'
import { useColors, useThemeStore } from '../theme'
import type { Message } from '../../shared/types'

// ─── Constants ───

const INITIAL_RENDER_CAP = 100
const PAGE_SIZE = 100
const REMARK_PLUGINS = [remarkGfm] // Hoisted — prevents re-parse on every render

// ─── Types ───

type GroupedItem =
  | { kind: 'user'; message: Message }
  | { kind: 'assistant'; message: Message }
  | { kind: 'system'; message: Message }
  | { kind: 'tool-group'; messages: Message[] }

// ─── Helpers ───

function groupMessages(messages: Message[]): GroupedItem[] {
  const result: GroupedItem[] = []
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

// ─── Main Component ───

export function ConversationView({ overrideTabId }: { overrideTabId?: string } = {}) {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const staticInfo = useSessionStore((s) => s.staticInfo)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [renderOffset, setRenderOffset] = useState(0) // 0 = show from tail
  const isNearBottomRef = useRef(true)
  const resolvedTabId = overrideTabId || activeTabId
  const prevTabIdRef = useRef(resolvedTabId)
  const colors = useColors()
  const expandedUI = useThemeStore((s) => s.expandedUI)

  const tab = tabs.find((t) => t.id === resolvedTabId)

  // Reset render offset and scroll state when switching tabs
  useEffect(() => {
    if (resolvedTabId !== prevTabIdRef.current) {
      prevTabIdRef.current = resolvedTabId
      setRenderOffset(0)
      isNearBottomRef.current = true
    }
  }, [resolvedTabId])

  // Track whether user is scrolled near the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }, [])

  // Auto-scroll when content changes and user is near bottom.
  const msgCount = tab?.messages.length ?? 0
  const lastMsg = tab?.messages[tab.messages.length - 1]
  const permissionQueueLen = tab?.permissionQueue?.length ?? 0
  const queuedCount = tab?.queuedPrompts?.length ?? 0
  const scrollTrigger = `${msgCount}:${lastMsg?.content?.length ?? 0}:${permissionQueueLen}:${queuedCount}`

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [scrollTrigger])

  // Group only the visible slice of messages
  const allMessages = tab?.messages ?? []
  const totalCount = allMessages.length
  const startIndex = Math.max(0, totalCount - INITIAL_RENDER_CAP - renderOffset * PAGE_SIZE)
  const visibleMessages = startIndex > 0 ? allMessages.slice(startIndex) : allMessages
  const hasOlder = startIndex > 0

  const grouped = useMemo(
    () => groupMessages(visibleMessages),
    [visibleMessages],
  )

  const hiddenCount = totalCount - visibleMessages.length

  const handleLoadOlder = useCallback(() => {
    setRenderOffset((o) => o + 1)
  }, [])

  if (!tab) return null

  const isRunning = tab.status === 'running' || tab.status === 'connecting'
  const isDead = tab.status === 'dead'
  const isFailed = tab.status === 'failed'
  const showInterrupt = isRunning && tab.messages.some((m) => m.role === 'user')

  if (tab.messages.length === 0) {
    return <EmptyState />
  }

  // Messages from before initial render cap are "historical" — no motion
  const historicalThreshold = Math.max(0, totalCount - 20)

  const handleRetry = () => {
    const lastUserMsg = [...tab.messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content)
    }
  }

  return (
    <div
      data-clui-ui
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {tab.retryState && <RetryBanner tabId={tab.id} />}
      </AnimatePresence>

      {/* Scrollable messages area */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden px-4 pt-2 conversation-selectable"
        style={{ maxHeight: expandedUI ? 460 : 336, paddingBottom: 28 }}
        onScroll={handleScroll}
      >
        {/* Load older button */}
        {hasOlder && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleLoadOlder}
              className="text-[11px] px-3 py-1 rounded-full transition-colors"
              style={{ color: colors.textTertiary, border: `1px solid ${colors.toolBorder}` }}
            >
              Load {Math.min(PAGE_SIZE, hiddenCount)} older messages ({hiddenCount} hidden)
            </button>
          </div>
        )}

        <div className="space-y-1 relative">
          {grouped.map((item, idx) => {
            const msgIndex = startIndex + idx
            const isHistorical = msgIndex < historicalThreshold

            switch (item.kind) {
              case 'user':
                return <UserMessage key={item.message.id} message={item.message} skipMotion={isHistorical} />
              case 'assistant':
                return <AssistantMessage key={item.message.id} message={item.message} skipMotion={isHistorical} />
              case 'tool-group':
                return <ToolGroup key={`tg-${item.messages[0].id}`} tools={item.messages} skipMotion={isHistorical} />
              case 'system':
                return <SystemMessage key={item.message.id} message={item.message} skipMotion={isHistorical} />
              default:
                return null
            }
          })}
        </div>

        {/* Permission card (shows first item from queue) */}
        <AnimatePresence>
          {tab.permissionQueue.length > 0 && (
            <PermissionCard
              tabId={tab.id}
              permission={tab.permissionQueue[0]}
              queueLength={tab.permissionQueue.length}
            />
          )}
        </AnimatePresence>

        {/* Permission denied fallback card */}
        <AnimatePresence>
          {tab.permissionDenied && (
            <PermissionDeniedCard
              tools={tab.permissionDenied.tools}
              sessionId={tab.claudeSessionId}
              projectPath={staticInfo?.projectPath || process.cwd()}
              onDismiss={() => {
                useSessionStore.setState((s) => ({
                  tabs: s.tabs.map((t) =>
                    t.id === tab.id ? { ...t, permissionDenied: null } : t
                  ),
                }))
              }}
            />
          )}
        </AnimatePresence>

        {/* Queued prompts */}
        <AnimatePresence>
          {tab.queuedPrompts.map((prompt, i) => (
            <QueuedMessage key={`queued-${i}`} content={prompt} />
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Activity row — overlaps bottom of scroll area as a fade strip */}
      <div
        className="flex items-center justify-between px-4 relative"
        style={{
          height: 28,
          minHeight: 28,
          marginTop: -28,
          background: `linear-gradient(to bottom, transparent, ${colors.containerBg} 70%)`,
          zIndex: 2,
        }}
      >
        {/* Left: status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] min-w-0">
          {isRunning && (
            <span className="flex items-center gap-1.5">
              <span className="flex gap-[3px]">
                <span className="w-[4px] h-[4px] rounded-full animate-bounce-dot" style={{ background: colors.statusRunning, animationDelay: '0ms' }} />
                <span className="w-[4px] h-[4px] rounded-full animate-bounce-dot" style={{ background: colors.statusRunning, animationDelay: '150ms' }} />
                <span className="w-[4px] h-[4px] rounded-full animate-bounce-dot" style={{ background: colors.statusRunning, animationDelay: '300ms' }} />
              </span>
              <span style={{ color: colors.textSecondary }}>{tab.currentActivity || 'Working...'}</span>
            </span>
          )}

          {isDead && (
            <span style={{ color: colors.statusError, fontSize: 11 }}>Session ended unexpectedly</span>
          )}

          {isFailed && (
            <span className="flex items-center gap-1.5">
              <span style={{ color: colors.statusError, fontSize: 11 }}>Failed</span>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors"
                style={{ color: colors.accent, fontSize: 11 }}
              >
                <ArrowCounterClockwise size={10} />
                Retry
              </button>
            </span>
          )}
        </div>

        {/* Right: interrupt button when running */}
        <div className="flex items-center flex-shrink-0">
          <AnimatePresence>
            {showInterrupt && (
              <InterruptButton tabId={tab.id} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ─── Empty State (directory picker before first message) ───

function EmptyState() {
  const setBaseDirectory = useSessionStore((s) => s.setBaseDirectory)
  const colors = useColors()

  const handleChooseFolder = async () => {
    const dir = await window.clui.selectDirectory()
    if (dir) {
      setBaseDirectory(dir)
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-8"
      style={{ minHeight: 80 }}
    >
      <button
        onClick={handleChooseFolder}
        className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-colors"
        style={{
          color: colors.accent,
          background: colors.surfaceHover,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <FolderOpen size={13} />
        Choose folder
      </button>
    </div>
  )
}

// ─── Copy Button ───

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const colors = useColors()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] cursor-pointer flex-shrink-0"
      style={{
        background: copied ? colors.statusCompleteBg : 'transparent',
        color: copied ? colors.statusComplete : colors.textTertiary,
        border: 'none',
      }}
      title="Copy response"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </motion.button>
  )
}

// ─── Interrupt Button ───

function InterruptButton({ tabId }: { tabId: string }) {
  const colors = useColors()

  const handleStop = () => {
    window.clui.stopTab(tabId)
  }

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onClick={handleStop}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] cursor-pointer flex-shrink-0 transition-colors"
      style={{
        background: 'transparent',
        color: colors.statusError,
        border: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = colors.statusErrorBg }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      title="Stop current task"
    >
      <Square size={9} weight="fill" />
      <span>Interrupt</span>
    </motion.button>
  )
}

// ─── User Message ───

function UserMessage({ message, skipMotion }: { message: Message; skipMotion?: boolean }) {
  const colors = useColors()
  const content = (
    <div
      className="text-[13px] leading-[1.5] px-3 py-1.5 max-w-[85%]"
      style={{
        background: colors.userBubble,
        color: colors.userBubbleText,
        border: `1px solid ${colors.userBubbleBorder}`,
        borderRadius: '14px 14px 4px 14px',
      }}
    >
      {message.content}
    </div>
  )

  if (skipMotion) {
    return <div className="flex justify-end py-1.5">{content}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex justify-end py-1.5"
    >
      {content}
    </motion.div>
  )
}

// ─── Queued Message (waiting at bottom until processed) ───

function QueuedMessage({ content }: { content: string }) {
  const colors = useColors()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="flex justify-end py-1.5"
    >
      <div
        className="text-[13px] leading-[1.5] px-3 py-1.5 max-w-[85%]"
        style={{
          background: colors.userBubble,
          color: colors.userBubbleText,
          border: `1px dashed ${colors.userBubbleBorder}`,
          borderRadius: '14px 14px 4px 14px',
          opacity: 0.6,
        }}
      >
        {content}
      </div>
    </motion.div>
  )
}

// ─── Table scroll wrapper — fade edges when horizontally scrollable ───

function TableScrollWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState<string | undefined>(undefined)
  const prevFade = useRef<string | undefined>(undefined)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    let next: string | undefined
    if (scrollWidth <= clientWidth + 1) {
      next = undefined
    } else {
      const l = scrollLeft > 1
      const r = scrollLeft + clientWidth < scrollWidth - 1
      next = l && r
        ? 'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)'
        : l
          ? 'linear-gradient(to right, transparent, black 24px)'
          : r
            ? 'linear-gradient(to right, black calc(100% - 24px), transparent)'
            : undefined
    }
    if (next !== prevFade.current) {
      prevFade.current = next
      setFade(next)
    }
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const table = el.querySelector('table')
    if (table) ro.observe(table)
    return () => ro.disconnect()
  }, [update])

  return (
    <div
      ref={ref}
      onScroll={update}
      style={{
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        maskImage: fade,
        WebkitMaskImage: fade,
      }}
    >
      <table>{children}</table>
    </div>
  )
}

// ─── Image card — graceful fallback when src returns 404 ───

function ImageCard({ src, alt, colors }: { src?: string; alt?: string; colors: ReturnType<typeof useColors> }) {
  const [failed, setFailed] = useState(false)
  // Reset failed state when src changes (e.g. during streaming)
  useEffect(() => { setFailed(false) }, [src])
  const label = alt || 'Image'
  const open = () => { if (src) window.clui.openExternal(String(src)) }

  if (failed || !src) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 my-1 px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer"
        style={{ background: colors.surfacePrimary, color: colors.accent, border: `1px solid ${colors.toolBorder}` }}
        onClick={open}
        title={src}
      >
        <Globe size={12} />
        Image unavailable{alt ? ` — ${alt}` : ''}
      </button>
    )
  }

  return (
    <button
      type="button"
      className="block my-2 rounded-lg overflow-hidden border text-left cursor-pointer"
      style={{ borderColor: colors.toolBorder, background: colors.surfacePrimary }}
      onClick={open}
      title={src}
    >
      <img
        src={src}
        alt={label}
        className="block w-full max-h-[260px] object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
      {alt && (
        <div className="px-2 py-1 text-[11px]" style={{ color: colors.textTertiary }}>
          {alt}
        </div>
      )}
    </button>
  )
}

// ─── Assistant Message (memoized — only re-renders when content changes) ───

const AssistantMessage = React.memo(function AssistantMessage({
  message,
  skipMotion,
}: {
  message: Message
  skipMotion?: boolean
}) {
  const colors = useColors()

  const markdownComponents = useMemo(() => ({
    table: ({ children }: any) => <TableScrollWrapper>{children}</TableScrollWrapper>,
    a: ({ href, children }: any) => (
      <button
        type="button"
        className="underline decoration-dotted underline-offset-2 cursor-pointer"
        style={{ color: colors.accent }}
        onClick={() => {
          if (href) window.clui.openExternal(String(href))
        }}
      >
        {children}
      </button>
    ),
    img: ({ src, alt }: any) => <ImageCard src={src} alt={alt} colors={colors} />,
  }), [colors])

  const inner = (
    <div className="group/msg relative">
      <div className="text-[13px] leading-[1.6] prose-cloud min-w-0 max-w-[92%]">
        <Markdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
          {message.content}
        </Markdown>
      </div>
      {/* Copy button — always in DOM, shown via CSS :hover (no React state needed).
          Absolute positioning so it never shifts the text layout. */}
      {message.content.trim() && (
        <div className="absolute bottom-0 right-0 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-100">
          <CopyButton text={message.content} />
        </div>
      )}
    </div>
  )

  if (skipMotion) {
    return <div className="py-1">{inner}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="py-1"
    >
      {inner}
    </motion.div>
  )
}, (prev, next) => prev.message.content === next.message.content && prev.skipMotion === next.skipMotion)

// ─── Tool Group (collapsible timeline — Claude Code style) ───

/** Build a short description from tool name + input for the collapsed summary */
function toolSummary(tools: Message[]): string {
  if (tools.length === 0) return ''
  // Use first tool's context for summary
  const first = tools[0]
  const desc = getToolDescription(first.toolName || 'Tool', first.toolInput)
  if (tools.length === 1) return desc
  return `${desc} and ${tools.length - 1} more tool${tools.length > 2 ? 's' : ''}`
}

/** Short human-readable description from tool name + input */
function getToolDescription(name: string, input?: string): string {
  if (!input) return name

  // Try to extract a meaningful short description from the input JSON
  try {
    const parsed = JSON.parse(input)
    switch (name) {
      case 'Read': return `Read ${parsed.file_path || parsed.path || 'file'}`
      case 'Edit': return `Edit ${parsed.file_path || 'file'}`
      case 'Write': return `Write ${parsed.file_path || 'file'}`
      case 'Glob': return `Search files: ${parsed.pattern || ''}`
      case 'Grep': return `Search: ${parsed.pattern || ''}`
      case 'Bash': {
        const cmd = parsed.command || ''
        return cmd.length > 60 ? `${cmd.substring(0, 57)}...` : cmd || 'Bash'
      }
      case 'WebSearch': return `Search: ${parsed.query || parsed.search_query || ''}`
      case 'WebFetch': return `Fetch: ${parsed.url || ''}`
      case 'Agent': return `Agent: ${(parsed.prompt || parsed.description || '').substring(0, 50)}`
      default: return name
    }
  } catch {
    // Input is not JSON or is partial — show truncated raw
    const trimmed = input.trim()
    if (trimmed.length > 60) return `${name}: ${trimmed.substring(0, 57)}...`
    return trimmed ? `${name}: ${trimmed}` : name
  }
}

function ToolGroup({ tools, skipMotion }: { tools: Message[]; skipMotion?: boolean }) {
  const hasRunning = tools.some((t) => t.toolStatus === 'running')
  const [expanded, setExpanded] = useState(false)
  const colors = useColors()

  const isOpen = expanded || hasRunning

  if (isOpen) {
    const inner = (
      <div className="py-1">
        {/* Collapse header — click to close */}
        {!hasRunning && (
          <div
            className="flex items-center gap-1 cursor-pointer mb-1.5"
            onClick={() => setExpanded(false)}
          >
            <CaretDown size={10} style={{ color: colors.textMuted }} />
            <span className="text-[11px]" style={{ color: colors.textMuted }}>
              Used {tools.length} tool{tools.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Timeline */}
        <div className="relative pl-6">
          {/* Vertical line */}
          <div
            className="absolute left-[10px] top-1 bottom-1 w-px"
            style={{ background: colors.timelineLine }}
          />

          <div className="space-y-3">
            {tools.map((tool) => {
              const isRunning = tool.toolStatus === 'running'
              const toolName = tool.toolName || 'Tool'
              const desc = getToolDescription(toolName, tool.toolInput)

              return (
                <div key={tool.id} className="relative">
                  {/* Timeline node */}
                  <div
                    className="absolute -left-6 top-[1px] w-[20px] h-[20px] rounded-full flex items-center justify-center"
                    style={{
                      background: isRunning ? colors.toolRunningBg : colors.toolBg,
                      border: `1px solid ${isRunning ? colors.toolRunningBorder : colors.toolBorder}`,
                    }}
                  >
                    {isRunning
                      ? <SpinnerGap size={10} className="animate-spin" style={{ color: colors.statusRunning }} />
                      : <ToolIcon name={toolName} size={10} />
                    }
                  </div>

                  {/* Tool description */}
                  <div className="min-w-0">
                    <span
                      className="text-[12px] leading-[1.4] block truncate"
                      style={{ color: isRunning ? colors.textSecondary : colors.textTertiary }}
                    >
                      {desc}
                    </span>

                    {/* Inline diff viewer for Edit/Write tools */}
                    {!isRunning && <ToolDiffOrBadge tool={tool} />}

                    {isRunning && (
                      <span className="text-[10px] mt-0.5 block" style={{ color: colors.textMuted }}>
                        running...
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )

    if (skipMotion) return inner

    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.15 }}
      >
        {inner}
      </motion.div>
    )
  }

  // Collapsed state — summary text + chevron, no container
  const summary = toolSummary(tools)

  const inner = (
    <div
      className="flex items-start gap-1 cursor-pointer py-[2px]"
      onClick={() => setExpanded(true)}
    >
      <CaretRight size={10} className="flex-shrink-0 mt-[2px]" style={{ color: colors.textTertiary }} />
      <span className="text-[11px] leading-[1.4]" style={{ color: colors.textTertiary }}>
        {summary}
      </span>
    </div>
  )

  if (skipMotion) return <div className="py-0.5">{inner}</div>

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className="py-0.5"
    >
      {inner}
    </motion.div>
  )
}

// ─── System Message ───

function SystemMessage({ message, skipMotion }: { message: Message; skipMotion?: boolean }) {
  const isError = message.content.startsWith('Error:') || message.content.includes('unexpectedly')
  const colors = useColors()

  const inner = (
    <div
      className="text-[11px] leading-[1.5] px-2.5 py-1 rounded-lg inline-block whitespace-pre-wrap"
      style={{
        background: isError ? colors.statusErrorBg : colors.surfaceHover,
        color: isError ? colors.statusError : colors.textTertiary,
      }}
    >
      {message.content}
    </div>
  )

  if (skipMotion) return <div className="py-0.5">{inner}</div>

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="py-0.5"
    >
      {inner}
    </motion.div>
  )
}

// ─── Tool Icon mapping ───

function ToolIcon({ name, size = 12 }: { name: string; size?: number }) {
  const colors = useColors()
  const ICONS: Record<string, React.ReactNode> = {
    Read: <FileText size={size} />,
    Edit: <PencilSimple size={size} />,
    Write: <FileArrowUp size={size} />,
    Bash: <Terminal size={size} />,
    Glob: <FolderOpen size={size} />,
    Grep: <MagnifyingGlass size={size} />,
    WebSearch: <Globe size={size} />,
    WebFetch: <Globe size={size} />,
    Agent: <Robot size={size} />,
    AskUserQuestion: <Question size={size} />,
  }

  return (
    <span className="flex items-center" style={{ color: colors.textTertiary }}>
      {ICONS[name] || <Wrench size={size} />}
    </span>
  )
}

// ─── Tool Diff or Badge — shows DiffViewer for Edit/Write, generic badge otherwise ───

/** Try to parse tool input JSON safely */
function parseToolInput(raw?: string): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

function ToolDiffOrBadge({ tool }: { tool: Message }) {
  const colors = useColors()
  const toolName = tool.toolName || ''
  const parsed = useMemo(() => parseToolInput(tool.toolInput), [tool.toolInput])

  // Edit tool: has file_path, old_string, new_string
  if (toolName === 'Edit' && parsed) {
    const filePath = typeof parsed.file_path === 'string' ? parsed.file_path : ''
    const oldString = typeof parsed.old_string === 'string' ? parsed.old_string : ''
    const newString = typeof parsed.new_string === 'string' ? parsed.new_string : ''

    if (filePath && (oldString || newString)) {
      return (
        <div className="mt-1.5">
          <DiffViewer filePath={filePath} oldString={oldString} newString={newString} />
        </div>
      )
    }
  }

  // Write tool: has file_path, content (all additions, no old content)
  if (toolName === 'Write' && parsed) {
    const filePath = typeof parsed.file_path === 'string' ? parsed.file_path : ''
    const content = typeof parsed.content === 'string' ? parsed.content : ''

    if (filePath && content) {
      return (
        <div className="mt-1.5">
          <DiffViewer filePath={filePath} oldString="" newString={content} />
        </div>
      )
    }
  }

  // Fallback: generic result badge
  return (
    <span
      className="inline-block text-[10px] mt-0.5 px-1.5 py-[1px] rounded"
      style={{
        background: tool.toolStatus === 'error' ? colors.statusErrorBg : colors.surfaceHover,
        color: tool.toolStatus === 'error' ? colors.statusError : colors.textMuted,
      }}
    >
      Result
    </span>
  )
}
