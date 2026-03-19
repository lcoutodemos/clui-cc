import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Microphone, ArrowUp, SpinnerGap, X, Check, Sparkle, Lightning } from '@phosphor-icons/react'
import { useSessionStore, AVAILABLE_MODELS } from '../stores/sessionStore'
import { useAgentMemoryStore } from '../stores/agentMemoryStore'
import { useComparisonStore } from '../stores/comparisonStore'
import { useExportStore } from '../stores/exportStore'
import { useSnippetStore } from '../stores/snippetStore'
import { useWorkflowStore } from '../stores/workflowStore'
import { AttachmentChips } from './AttachmentChips'
import { SlashCommandMenu, getFilteredCommandsWithExtras, type SlashCommand } from './SlashCommandMenu'
import { useColors } from '../theme'
import type { AgentAssignment, AgentMemorySnapshot, SessionExportData } from '../../shared/types'

const INPUT_MIN_HEIGHT = 20
const INPUT_MAX_HEIGHT = 140
const MULTILINE_ENTER_HEIGHT = 52
const MULTILINE_EXIT_HEIGHT = 50
const INLINE_CONTROLS_RESERVED_WIDTH = 104

type VoiceState = 'idle' | 'recording' | 'transcribing'

function formatAssignmentLine(assignment: AgentAssignment): string {
  const prefix = assignment.workKey ? `${assignment.workKey} -> ${assignment.agentLabel}` : assignment.agentLabel
  return `${prefix}: ${assignment.summary}`
}

function formatMemorySnapshot(snapshot: AgentMemorySnapshot | null, activeTabId: string): string {
  if (!snapshot || (snapshot.active.length === 0 && snapshot.recentDone.length === 0)) {
    return 'No shared agent memory for this project yet.'
  }

  const lines: string[] = []
  const current = snapshot.active.find((assignment) => assignment.tabId === activeTabId)
  const otherActive = snapshot.active.filter((assignment) => assignment.tabId !== activeTabId)

  if (current) {
    lines.push(`Current: ${formatAssignmentLine(current)}`)
  }

  if (otherActive.length > 0) {
    lines.push('Active:')
    for (const assignment of otherActive) {
      lines.push(`- ${formatAssignmentLine(assignment)}`)
    }
  }

  if (snapshot.recentDone.length > 0) {
    lines.push('Recent done:')
    for (const assignment of snapshot.recentDone) {
      const line = formatAssignmentLine(assignment)
      lines.push(`- ${assignment.note ? `${line} (${assignment.note})` : line}`)
    }
  }

  return lines.join('\n')
}

/**
 * InputBar renders inside a glass-surface rounded-full pill provided by App.tsx.
 * It provides: textarea + mic/send buttons. Attachment chips render above when present.
 */
export function InputBar() {
  const [input, setInput] = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [slashFilter, setSlashFilter] = useState<string | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [isMultiLine, setIsMultiLine] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLTextAreaElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const sendMessage = useSessionStore((s) => s.sendMessage)
  const clearTab = useSessionStore((s) => s.clearTab)
  const addSystemMessage = useSessionStore((s) => s.addSystemMessage)
  const addAttachments = useSessionStore((s) => s.addAttachments)
  const removeAttachment = useSessionStore((s) => s.removeAttachment)
  const refreshAgentMemory = useAgentMemoryStore((s) => s.refreshAgentMemory)
  const setAgentFocus = useAgentMemoryStore((s) => s.setAgentFocus)
  const claimAgentWork = useAgentMemoryStore((s) => s.claimAgentWork)
  const markAgentDone = useAgentMemoryStore((s) => s.markAgentDone)
  const releaseAgentWork = useAgentMemoryStore((s) => s.releaseAgentWork)

  const setPreferredModel = useSessionStore((s) => s.setPreferredModel)
  const openExportDialog = useExportStore((s) => s.openDialog)
  const staticInfo = useSessionStore((s) => s.staticInfo)
  const agentMemorySnapshot = useAgentMemoryStore((s) => s.snapshot)
  const preferredModel = useSessionStore((s) => s.preferredModel)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const tab = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const snippets = useSnippetStore((s) => s.snippets)
  const colors = useColors()
  const isBusy = tab?.status === 'running' || tab?.status === 'connecting'
  const isConnecting = tab?.status === 'connecting'
  const hasContent = input.trim().length > 0 || (tab?.attachments?.length ?? 0) > 0
  const canSend = !!tab && !isConnecting && hasContent
  const attachments = tab?.attachments || []
  const showSlashMenu = slashFilter !== null && !isConnecting
  const skillCommands: SlashCommand[] = (tab?.sessionSkills || []).map((skill) => ({
    command: `/${skill}`,
    description: `Run skill: ${skill}`,
    icon: <Sparkle size={12} />,
  }))
  const snippetCommands: SlashCommand[] = snippets.map((snippet) => ({
    command: snippet.command,
    description: `Snippet: ${snippet.name}`,
    icon: <Lightning size={12} />,
    badge: 'Snippet',
    insertText: snippet.content,
  }))

  useEffect(() => {
    textareaRef.current?.focus()
  }, [activeTabId])

  // Focus textarea when window is shown (shortcut toggle, screenshot return)
  useEffect(() => {
    const unsub = window.clui.onWindowShown(() => {
      textareaRef.current?.focus()
    })
    return unsub
  }, [])

  useEffect(() => {
    const onFocusInput = () => {
      textareaRef.current?.focus()
    }
    window.addEventListener('clui-focus-input', onFocusInput as EventListener)
    return () => window.removeEventListener('clui-focus-input', onFocusInput as EventListener)
  }, [])

  const buildCurrentExportData = useCallback((): SessionExportData | null => {
    if (!tab || tab.messages.length === 0) {
      return null
    }

    const projectPath = tab.hasChosenDirectory
      ? tab.workingDirectory
      : (staticInfo?.homePath || tab.workingDirectory || '~')

    return {
      title: tab.title,
      exportedAt: new Date().toISOString(),
      sessionId: tab.claudeSessionId,
      projectPath,
      model: tab.sessionModel,
      messages: tab.messages,
      lastResult: tab.lastResult,
    }
  }, [tab, staticInfo])

  const measureInlineHeight = useCallback((value: string): number => {
    if (typeof document === 'undefined') return 0
    if (!measureRef.current) {
      const m = document.createElement('textarea')
      m.setAttribute('aria-hidden', 'true')
      m.tabIndex = -1
      m.style.position = 'absolute'
      m.style.top = '-99999px'
      m.style.left = '0'
      m.style.height = '0'
      m.style.minHeight = '0'
      m.style.overflow = 'hidden'
      m.style.visibility = 'hidden'
      m.style.pointerEvents = 'none'
      m.style.zIndex = '-1'
      m.style.resize = 'none'
      m.style.border = '0'
      m.style.outline = '0'
      m.style.boxSizing = 'border-box'
      document.body.appendChild(m)
      measureRef.current = m
    }

    const m = measureRef.current
    const hostWidth = wrapperRef.current?.clientWidth ?? 0
    const inlineWidth = Math.max(120, hostWidth - INLINE_CONTROLS_RESERVED_WIDTH)
    m.style.width = `${inlineWidth}px`
    m.style.fontSize = '14px'
    m.style.lineHeight = '20px'
    m.style.paddingTop = '15px'
    m.style.paddingBottom = '15px'
    m.style.paddingLeft = '0'
    m.style.paddingRight = '0'

    const computed = textareaRef.current ? window.getComputedStyle(textareaRef.current) : null
    if (computed) {
      m.style.fontFamily = computed.fontFamily
      m.style.letterSpacing = computed.letterSpacing
      m.style.fontWeight = computed.fontWeight
    }

    m.value = value || ' '
    return m.scrollHeight
  }, [])

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = `${INPUT_MIN_HEIGHT}px`
    const naturalHeight = el.scrollHeight
    const clampedHeight = Math.min(naturalHeight, INPUT_MAX_HEIGHT)
    el.style.height = `${clampedHeight}px`
    el.style.overflowY = naturalHeight > INPUT_MAX_HEIGHT ? 'auto' : 'hidden'
    if (naturalHeight <= INPUT_MAX_HEIGHT) {
      el.scrollTop = 0
    }
    // Decide multiline mode against fixed inline-width measurement to avoid
    // expand/collapse bounce when layout switches between modes.
    const inlineHeight = measureInlineHeight(input)
    setIsMultiLine((prev) => {
      if (!prev) return inlineHeight > MULTILINE_ENTER_HEIGHT
      return inlineHeight > MULTILINE_EXIT_HEIGHT
    })
  }, [input, measureInlineHeight])

  useLayoutEffect(() => { autoResize() }, [input, isMultiLine, autoResize])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (measureRef.current) {
        measureRef.current.remove()
        measureRef.current = null
      }
    }
  }, [])

  // ─── Slash command detection ───
  const updateSlashFilter = useCallback((value: string) => {
    const match = value.match(/^(\/[a-zA-Z-]*)$/)
    if (match) {
      setSlashFilter(match[1])
      setSlashIndex(0)
    } else {
      setSlashFilter(null)
    }
  }, [])

  // ─── Handle slash commands ───
  const executeCommand = useCallback((cmd: SlashCommand) => {
    switch (cmd.command) {
      case '/clear':
        clearTab()
        addSystemMessage('Conversation cleared.')
        break
      case '/memory':
        void refreshAgentMemory().then((snapshot) => {
          addSystemMessage(formatMemorySnapshot(snapshot || agentMemorySnapshot, activeTabId))
        })
        break
      case '/export': {
        const exportData = buildCurrentExportData()
        if (!exportData) {
          addSystemMessage('Nothing to export in this session.')
        } else {
          openExportDialog(exportData)
        }
        break
      }
      case '/cost': {
        if (tab?.lastResult) {
          const r = tab.lastResult
          const parts = [`$${r.totalCostUsd.toFixed(4)}`, `${(r.durationMs / 1000).toFixed(1)}s`, `${r.numTurns} turn${r.numTurns !== 1 ? 's' : ''}`]
          if (r.usage.input_tokens) {
            parts.push(`${r.usage.input_tokens.toLocaleString()} in / ${(r.usage.output_tokens || 0).toLocaleString()} out`)
          }
          addSystemMessage(parts.join(' · '))
        } else {
          addSystemMessage('No cost data yet — send a message first.')
        }
        break
      }
      case '/model': {
        const model = tab?.sessionModel || null
        const version = tab?.sessionVersion || staticInfo?.version || null
        const current = preferredModel || model || 'default'
        const lines = AVAILABLE_MODELS.map((m) => {
          const active = m.id === current || (!preferredModel && m.id === model)
          return `  ${active ? '\u25CF' : '\u25CB'} ${m.label} (${m.id})`
        })
        const header = version ? `Claude Code ${version}` : 'Claude Code'
        addSystemMessage(`${header}\n\n${lines.join('\n')}\n\nSwitch model: type /model <name>\n  e.g. /model sonnet`)
        break
      }
      case '/mcp': {
        if (tab?.sessionMcpServers && tab.sessionMcpServers.length > 0) {
          const lines = tab.sessionMcpServers.map((s) => {
            const icon = s.status === 'connected' ? '\u2713' : s.status === 'failed' ? '\u2717' : '\u25CB'
            return `  ${icon} ${s.name} — ${s.status}`
          })
          addSystemMessage(`MCP Servers (${tab.sessionMcpServers.length}):\n${lines.join('\n')}`)
        } else if (tab?.claudeSessionId) {
          addSystemMessage('No MCP servers connected in this session.')
        } else {
          addSystemMessage('No MCP data yet — send a message to start a session.')
        }
        break
      }
      case '/skills': {
        if (tab?.sessionSkills && tab.sessionSkills.length > 0) {
          const lines = tab.sessionSkills.map((s) => `/${s}`)
          addSystemMessage(`Available skills (${tab.sessionSkills.length}):\n${lines.join('\n')}`)
        } else if (tab?.claudeSessionId) {
          addSystemMessage('No skills available in this session.')
        } else {
          addSystemMessage('No session metadata yet — send a message first.')
        }
        break
      }
      case '/compare': {
        useComparisonStore.getState().openLauncher()
        break
      }
      case '/workflow': {
        useWorkflowStore.getState().openManager()
        break
      }
      case '/help': {
        const lines = [
          '/clear — Clear conversation history',
          '/compare — Compare two models side-by-side',
          '/export — Export this session to Markdown or JSON',
          '/cost — Show token usage and cost',
          '/model — Show model info & switch models',
          '/mcp — Show MCP server status',
          '/skills — Show available skills',
          '/workflow — Open workflow manager',
          '/help — Show this list',
        ]
        addSystemMessage(lines.join('\n'))
        break
      }
    }
  }, [tab, clearTab, addSystemMessage, staticInfo, preferredModel, refreshAgentMemory, agentMemorySnapshot, activeTabId, buildCurrentExportData, openExportDialog])

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    const isSkillCommand = !!tab?.sessionSkills?.includes(cmd.command.replace(/^\//, ''))
    if (cmd.insertText) {
      setInput(cmd.insertText)
      setSlashFilter(null)
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }
    if (isSkillCommand || cmd.insertOnly) {
      setInput(`${cmd.command} `)
      setSlashFilter(null)
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }
    setInput('')
    setSlashFilter(null)
    executeCommand(cmd)
  }, [executeCommand, tab?.sessionSkills])

  // ─── Send ───
  const handleSend = useCallback(async () => {
    if (showSlashMenu) {
      const filtered = getFilteredCommandsWithExtras(slashFilter!, [...snippetCommands, ...skillCommands])
      if (filtered.length > 0) {
        handleSlashSelect(filtered[slashIndex])
        return
      }
    }
    const prompt = input.trim()
    const clearComposer = () => {
      setInput('')
      setSlashFilter(null)
      if (textareaRef.current) {
        textareaRef.current.style.height = `${INPUT_MIN_HEIGHT}px`
      }
    }

    const focusMatch = prompt.match(/^\/focus\s+(.+)/i)
    if (focusMatch) {
      clearComposer()
      const assignment = await setAgentFocus(focusMatch[1].trim()).catch(() => null)
      addSystemMessage(assignment ? `Focus set: ${formatAssignmentLine(assignment)}` : 'Failed to update shared memory focus.')
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }

    const claimMatch = prompt.match(/^\/claim\s+(\S+)\s+(.+)/i)
    if (claimMatch) {
      clearComposer()
      const result = await claimAgentWork(claimMatch[1], claimMatch[2].trim()).catch(() => null)
      if (!result) {
        addSystemMessage('Failed to claim shared work item.')
      } else if (result.ok) {
        addSystemMessage(`Claimed: ${formatAssignmentLine(result.assignment)}`)
      } else {
        addSystemMessage(`Claim conflict: ${formatAssignmentLine(result.conflict)}`)
      }
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }

    const doneMatch = prompt.match(/^\/done(?:\s+(.+))?$/i)
    if (doneMatch) {
      clearComposer()
      const ok = await markAgentDone(doneMatch[1]?.trim()).catch(() => false)
      addSystemMessage(ok ? 'Marked current work as done.' : 'No active work assignment to mark as done.')
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }

    if (/^\/release$/i.test(prompt)) {
      clearComposer()
      const ok = await releaseAgentWork().catch(() => false)
      addSystemMessage(ok ? 'Released current work assignment.' : 'No active work assignment to release.')
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }

    if (/^\/memory$/i.test(prompt)) {
      clearComposer()
      const snapshot = await refreshAgentMemory().catch(() => null)
      addSystemMessage(formatMemorySnapshot(snapshot || agentMemorySnapshot, activeTabId))
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }

    const modelMatch = prompt.match(/^\/model\s+(\S+)/i)
    if (modelMatch) {
      const query = modelMatch[1].toLowerCase()
      const match = AVAILABLE_MODELS.find((m: { id: string; label: string }) =>
        m.id.toLowerCase().includes(query) || m.label.toLowerCase().includes(query)
      )
      if (match) {
        setPreferredModel(match.id)
        clearComposer()
        addSystemMessage(`Model switched to ${match.label} (${match.id})`)
      } else {
        clearComposer()
        addSystemMessage(`Unknown model "${modelMatch[1]}". Available: opus, sonnet, haiku`)
      }
      return
    }
    if (!prompt && attachments.length === 0) return
    if (isConnecting) return
    clearComposer()

    // Route through comparison store when a comparison is active
    const comparison = useComparisonStore.getState().activeComparison
    if (comparison) {
      useComparisonStore.getState().sendComparisonPrompt(prompt || 'See attached files')
    } else {
      sendMessage(prompt || 'See attached files')
    }
    // Refocus after React re-renders from the state update
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [
    input,
    sendMessage,
    attachments.length,
    showSlashMenu,
    slashFilter,
    slashIndex,
    handleSlashSelect,
    isConnecting,
    setPreferredModel,
    setAgentFocus,
    claimAgentWork,
    markAgentDone,
    releaseAgentWork,
    refreshAgentMemory,
    agentMemorySnapshot,
    activeTabId,
    addSystemMessage,
    snippetCommands,
    skillCommands,
  ])

  // ─── Keyboard ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashMenu) {
      const filtered = getFilteredCommandsWithExtras(slashFilter!, [...snippetCommands, ...skillCommands])
      if (e.key === 'ArrowDown' && filtered.length > 0) { e.preventDefault(); setSlashIndex((i) => (i + 1) % filtered.length); return }
      if (e.key === 'ArrowUp' && filtered.length > 0) { e.preventDefault(); setSlashIndex((i) => (i - 1 + filtered.length) % filtered.length); return }
      if (e.key === 'Tab') { e.preventDefault(); if (filtered.length > 0) handleSlashSelect(filtered[slashIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setSlashFilter(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape' && !showSlashMenu) { window.clui.hideWindow() }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)
    updateSlashFilter(value)
  }

  // ─── Paste image ───
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) return
        const reader = new FileReader()
        reader.onload = async () => {
          const dataUrl = reader.result as string
          const attachment = await window.clui.pasteImage(dataUrl)
          if (attachment) addAttachments([attachment])
        }
        reader.readAsDataURL(blob)
        return
      }
    }
  }, [addAttachments])

  // ─── Voice ───
  const cancelledRef = useRef(false)

  const stopRecording = useCallback(() => {
    cancelledRef.current = false
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }, [])

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }, [])

  const startRecording = useCallback(async () => {
    setVoiceError(null)
    chunksRef.current = []
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setVoiceError('Microphone permission denied.')
      return
    }
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      if (cancelledRef.current) { cancelledRef.current = false; setVoiceState('idle'); return }
      if (chunksRef.current.length === 0) { setVoiceState('idle'); return }
      setVoiceState('transcribing')
      try {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const wavBase64 = await blobToWavBase64(blob)
        const result = await window.clui.transcribeAudio(wavBase64)
        if (result.error) setVoiceError(result.error)
        else if (result.transcript) setInput((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript!))
      } catch (err: any) { setVoiceError(`Voice failed: ${err.message}`) }
      finally { setVoiceState('idle') }
    }
    recorder.onerror = () => { stream.getTracks().forEach((t) => t.stop()); setVoiceError('Recording failed.'); setVoiceState('idle') }
    mediaRecorderRef.current = recorder
    setVoiceState('recording')
    recorder.start()
  }, [])

  const handleVoiceToggle = useCallback(() => {
    if (voiceState === 'recording') stopRecording()
    else if (voiceState === 'idle') void startRecording()
  }, [voiceState, startRecording, stopRecording])

  const hasAttachments = attachments.length > 0

  return (
    <div ref={wrapperRef} data-clui-ui data-testid="composer" className="flex flex-col w-full relative">
      {/* Slash command menu */}
      <AnimatePresence>
        {showSlashMenu && (
          <SlashCommandMenu
            filter={slashFilter!}
            selectedIndex={slashIndex}
            onSelect={handleSlashSelect}
            anchorRect={wrapperRef.current?.getBoundingClientRect() ?? null}
            extraCommands={[...snippetCommands, ...skillCommands]}
          />
        )}
      </AnimatePresence>

      {/* Attachment chips — renders inside the pill, above textarea */}
      {hasAttachments && (
        <div style={{ paddingTop: 6, marginLeft: -6 }}>
          <AttachmentChips attachments={attachments} onRemove={removeAttachment} />
        </div>
      )}

      {/* Single-line: inline controls. Multi-line: controls in bottom row */}
      <div className="w-full" style={{ minHeight: 50 }}>
        {isMultiLine ? (
          <div className="w-full">
            <textarea
              id="clui-main-input"
              ref={textareaRef}
              data-testid="composer-input"
              aria-label="Message Claude"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                isConnecting
                  ? 'Initializing...'
                  : voiceState === 'recording'
                    ? 'Recording... ✓ to confirm, ✕ to cancel'
                    : voiceState === 'transcribing'
                      ? 'Transcribing...'
                      : isBusy
                        ? 'Type to queue a message...'
                        : 'Ask Claude Code anything...'
              }
              rows={1}
              className="w-full bg-transparent resize-none"
              style={{
                fontSize: 14,
                lineHeight: '20px',
                color: colors.textPrimary,
                minHeight: 20,
                maxHeight: INPUT_MAX_HEIGHT,
                paddingTop: 11,
                paddingBottom: 2,
              }}
            />

            <div className="flex items-center justify-end gap-1" style={{ marginTop: 0, paddingBottom: 4 }}>
              <VoiceButtons
                voiceState={voiceState}
                isConnecting={isConnecting}
                colors={colors}
                onToggle={handleVoiceToggle}
                onCancel={cancelRecording}
                onStop={stopRecording}
              />
              <AnimatePresence>
                {canSend && voiceState !== 'recording' && (
                  <motion.div key="send" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.1 }}>
                    <button
                      data-testid="composer-send"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSend}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                      style={{ background: colors.sendBg, color: colors.textOnAccent }}
                      title={isBusy ? 'Queue message' : 'Send (Enter)'}
                    >
                      <ArrowUp size={16} weight="bold" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex items-center w-full" style={{ minHeight: 50 }}>
            <textarea
              id="clui-main-input"
              ref={textareaRef}
              data-testid="composer-input"
              aria-label="Message Claude"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                isConnecting
                  ? 'Initializing...'
                  : voiceState === 'recording'
                    ? 'Recording... ✓ to confirm, ✕ to cancel'
                    : voiceState === 'transcribing'
                      ? 'Transcribing...'
                      : isBusy
                        ? 'Type to queue a message...'
                        : 'Ask Claude Code anything...'
              }
              rows={1}
              className="flex-1 bg-transparent resize-none"
              style={{
                fontSize: 14,
                lineHeight: '20px',
                color: colors.textPrimary,
                minHeight: 20,
                maxHeight: INPUT_MAX_HEIGHT,
                paddingTop: 15,
                paddingBottom: 15,
              }}
            />

            <div className="flex items-center gap-1 shrink-0 ml-2">
              <VoiceButtons
                voiceState={voiceState}
                isConnecting={isConnecting}
                colors={colors}
                onToggle={handleVoiceToggle}
                onCancel={cancelRecording}
                onStop={stopRecording}
              />
              <AnimatePresence>
                {canSend && voiceState !== 'recording' && (
                  <motion.div key="send" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.1 }}>
                    <button
                      data-testid="composer-send"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleSend}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                      style={{ background: colors.sendBg, color: colors.textOnAccent }}
                      title={isBusy ? 'Queue message' : 'Send (Enter)'}
                    >
                      <ArrowUp size={16} weight="bold" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Voice error */}
      {voiceError && (
        <div className="px-1 pb-2 text-[11px]" style={{ color: colors.statusError }}>
          {voiceError}
        </div>
      )}
    </div>
  )
}

// ─── Voice Buttons (extracted to avoid duplication) ───

function VoiceButtons({ voiceState, isConnecting, colors, onToggle, onCancel, onStop }: {
  voiceState: VoiceState
  isConnecting: boolean
  colors: ReturnType<typeof useColors>
  onToggle: () => void
  onCancel: () => void
  onStop: () => void
}) {
  return (
    <AnimatePresence mode="wait">
      {voiceState === 'recording' ? (
        <motion.div
          key="voice-controls"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.12 }}
          className="flex items-center gap-1"
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancel}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: colors.surfaceHover, color: colors.textTertiary }}
            title="Cancel recording"
          >
            <X size={15} weight="bold" />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onStop}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: colors.accent, color: colors.textOnAccent }}
            title="Confirm recording"
          >
            <Check size={15} weight="bold" />
          </button>
        </motion.div>
      ) : voiceState === 'transcribing' ? (
        <motion.div key="transcribing" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.1 }}>
          <button
            disabled
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: colors.micBg, color: colors.micColor }}
          >
            <SpinnerGap size={16} className="animate-spin" />
          </button>
        </motion.div>
      ) : (
        <motion.div key="mic" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.1 }}>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggle}
            disabled={isConnecting}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: colors.micBg,
              color: isConnecting ? colors.micDisabled : colors.micColor,
            }}
            title="Voice input"
          >
            <Microphone size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Audio conversion: WebM blob → WAV base64 ───

async function blobToWavBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext({ sampleRate: 16000 })
  const decoded = await audioCtx.decodeAudioData(arrayBuffer)
  audioCtx.close()
  const samples = decoded.getChannelData(0)
  const wavBuffer = encodeWav(samples, 16000)
  return bufferToBase64(wavBuffer)
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, numSamples * 2, true)
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }
  return buffer
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
