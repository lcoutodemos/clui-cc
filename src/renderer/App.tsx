import React, { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, Camera, HeadCircuit } from '@phosphor-icons/react'
import { TabStrip } from './components/TabStrip'
import { ConversationView } from './components/ConversationView'
import { ComparisonView } from './components/ComparisonView'
import { ComparisonLauncher } from './components/ComparisonLauncher'
import { InputBar } from './components/InputBar'
import { StatusBar } from './components/StatusBar'
import { MarketplacePanel } from './components/MarketplacePanel'
import { CostDashboard } from './components/CostDashboard'
import { SnippetManager } from './components/SnippetManager'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ExportDialog } from './components/ExportDialog'
import { ShortcutSettings } from './components/ShortcutSettings'
import { PermissionWizard } from './components/PermissionWizard'
import { CommandPalette } from './components/CommandPalette'
import { GitPanel } from './components/GitPanel'
import { WorkflowManager } from './components/WorkflowManager'
import { WorkflowEditor } from './components/WorkflowEditor'
import { WorkflowProgress } from './components/WorkflowProgress'
import { ToastContainer } from './components/ToastContainer'
import { PopoverLayerProvider } from './components/PopoverLayer'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { keyboardEventToShortcut } from '../shared/keyboard-shortcuts'
import { useExportStore } from './stores/exportStore'
import { useShortcutStore } from './stores/shortcutStore'
import { useSessionStore } from './stores/sessionStore'
import { useSnippetStore } from './stores/snippetStore'
import { useCommandPaletteStore } from './stores/commandPaletteStore'
import { orderTabsByTabOrder, reconcileTabOrder, replaceTabOrderId, saveStoredTabOrder } from './stores/tabOrder'
import { useComparisonStore } from './stores/comparisonStore'
import { useMarketplaceStore } from './stores/marketplaceStore'
import { useWorkflowStore } from './stores/workflowStore'
import { useTerminalStore } from './stores/terminalStore'
import { TerminalPanel } from './components/TerminalPanel'
import { ModeToggle } from './components/ModeToggle'
import { FilePeekPanel } from './components/FilePeekPanel'
import { FileContextMenu } from './components/FileContextMenu'
import { useColors, useThemeStore, spacing } from './theme'
import { useFilePeekStore } from './stores/filePeekStore'
import { useContextMenuStore } from './stores/contextMenuStore'
import { useNotificationStore } from './stores/notificationStore'

const TRANSITION = { duration: 0.26, ease: [0.4, 0, 0.1, 1] as const }

export default function App() {
  useClaudeEvents()
  useHealthReconciliation()

  const activeTabStatus = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.status)
  const addAttachments = useSessionStore((s) => s.addAttachments)
  const colors = useColors()
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)
  const expandedUI = useThemeStore((s) => s.expandedUI)
  const isExpanded = useSessionStore((s) => s.isExpanded)
  const marketplaceOpen = useMarketplaceStore((s) => s.open)
  const costDashboardOpen = useSessionStore((s) => s.costDashboardOpen)
  const snippetManagerOpen = useSnippetStore((s) => s.managerOpen)
  const exportDialogOpen = useExportStore((s) => s.isOpen)
  const shortcutBindings = useShortcutStore((s) => s.bindings)
  const shortcutSettingsOpen = useShortcutStore((s) => s.settingsOpen)
  const captureTargetId = useShortcutStore((s) => s.captureTargetId)
  const workflowManagerOpen = useWorkflowStore((s) => s.managerOpen)
  const workflowEditorOpen = useWorkflowStore((s) => s.editorOpen)
  const workflowExecution = useWorkflowStore((s) => s.activeExecution)
  const activeComparison = useComparisonStore((s) => s.activeComparison)
  const comparisonLauncherOpen = useComparisonStore((s) => s.launcherOpen)
  const terminalMode = useTerminalStore((s) => s.terminalMode)
  const filePeekOpen = useFilePeekStore((s) => s.isOpen)
  const contextMenuOpen = useContextMenuStore((s) => s.isOpen)
  const isRunning = activeTabStatus === 'running' || activeTabStatus === 'connecting'
  const [showPermissionWizard, setShowPermissionWizard] = useState(false)
  const [gitPanelOpen, setGitPanelOpen] = useState(false)

  // ─── Git panel toggle (from command palette) ───
  useEffect(() => {
    const handler = () => setGitPanelOpen((v) => !v)
    window.addEventListener('clui-toggle-git-panel', handler)
    return () => window.removeEventListener('clui-toggle-git-panel', handler)
  }, [])

  // ─── Permission wizard check (first launch) ───
  useEffect(() => {
    window.clui.needsPermissionSetup().then((needs) => {
      if (needs) setShowPermissionWizard(true)
    }).catch(() => {})
  }, [])

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

  // ─── Terminal availability check ───
  useEffect(() => {
    useTerminalStore.getState().checkAvailability()
  }, [])

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
          useSessionStore.setState((s) => {
            const nextTabs = s.tabs.map((t, i) => (i === 0 ? { ...t, id: tabId } : t))
            const nextOrder = reconcileTabOrder(
              replaceTabOrderId(s.tabOrder, s.tabs[0]?.id || tabId, tabId),
              nextTabs,
            )
            return {
              tabs: orderTabsByTabOrder(nextTabs, nextOrder),
              tabOrder: nextOrder,
              activeTabId: tabId,
            }
          })
          saveStoredTabOrder(useSessionStore.getState().tabOrder)
        }).catch(() => {})
      }
    })
  }, [])

  // ─── Internal keyboard shortcuts ───
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (captureTargetId) return

      const combo = keyboardEventToShortcut(e)
      if (!combo) return

      const binding = shortcutBindings.find((item) => item.currentKeys === combo)
      if (!binding) return

      const session = useSessionStore.getState()
      e.preventDefault()

      switch (binding.id) {
        case 'next-tab': {
          if (session.tabs.length < 2) return
          const currentIndex = session.tabs.findIndex((tab) => tab.id === session.activeTabId)
          const nextIndex = (currentIndex + 1) % session.tabs.length
          session.selectTab(session.tabs[nextIndex].id)
          break
        }
        case 'previous-tab': {
          if (session.tabs.length < 2) return
          const currentIndex = session.tabs.findIndex((tab) => tab.id === session.activeTabId)
          const nextIndex = (currentIndex - 1 + session.tabs.length) % session.tabs.length
          session.selectTab(session.tabs[nextIndex].id)
          break
        }
        case 'new-tab':
          void session.createTab()
          break
        case 'move-tab-left':
          session.moveActiveTab('left')
          break
        case 'move-tab-right':
          session.moveActiveTab('right')
          break
        case 'close-tab':
          if (session.tabs.length > 1) {
            session.closeTab(session.activeTabId)
          }
          break
        case 'toggle-expand':
          session.toggleExpanded()
          break
        case 'focus-input':
          if (!session.isExpanded) {
            session.toggleExpanded()
          }
          window.dispatchEvent(new Event('clui-focus-input'))
          break
        case 'command-palette':
          useCommandPaletteStore.getState().toggle()
          break
        case 'open-history':
          if (!session.isExpanded) {
            session.toggleExpanded()
          }
          window.dispatchEvent(new Event('clui-open-history'))
          break
        case 'open-marketplace':
          session.toggleMarketplace()
          break
        case 'toggle-theme': {
          const theme = useThemeStore.getState()
          theme.setThemeMode(theme.themeMode === 'dark' ? 'light' : 'dark')
          break
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcutBindings, captureTargetId])

  // ─── Terminal toggle shortcut (Ctrl+`) ───
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        useTerminalStore.getState().toggleMode()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // OS-level click-through (RAF-throttled to avoid per-pixel IPC)
  useEffect(() => {
    if (!window.clui?.setIgnoreMouseEvents) return
    let lastIgnored: boolean | null = null

    const onMouseMove = (e: MouseEvent) => {
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

  // Show shortcut hint toast on first launch
  useEffect(() => {
    const HINT_KEY = 'clui:shortcutHintShown'
    if (localStorage.getItem(HINT_KEY)) return
    const cleanup = window.clui.onShortcutRegistered((shortcut: string) => {
      const display = shortcut.replace('CommandOrControl', 'Ctrl').replace('Alt', 'Alt')
      useNotificationStore.getState().addToast({
        type: 'info',
        title: `Press ${display} to show/hide Clui`,
        message: 'Ctrl+Shift+K also works as backup',
        duration: 8000,
      })
      localStorage.setItem(HINT_KEY, '1')
    })
    return cleanup
  }, [])

  // Layout dimensions — expandedUI widens and heightens the panel; terminal/comparison mode widens further
  const isComparing = !!activeComparison
  const effectiveExpanded = isExpanded || terminalMode // terminal forces expanded
  const contentWidth = isComparing ? 900 : terminalMode ? 700 : expandedUI ? 700 : spacing.contentWidth
  const cardExpandedWidth = isComparing ? 900 : terminalMode ? 700 : expandedUI ? 700 : 460
  const cardCollapsedWidth = expandedUI ? 670 : 430
  const cardCollapsedMargin = expandedUI ? 15 : 15
  const bodyMaxHeight = isComparing ? 520 : terminalMode ? 520 : expandedUI ? 520 : 400

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
      {/* Skip to main input — visually hidden, shown on focus for keyboard users */}
      <a
        href="#clui-main-input"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1 focus:rounded focus:text-[12px]"
        style={{ background: colors.accent, color: '#fff' }}
        onClick={(e) => {
          e.preventDefault()
          const input = document.getElementById('clui-main-input')
          if (input) { input.focus(); input.scrollIntoView() }
        }}
      >
        Skip to input
      </a>
      <ErrorBoundary>
        <CommandPalette />
        <ToastContainer />
        <GitPanel open={gitPanelOpen} onClose={() => setGitPanelOpen(false)} />
        {contextMenuOpen && <FileContextMenu />}
        <div data-testid="app-root" className="flex flex-col justify-end h-full" style={{ background: 'transparent' }}>

        {/* ─── 460px content column, centered. Circles overflow left. ─── */}
        <div style={{ width: contentWidth, position: 'relative', margin: '0 auto', transition: 'width 0.26s cubic-bezier(0.4, 0, 0.1, 1)' }}>

          {/* ─── Permission wizard (first launch) ─── */}
          <AnimatePresence>
            {showPermissionWizard && (
              <div data-clui-ui style={{ position: 'relative', zIndex: 35, marginBottom: 8 }}>
                <PermissionWizard onComplete={() => setShowPermissionWizard(false)} />
              </div>
            )}
          </AnimatePresence>

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
            {filePeekOpen && (
              <div data-clui-ui style={{
                width: 720, maxWidth: 720, marginLeft: '50%',
                transform: 'translateX(-50%)', marginBottom: 14,
                position: 'relative', zIndex: 32,
              }}>
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={TRANSITION}
                >
                  <div data-clui-ui className="glass-surface overflow-hidden no-drag" style={{ borderRadius: 24, maxHeight: 470 }}>
                    <FilePeekPanel />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {costDashboardOpen && (
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
                    <CostDashboard />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {snippetManagerOpen && (
              <div
                data-clui-ui
                style={{
                  width: 720,
                  maxWidth: 720,
                  marginLeft: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  position: 'relative',
                  zIndex: 29,
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
                    <SnippetManager />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {workflowManagerOpen && !workflowEditorOpen && (
              <div
                data-clui-ui
                style={{
                  width: 720,
                  maxWidth: 720,
                  marginLeft: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  position: 'relative',
                  zIndex: 29,
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
                    <WorkflowManager />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {workflowEditorOpen && (
              <div
                data-clui-ui
                style={{
                  width: 720,
                  maxWidth: 720,
                  marginLeft: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  position: 'relative',
                  zIndex: 29,
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
                    <WorkflowEditor />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {shortcutSettingsOpen && (
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
                      maxHeight: 500,
                    }}
                  >
                    <ShortcutSettings />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {exportDialogOpen && (
              <div
                data-clui-ui
                style={{
                  width: expandedUI ? 720 : 560,
                  maxWidth: expandedUI ? 720 : 560,
                  marginLeft: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  position: 'relative',
                  zIndex: 31,
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
                      maxHeight: 500,
                    }}
                  >
                    <ExportDialog />
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
              width: effectiveExpanded ? cardExpandedWidth : cardCollapsedWidth,
              marginBottom: effectiveExpanded ? 10 : -14,
              marginLeft: effectiveExpanded ? 0 : cardCollapsedMargin,
              marginRight: effectiveExpanded ? 0 : cardCollapsedMargin,
              background: effectiveExpanded ? colors.containerBg : colors.containerBgCollapsed,
              borderColor: colors.containerBorder,
              boxShadow: effectiveExpanded ? colors.cardShadow : colors.cardShadowCollapsed,
            }}
            transition={TRANSITION}
            style={{
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 20,
              position: 'relative',
              zIndex: effectiveExpanded ? 20 : 10,
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
                height: effectiveExpanded ? 'auto' : 0,
                opacity: effectiveExpanded ? 1 : 0,
              }}
              transition={TRANSITION}
              className="overflow-hidden no-drag"
            >
              <div style={{ maxHeight: bodyMaxHeight, height: terminalMode ? bodyMaxHeight : undefined }}>
                {terminalMode ? (
                  <TerminalPanel />
                ) : (
                  <>
                    {workflowExecution && <WorkflowProgress />}
                    {isComparing ? <ComparisonView /> : <ConversationView />}
                    {!isComparing && <StatusBar />}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>

          {/* Comparison launcher modal */}
          <AnimatePresence>
            {comparisonLauncherOpen && <ComparisonLauncher />}
          </AnimatePresence>

          {/* ─── Input row — circles float outside left ─── */}
          {/* Hidden in terminal mode — terminal captures keystrokes directly */}
          {!terminalMode && (
            <div data-clui-ui className="relative" style={{ minHeight: 46, zIndex: 15, marginBottom: 10 }}>
              {/* Stacked circle buttons — expand on hover */}
              <div
                data-clui-ui
                className="circles-out"
              >
                <div className="btn-stack" data-compact={expandedUI ? '' : undefined}>
                  {/* btn-0: Terminal toggle */}
                  <ModeToggle />
                  {/* btn-1: Attach (front, rightmost) */}
                  <button
                    className="stack-btn stack-btn-1 glass-surface"
                    title="Attach file"
                    aria-label="Attach file"
                    onClick={handleAttachFile}
                    disabled={isRunning}
                  >
                    <Paperclip size={17} />
                  </button>
                  {/* btn-2: Screenshot (middle) */}
                  <button
                    className="stack-btn stack-btn-2 glass-surface"
                    title="Take screenshot"
                    aria-label="Take screenshot"
                    onClick={handleScreenshot}
                    disabled={isRunning}
                  >
                    <Camera size={17} />
                  </button>
                  {/* btn-3: Skills (back, leftmost) */}
                  <button
                    className="stack-btn stack-btn-3 glass-surface"
                    title="Skills & Plugins"
                    aria-label="Skills & Plugins"
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
          )}
        </div>
        </div>
      </ErrorBoundary>
    </PopoverLayerProvider>
  )
}
