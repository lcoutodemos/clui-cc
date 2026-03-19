import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Terminal, CaretDown, Check } from '@phosphor-icons/react'
import { usePopoverLayer } from './PopoverLayer'
import { useColors, useThemeStore } from '../theme'
import type { DetectedTerminal } from '../../shared/types'

interface TerminalPickerProps {
  sessionId: string | null
  projectPath: string
}

export function TerminalPicker({ sessionId, projectPath }: TerminalPickerProps) {
  const preferredTerminal = useThemeStore((s) => s.preferredTerminal)
  const setPreferredTerminal = useThemeStore((s) => s.setPreferredTerminal)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
  const [terminals, setTerminals] = useState<DetectedTerminal[]>([])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 6,
      left: rect.left,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = async () => {
    if (!open) {
      updatePos()
      setTerminals([])
      const result = await window.clui.detectTerminals()
      setTerminals(result.terminals)
    }
    setOpen((o) => !o)
  }

  const handleSelect = (terminal: DetectedTerminal) => {
    setPreferredTerminal(terminal.name)
    setOpen(false)
  }

  const handleOpenDefault = async () => {
    await window.clui.openInTerminal(sessionId, projectPath, preferredTerminal ?? undefined)
  }

  const handleBrowse = async () => {
    setOpen(false)
    const customPath = await window.clui.selectCustomTerminal()
    if (customPath) {
      // Store the full path so the main process can locate and launch it
      setPreferredTerminal(customPath)
      await window.clui.openInTerminal(sessionId, projectPath, customPath)
    }
  }

  return (
    <>
      <button
        onClick={handleOpenDefault}
        className="flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 transition-colors"
        style={{ color: colors.textTertiary }}
        title="Open this session in terminal"
      >
        Open in CLI
        <Terminal size={11} />
      </button>

      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-0.5 text-[10px] rounded-full px-1 py-0.5 transition-colors"
        style={{ color: colors.textTertiary, cursor: 'pointer' }}
        title="Change default terminal"
      >
        <CaretDown size={10} style={{ opacity: 0.6 }} />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-clui-ui
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl"
          style={{
            position: 'fixed',
            bottom: pos.bottom,
            left: pos.left,
            width: 192,
            pointerEvents: 'auto',
            background: colors.popoverBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
            border: `1px solid ${colors.popoverBorder}`,
          }}
        >
          <div className="py-1">
            {terminals.length === 0 && (
              <div className="px-3 py-2 text-[11px]" style={{ color: colors.textTertiary }}>
                No terminals detected
              </div>
            )}
            {terminals.map((t) => {
              // preferredTerminal is either a terminal name ("Ghostty") or a full path
              const isSelected = preferredTerminal === t.name || preferredTerminal === t.path
              return (
                <button
                  key={t.name}
                  onClick={() => handleSelect(t)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] transition-colors"
                  style={{
                    color: isSelected ? colors.textPrimary : colors.textSecondary,
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {t.displayName}
                  {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                </button>
              )
            })}
            <div className="mx-2 my-0.5" style={{ height: 1, background: colors.popoverBorder }} />
            <button
              onClick={handleBrowse}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors"
              style={{ color: colors.accent }}
            >
              Browse...
            </button>
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}
