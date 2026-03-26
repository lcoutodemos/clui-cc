import React, { useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, Camera, HeadCircuit } from '@phosphor-icons/react'
import { TabStrip } from './components/TabStrip'
import { ConversationView } from './components/ConversationView'
import { InputBar } from './components/InputBar'
import { StatusBar } from './components/StatusBar'
import { MarketplacePanel } from './components/MarketplacePanel'
import { SettingsContent } from './components/SettingsPopover'
import { HistoryContent } from './components/HistoryPicker'
import { PopoverLayerProvider } from './components/PopoverLayer'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { useSessionStore } from './stores/sessionStore'
import { useColors, useThemeStore, spacing } from './theme'

const TRANSITION = { duration: 0.26, ease: [0.4, 0, 0.1, 1] as const }

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

  // Shared drag ref — must be declared before the setIgnoreMouseEvents effect so both closures can read it
  const dragRef = useRef<{ startX: number; startY: number } | null>(null)

  // Vertical position tracking — window moves first (until macOS clamps it), then CSS overflows
  const PILL_HEIGHT_CONST = 720
  const PILL_BOTTOM_MARGIN_CONST = 24
  const minWindowY = window.screen.availTop   // top of work area (below menu bar)
  const initialWindowY = window.screen.availTop + window.screen.availHeight - PILL_HEIGHT_CONST - PILL_BOTTOM_MARGIN_CONST
  const windowYRef = useRef(initialWindowY)
  const cardYRef = useRef(0) // CSS translateY offset (only used after window hits its y constraint)

  // OS-level click-through (RAF-throttled to avoid per-pixel IPC)
  useEffect(() => {
    if (!window.clui?.setIgnoreMouseEvents) return
    let lastIgnored: boolean | null = null

    const onMouseMove = (e: MouseEvent) => {
      // While dragging, keep full mouse capture — don't toggle ignore-events
      if (dragRef.current) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const isUI = !!(el && el.closest('[data-clui-ui]'))
      const shouldIgnore = !isUI
      if (shouldIgnore !== lastIgnored) {
        lastIgnored = shouldIgnore
        if (shouldIgnore) {
          window.clui.setIgnoreMouseEvents(true, { forward: true })
        } else {
          window.clui.setIgnoreMouseEvents(false)
        }
      }
    }

    const onMouseLeave = () => {
      if (dragRef.current) return
      if (lastIgnored !== true) {
        lastIgnored = true
        window.clui.setIgnoreMouseEvents(true, { forward: true })
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // Manual window drag — bypasses -webkit-app-region conflicts with setIgnoreMouseEvents
  useEffect(() => {
    if (!window.clui?.startWindowDrag) return

    const onMouseDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      // Skip interactive elements — everything else on the card is draggable
      if (el.closest('button, input, textarea, a, select, [role="button"], [contenteditable], .cm-editor')) return
      if (!el.closest('[data-clui-ui]')) return
      e.preventDefault()
      // Double-click: snap back to default position
      if (e.detail >= 2) {
        window.clui.resetWindowPosition()
        windowYRef.current = initialWindowY
        cardYRef.current = 0
        document.documentElement.style.setProperty('--clui-card-y', '0px')
        return
      }
      // Ensure full mouse capture for the duration of the drag
      window.clui.setIgnoreMouseEvents(false)
      dragRef.current = { startX: e.screenX, startY: e.screenY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const dx = e.screenX - dragRef.current.startX
      const dy = e.screenY - dragRef.current.startY
      if (dx !== 0 || dy !== 0) {
        // Horizontal: always native window movement (full screen width range)
        if (dx !== 0) window.clui.startWindowDrag(dx, 0)
        // Vertical: move window first (until macOS y constraint), then CSS within window
        if (dy !== 0) {
          if (dy < 0) {
            // Moving up — window first, then CSS overflow
            const windowCanMove = windowYRef.current - minWindowY
            const windowDy = Math.max(-windowCanMove, dy)
            const cssDy = dy - windowDy
            if (windowDy !== 0) {
              window.clui.startWindowDrag(0, windowDy)
              windowYRef.current += windowDy
            }
            if (cssDy !== 0) {
              cardYRef.current += cssDy
              document.documentElement.style.setProperty('--clui-card-y', `${cardYRef.current}px`)
            }
          } else {
            // Moving down — undo CSS first, then move window
            const cssUndo = Math.min(-cardYRef.current, dy)
            const windowDy = dy - cssUndo
            if (cssUndo !== 0) {
              cardYRef.current += cssUndo
              document.documentElement.style.setProperty('--clui-card-y', `${cardYRef.current}px`)
            }
            if (windowDy !== 0) {
              window.clui.startWindowDrag(0, windowDy)
              windowYRef.current += windowDy
            }
          }
        }
        dragRef.current.startX = e.screenX
        dragRef.current.startY = e.screenY
      }
    }

    const onMouseUp = () => {
      dragRef.current = null
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const isExpanded = useSessionStore((s) => s.isExpanded)
  const marketplaceOpen = useSessionStore((s) => s.marketplaceOpen)
  const historyOpen = useSessionStore((s) => s.historyOpen)
  const settingsOpen = useThemeStore((s) => s.settingsOpen)
  const isRunning = activeTabStatus === 'running' || activeTabStatus === 'connecting'

  const pillScale = useThemeStore((s) => s.pillScale)
  const scale = pillScale / 100

  // Layout dimensions — expandedUI widens and heightens the panel, pillScale scales horizontally
  const contentWidth = Math.round((expandedUI ? 700 : spacing.contentWidth) * scale)
  const cardExpandedWidth = Math.round((expandedUI ? 700 : 460) * scale)
  const cardCollapsedWidth = Math.round((expandedUI ? 670 : 430) * scale)
  const cardCollapsedMargin = expandedUI ? 15 : 15
  const bodyMaxHeight = expandedUI ? 520 : 400

  // Mutual exclusion: when settings opens, close history + marketplace + collapse chat
  useEffect(() => {
    if (settingsOpen) {
      const ss = useSessionStore.getState()
      if (ss.historyOpen) useSessionStore.setState({ historyOpen: false })
      if (ss.marketplaceOpen) useSessionStore.setState({ marketplaceOpen: false })
      if (ss.isExpanded) useSessionStore.setState({ isExpanded: false })
    }
  }, [settingsOpen])

  // Close settings on click outside the settings panel
  useEffect(() => {
    if (!settingsOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.('[data-settings-panel]') || target.closest?.('[data-settings-trigger]')) return
      useThemeStore.getState().toggleSettings()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [settingsOpen])

  // Close history on click outside the history panel
  useEffect(() => {
    if (!historyOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.('[data-history-panel]') || target.closest?.('[data-history-trigger]')) return
      useSessionStore.setState({ historyOpen: false })
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [historyOpen])

  // Close history when width slider starts dragging
  useEffect(() => {
    const onScaleStart = () => {
      if (useSessionStore.getState().historyOpen) useSessionStore.setState({ historyOpen: false })
    }
    window.addEventListener('clui-scale-start', onScaleStart)
    return () => window.removeEventListener('clui-scale-start', onScaleStart)
  }, [])

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
        <div data-clui-column style={{ width: contentWidth, position: 'relative', margin: '0 auto', transition: 'width 0.08s linear', transform: 'translateY(var(--clui-card-y, 0px))' }}>

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

          <AnimatePresence initial={false}>
            {settingsOpen && !marketplaceOpen && (
              <div
                data-clui-ui
                data-settings-panel
                style={{
                  width: isExpanded ? cardExpandedWidth : cardCollapsedWidth,
                  marginLeft: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  transition: 'width 0.12s linear',
                  position: 'relative',
                  zIndex: 25,
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
                    className="glass-surface no-drag"
                    style={{ borderRadius: 24, maxHeight: 400, overflowY: 'auto' as const }}
                  >
                    <SettingsContent />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {historyOpen && !marketplaceOpen && !settingsOpen && (
              <div
                data-clui-ui
                data-history-panel
                style={{
                  width: isExpanded ? cardExpandedWidth : cardCollapsedWidth,
                  marginLeft: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  position: 'relative',
                  zIndex: 25,
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
                    className="glass-surface no-drag"
                    style={{ borderRadius: 24, maxHeight: 350, overflowY: 'auto' as const }}
                  >
                    <HistoryContent />
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
            className="overflow-hidden flex flex-col drag-region"
            animate={{
              marginBottom: isExpanded ? 10 : -14,
              marginLeft: isExpanded ? 0 : cardCollapsedMargin,
              marginRight: isExpanded ? 0 : cardCollapsedMargin,
              background: isExpanded ? colors.containerBg : colors.containerBgCollapsed,
              borderColor: colors.containerBorder,
              boxShadow: isExpanded ? colors.cardShadow : colors.cardShadowCollapsed,
            }}
            transition={TRANSITION}
            style={{
              width: isExpanded ? cardExpandedWidth : cardCollapsedWidth,
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 20,
              position: 'relative',
              zIndex: isExpanded ? 20 : 10,
              transition: 'width 0.08s linear',
            }}
          >
            {/* Tab strip — always mounted */}
            <div className="no-drag">
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
              <div style={{ maxHeight: bodyMaxHeight }}>
                <ConversationView />
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
