import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useColors } from '../theme'
import { useTerminalStore } from '../stores/terminalStore'

interface TerminalViewProps {
  termTabId: string
  isActive: boolean
}

export function TerminalView({ termTabId, isActive }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<any>(null) // xterm Terminal instance
  const fitAddonRef = useRef<any>(null)
  const colors = useColors()
  const [loaded, setLoaded] = useState(false)

  // Lazy-load xterm.js and initialize
  useEffect(() => {
    let disposed = false

    async function init() {
      if (!containerRef.current || terminalRef.current) return

      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      const { WebLinksAddon } = await import('@xterm/addon-web-links')

      if (disposed) return

      const fitAddon = new FitAddon()

      const terminal = new Terminal({
        fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.3,
        cursorStyle: 'bar',
        cursorBlink: true,
        scrollback: 5000,
        theme: buildXtermTheme(colors),
        allowTransparency: true,
        customKeyEventHandler: (e: KeyboardEvent) => {
          const isMac = navigator.platform.toLowerCase().includes('mac')
          const mod = isMac ? e.metaKey : e.ctrlKey

          // Copy: Ctrl+Shift+C always, or Ctrl+C/Cmd+C when text is selected
          if (mod && e.shiftKey && e.key === 'C' && e.type === 'keydown') {
            const sel = terminal.getSelection()
            if (sel) navigator.clipboard.writeText(sel)
            return false
          }
          if (mod && !e.shiftKey && e.key === 'c' && e.type === 'keydown') {
            const sel = terminal.getSelection()
            if (sel) {
              navigator.clipboard.writeText(sel)
              terminal.clearSelection()
              return false // intercept — don't send SIGINT
            }
            return true // no selection — let SIGINT through
          }

          // Paste: Ctrl+Shift+V or Ctrl+V/Cmd+V
          if (mod && (e.key === 'v' || e.key === 'V') && e.type === 'keydown') {
            navigator.clipboard.readText().then((text) => {
              if (text) terminal.paste(text)
            })
            return false
          }

          // Terminal shortcuts: new tab, close tab, cycle tabs
          if (mod && e.shiftKey && e.key === 'T' && e.type === 'keydown') {
            window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: 'new-tab' } }))
            return false
          }
          if (mod && e.shiftKey && e.key === 'W' && e.type === 'keydown') {
            window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: 'close-tab' } }))
            return false
          }
          if (e.ctrlKey && e.key === 'Tab' && e.type === 'keydown') {
            window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: e.shiftKey ? 'prev-tab' : 'next-tab' } }))
            return false
          }

          // Font zoom: Ctrl+= / Ctrl+- / Ctrl+0
          if (mod && (e.key === '=' || e.key === '+') && e.type === 'keydown') {
            window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: 'zoom-in' } }))
            return false
          }
          if (mod && e.key === '-' && e.type === 'keydown') {
            window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: 'zoom-out' } }))
            return false
          }
          if (mod && e.key === '0' && e.type === 'keydown') {
            window.dispatchEvent(new CustomEvent('clui-terminal-shortcut', { detail: { action: 'zoom-reset' } }))
            return false
          }

          // Toggle mode: Ctrl+`
          if (mod && e.key === '`' && e.type === 'keydown') {
            useTerminalStore.getState().toggleMode()
            return false
          }

          return true // pass everything else to PTY
        },
      })

      terminal.loadAddon(fitAddon)
      terminal.loadAddon(new WebLinksAddon())

      terminal.open(containerRef.current!)
      fitAddon.fit()

      terminalRef.current = terminal
      fitAddonRef.current = fitAddon

      // Send keystrokes to main process
      terminal.onData((data: string) => {
        window.clui.terminalWrite(termTabId, data)
      })

      // Receive output from main process
      const unsub = window.clui.onTerminalData((id: string, data: string) => {
        if (id === termTabId && terminalRef.current) {
          terminalRef.current.write(data)
        }
      })

      // Send initial resize
      const dims = fitAddon.proposeDimensions()
      if (dims) {
        window.clui.terminalResize(termTabId, dims.cols, dims.rows)
      }

      // Listen for clear and font size events
      const shortcutHandler = (e: Event) => {
        const detail = (e as CustomEvent).detail
        if (detail?.action === 'clear' && terminalRef.current) {
          terminalRef.current.clear()
        }
        if (detail?.action === 'font-size-changed' && terminalRef.current && fitAddonRef.current) {
          terminalRef.current.options.fontSize = detail.fontSize
          fitAddonRef.current.fit()
          const newDims = fitAddonRef.current.proposeDimensions()
          if (newDims) window.clui.terminalResize(termTabId, newDims.cols, newDims.rows)
        }
      }
      window.addEventListener('clui-terminal-shortcut', shortcutHandler)

      setLoaded(true)

      // Store unsub for cleanup
      ;(terminal as any)._cluiUnsub = unsub
      ;(terminal as any)._cluiShortcutHandler = shortcutHandler
    }

    init()

    return () => {
      disposed = true
      if (terminalRef.current) {
        const unsub = (terminalRef.current as any)._cluiUnsub
        if (unsub) unsub()
        const shortcutHandler = (terminalRef.current as any)._cluiShortcutHandler
        if (shortcutHandler) window.removeEventListener('clui-terminal-shortcut', shortcutHandler)
        terminalRef.current.dispose()
        terminalRef.current = null
      }
    }
  }, [termTabId])

  // Re-fit on visibility change and resize
  useEffect(() => {
    if (!isActive || !fitAddonRef.current) return

    const fit = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        const dims = fitAddonRef.current.proposeDimensions()
        if (dims) {
          window.clui.terminalResize(termTabId, dims.cols, dims.rows)
        }
      }
    }

    // Fit when becoming active
    requestAnimationFrame(fit)

    // Fit on window resize
    const observer = new ResizeObserver(fit)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [isActive, termTabId, loaded])

  // Focus terminal when active
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [isActive])

  // Update theme
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = buildXtermTheme(colors)
    }
  }, [colors])

  return (
    <div
      ref={containerRef}
      data-clui-ui
      style={{
        flex: 1,
        padding: 4,
        display: isActive ? 'block' : 'none',
        overflow: 'hidden',
      }}
    />
  )
}

function buildXtermTheme(colors: ReturnType<typeof useColors>): Record<string, string> {
  return {
    background: colors.containerBg,
    foreground: colors.textPrimary,
    cursor: colors.accent,
    cursorAccent: colors.containerBg,
    selectionBackground: colors.accentSoft,
    selectionForeground: colors.textPrimary,
    black: colors.textMuted,
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: colors.textPrimary,
    brightBlack: colors.textTertiary,
    brightRed: '#f87171',
    brightGreen: '#4ade80',
    brightYellow: '#facc15',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#ffffff',
  }
}
