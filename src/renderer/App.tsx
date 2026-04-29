import React, { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, Camera, HeadCircuit } from '@phosphor-icons/react'
import { TabStrip } from './components/TabStrip'
import { ConversationView } from './components/ConversationView'
import { InputBar } from './components/InputBar'
import { StatusBar } from './components/StatusBar'
import { MarketplacePanel } from './components/MarketplacePanel'
import { PopoverLayerProvider } from './components/PopoverLayer'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { useSessionStore } from './stores/sessionStore'
import { useColors, useThemeStore, spacing } from './theme'

const TRANSITION = { duration: 0.26, ease: [0.4, 0, 0.1, 1] as const }
const DEFAULT_BODY_HEIGHT = 400
const DEFAULT_WIDE_BODY_HEIGHT = 520
const MIN_BODY_HEIGHT = 300
const MAX_BODY_HEIGHT = 590

export default function App() {
  useClaudeEvents()
  useHealthReconciliation()

  const activeTabStatus = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.status)
  const addAttachments = useSessionStore((s) => s.addAttachments)
  const colors = useColors()
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)
  const expandedUI = useThemeStore((s) => s.expandedUI)

  // ─── Theme initialization ───
  useEffect(() => {
    // Get initial OS theme — setSystemTheme respects themeMode (system/light/dark)
    window.clui.getTheme().then(({ isDark }) => {
      setSystemTheme(isDark)
    }).catch(() => {})

    // Listen for OS theme changes
    const unsub = window.clui.onThemeChange((isDark) => {
      setSystemTheme(isDark)
    })
    return unsub
  }, [setSystemTheme])

  useEffect(() => {
    useSessionStore.getState().initStaticInfo().then(() => {
      const homeDir = useSessionStore.getState().staticInfo?.homePath || '~'
      const tab = useSessionStore.getState().tabs[0]
      if (tab) {
        // Set working directory to home by default (user hasn't chosen yet)
        useSessionStore.setState((s) => ({
          tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, workingDirectory: homeDir, hasChosenDirectory: false } : t)),
        }))
        window.clui.createTab().then(({ tabId }) => {
          useSessionStore.setState((s) => ({
            tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, id: tabId } : t)),
            activeTabId: tabId,
          }))
        }).catch(() => {})
      }
    })
  }, [])

  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; dragging: boolean } | null>(null)
  const resizeRef = useRef<{ pointerId: number; startY: number; startHeight: number; edge: 'top' | 'bottom' } | null>(null)
  const [customBodyHeight, setCustomBodyHeight] = useState<number | null>(null)

  useEffect(() => {
    if (!window.clui?.setIgnoreMouseEvents) return
    let lastIgnored: boolean | null = null

    const setIgnored = (ignored: boolean) => {
      if (lastIgnored === ignored) return
      lastIgnored = ignored
      window.clui.setIgnoreMouseEvents(ignored, ignored ? { forward: true } : undefined)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (dragRef.current || resizeRef.current) {
        setIgnored(false)
        return
      }
      const el = document.elementFromPoint(e.clientX, e.clientY)
      setIgnored(!el?.closest('[data-clui-ui]'))
    }

    document.addEventListener('mousemove', onMouseMove)
    return () => document.removeEventListener('mousemove', onMouseMove)
  }, [])

  useEffect(() => {
    const interactiveSelector = [
      'button',
      'input',
      'textarea',
      'select',
      'a',
      '[role="button"]',
      '[contenteditable]',
      '[data-clui-resize-handle]',
      '[data-clui-interactive]',
      '.cm-editor',
      '.conversation-selectable',
    ].join(', ')

    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      if (!el?.closest('[data-clui-ui]')) return
      if (el.closest(interactiveSelector)) return
      dragRef.current = { pointerId: e.pointerId, startX: e.screenX, startY: e.screenY, dragging: false }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (dragRef.current && e.pointerId === dragRef.current.pointerId) {
        const dx = e.screenX - dragRef.current.startX
        const dy = e.screenY - dragRef.current.startY
        if (dx !== 0 || dy !== 0) {
          if (!dragRef.current.dragging && Math.abs(dx) + Math.abs(dy) < 4) return
          dragRef.current.dragging = true
          e.preventDefault()
          e.stopPropagation()
          window.clui?.setIgnoreMouseEvents?.(false)
          window.clui?.startWindowDrag?.(dx, dy)
          dragRef.current.startX = e.screenX
          dragRef.current.startY = e.screenY
        }
        return
      }

      if (!resizeRef.current) return
      if (e.pointerId !== resizeRef.current.pointerId) return
      const deltaY = e.screenY - resizeRef.current.startY
      const next = resizeRef.current.edge === 'top'
        ? resizeRef.current.startHeight - deltaY
        : resizeRef.current.startHeight + deltaY
      setCustomBodyHeight(Math.max(MIN_BODY_HEIGHT, Math.min(MAX_BODY_HEIGHT, next)))
    }
    const onPointerUp = (e: PointerEvent) => {
      if (dragRef.current && e.pointerId === dragRef.current.pointerId) {
        const wasDragging = dragRef.current.dragging
        dragRef.current = null
        if (!wasDragging) {
          const el = e.target as HTMLElement | null
          if (el?.closest('[data-clui-ui]') && !el.closest(interactiveSelector)) {
            window.clui?.hideWindow?.()
          }
        }
      }
      if (resizeRef.current && e.pointerId === resizeRef.current.pointerId) {
        resizeRef.current = null
      }
      document.body.style.cursor = ''
      window.clui?.setIgnoreMouseEvents?.(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', onPointerUp, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerUp, true)
    }
  }, [])

  const isExpanded = useSessionStore((s) => s.isExpanded)
  const marketplaceOpen = useSessionStore((s) => s.marketplaceOpen)
  const isRunning = activeTabStatus === 'running' || activeTabStatus === 'connecting'

  // Layout dimensions — expandedUI widens and heightens the panel
  const contentWidth = expandedUI ? 700 : spacing.contentWidth
  const cardExpandedWidth = expandedUI ? 700 : 460
  const cardCollapsedWidth = expandedUI ? 670 : 430
  const cardCollapsedMargin = expandedUI ? 15 : 15
  const defaultBodyHeight = expandedUI ? DEFAULT_WIDE_BODY_HEIGHT : DEFAULT_BODY_HEIGHT
  const bodyMaxHeight = customBodyHeight ?? defaultBodyHeight
  const conversationMaxHeight = Math.max(220, bodyMaxHeight - 64)

  useEffect(() => {
    const nextHeight = isExpanded
      ? Math.min(720, Math.max(520, bodyMaxHeight + 130))
      : 142
    window.clui?.resizeHeight?.(nextHeight)
  }, [isExpanded, bodyMaxHeight])

  useEffect(() => {
    const nextWidth = Math.ceil(Math.max(
      contentWidth + 190,
      marketplaceOpen ? 900 : 0,
    ))
    window.clui?.setWindowWidth?.(nextWidth)
  }, [contentWidth, marketplaceOpen])

  const startResize = useCallback((e: React.PointerEvent<HTMLElement>, edge: 'top' | 'bottom') => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    window.clui?.setIgnoreMouseEvents?.(false)
    resizeRef.current = { pointerId: e.pointerId, startY: e.screenY, startHeight: bodyMaxHeight, edge }
    document.body.style.cursor = 'ns-resize'
  }, [bodyMaxHeight])

  const handleScreenshot = useCallback(async () => {
    const result = await window.clui.takeScreenshot()
    if (!result) return
    addAttachments([result])
  }, [addAttachments])

  const handleAttachFile = useCallback(async () => {
    const files = await window.clui.attachFiles()
    if (!files || files.length === 0) return
    addAttachments(files)
  }, [addAttachments])

  return (
    <PopoverLayerProvider>
      <div className="flex flex-col justify-end h-full" style={{ background: 'transparent' }}>

        {/* ─── 460px content column, centered. Circles overflow left. ─── */}
        <div style={{ width: contentWidth, position: 'relative', margin: '0 0 0 auto', transition: 'width 0.26s cubic-bezier(0.4, 0, 0.1, 1)', transform: 'translateY(var(--clui-card-y, 0px))' }}>

          <AnimatePresence initial={false}>
            {marketplaceOpen && (
              <div
                data-clui-ui
                style={{
                  width: 720,
                  maxWidth: 720,
                  marginLeft: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  position: 'relative',
                  zIndex: 30,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={TRANSITION}
                >
                  <div
                    data-clui-ui
                    className="glass-surface overflow-hidden no-drag"
                    style={{
                      borderRadius: 24,
                      maxHeight: 470,
                    }}
                  >
                    <MarketplacePanel />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/*
            ─── Tabs / message shell ───
            This always remains the chat shell. The marketplace is a separate
            panel rendered above it, never inside it.
          */}
          <motion.div
            data-clui-ui
            className="overflow-hidden flex flex-col"
            animate={{
              width: isExpanded ? cardExpandedWidth : cardCollapsedWidth,
              marginBottom: isExpanded ? 10 : -14,
              marginLeft: isExpanded ? 0 : cardCollapsedMargin,
              marginRight: isExpanded ? 0 : cardCollapsedMargin,
              background: isExpanded ? colors.containerBg : colors.containerBgCollapsed,
              borderColor: colors.containerBorder,
              boxShadow: isExpanded ? colors.cardShadow : colors.cardShadowCollapsed,
            }}
            transition={TRANSITION}
            style={{
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 20,
              position: 'relative',
              zIndex: isExpanded ? 20 : 10,
            }}
          >
            {isExpanded && (
              <div
                data-clui-resize-handle
                data-clui-ui
                className="no-drag"
                title="Drag to resize chat height"
                onPointerDown={(e) => startResize(e, 'top')}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCustomBodyHeight(null)
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 16,
                  right: 16,
                  height: 14,
                  cursor: 'ns-resize',
                  zIndex: 40,
                }}
              />
            )}
            {/* Tab strip — always mounted */}
            <div>
              <TabStrip />
            </div>

            {/* Body — chat history only; the marketplace is a separate overlay above */}
            <motion.div
              initial={false}
              animate={{
                height: isExpanded ? 'auto' : 0,
                opacity: isExpanded ? 1 : 0,
              }}
              transition={TRANSITION}
              className="overflow-hidden no-drag"
            >
              <div
                style={{
                  height: bodyMaxHeight,
                  maxHeight: bodyMaxHeight,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
                  <ConversationView maxHeight={conversationMaxHeight} />
                </div>
                {isExpanded && (
                  <div
                    data-clui-resize-handle
                    data-clui-ui
                    className="no-drag flex items-center justify-center"
                    style={{
                      height: 18,
                      cursor: 'ns-resize',
                      color: colors.textMuted,
                      marginTop: -2,
                      marginBottom: -2,
                      background: 'transparent',
                    }}
                    title="Drag to resize chat height"
                    onPointerDown={(e) => startResize(e, 'bottom')}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCustomBodyHeight(null)
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 4,
                        borderRadius: 999,
                        background: colors.containerBorder,
                        opacity: 0.9,
                      }}
                    />
                  </div>
                )}
                <StatusBar />
              </div>
            </motion.div>
          </motion.div>

          {/* ─── Input row — circles float outside left ─── */}
          {/* marginBottom: shadow buffer so the glass-surface drop shadow isn't clipped at the native window edge */}
          <div data-clui-ui className="relative" style={{ minHeight: 46, zIndex: 15, marginBottom: 10 }}>
            {/* Stacked circle buttons — expand on hover */}
            <div
              data-clui-ui
              className="circles-out"
            >
              <div className="btn-stack">
                {/* btn-1: Attach (front, rightmost) */}
                <button
                  className="stack-btn stack-btn-1 glass-surface"
                  title="Attach file"
                  onClick={handleAttachFile}
                  disabled={isRunning}
                >
                  <Paperclip size={17} />
                </button>
                {/* btn-2: Screenshot (middle) */}
                <button
                  className="stack-btn stack-btn-2 glass-surface"
                  title="Take screenshot"
                  onClick={handleScreenshot}
                  disabled={isRunning}
                >
                  <Camera size={17} />
                </button>
                {/* btn-3: Skills (back, leftmost) */}
                <button
                  className="stack-btn stack-btn-3 glass-surface"
                  title="Skills & Plugins"
                  onClick={() => useSessionStore.getState().toggleMarketplace()}
                  disabled={isRunning}
                >
                  <HeadCircuit size={17} />
                </button>
              </div>
            </div>

            {/* Input pill */}
            <div
              data-clui-ui
              className="glass-surface w-full"
              style={{ minHeight: 50, borderRadius: 25, padding: '0 6px 0 16px', background: colors.inputPillBg }}
            >
              <InputBar />
            </div>
          </div>
        </div>
      </div>
    </PopoverLayerProvider>
  )
}
