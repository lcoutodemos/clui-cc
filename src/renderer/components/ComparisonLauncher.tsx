import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Columns } from '@phosphor-icons/react'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'
import { AVAILABLE_MODELS } from '../stores/sessionStore'
import { useComparisonStore } from '../stores/comparisonStore'

export function ComparisonLauncher() {
  const colors = useColors()
  const popoverLayer = usePopoverLayer()
  const closeLauncher = useComparisonStore((s) => s.closeLauncher)
  const startComparison = useComparisonStore((s) => s.startComparison)

  const [modelA, setModelA] = useState(AVAILABLE_MODELS[0].id)
  const [modelB, setModelB] = useState(AVAILABLE_MODELS[1].id)
  const [isStarting, setIsStarting] = useState(false)

  const handleStart = async () => {
    if (modelA === modelB) return
    setIsStarting(true)
    try {
      await startComparison(modelA, modelB)
    } finally {
      setIsStarting(false)
    }
  }

  if (!popoverLayer) return null

  const selectStyle = {
    background: colors.surfacePrimary,
    color: colors.textPrimary,
    border: `1px solid ${colors.toolBorder}`,
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    cursor: 'pointer',
  } as const

  return createPortal(
    <motion.div
      data-clui-ui
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 100,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
        }}
        onClick={closeLauncher}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'relative',
          width: 360,
          background: colors.containerBg,
          border: `1px solid ${colors.containerBorder}`,
          borderRadius: 16,
          boxShadow: colors.popoverShadow,
          padding: 24,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div className="flex items-center gap-2">
            <Columns size={18} style={{ color: colors.accent }} />
            <span style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 600 }}>
              Compare Models
            </span>
          </div>
          <button
            onClick={closeLauncher}
            style={{
              color: colors.textTertiary,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Model A */}
        <div style={{ marginBottom: 14 }}>
          <label
            style={{ color: colors.textSecondary, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 500 }}
          >
            Model A (Left)
          </label>
          <select
            value={modelA}
            onChange={(e) => setModelA(e.target.value)}
            style={selectStyle}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Model B */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{ color: colors.textSecondary, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 500 }}
          >
            Model B (Right)
          </label>
          <select
            value={modelB}
            onChange={(e) => setModelB(e.target.value)}
            style={selectStyle}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Warning if same model */}
        {modelA === modelB && (
          <div
            style={{
              color: colors.statusError,
              fontSize: 11,
              marginBottom: 12,
              padding: '6px 10px',
              background: colors.statusErrorBg,
              borderRadius: 8,
            }}
          >
            Select two different models to compare.
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={closeLauncher}
            style={{
              color: colors.textSecondary,
              background: colors.surfaceHover,
              border: `1px solid ${colors.toolBorder}`,
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={modelA === modelB || isStarting}
            style={{
              color: modelA === modelB ? colors.textTertiary : colors.textOnAccent,
              background: modelA === modelB ? colors.surfaceHover : colors.accent,
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: modelA === modelB ? 'not-allowed' : 'pointer',
              opacity: isStarting ? 0.7 : 1,
            }}
          >
            {isStarting ? 'Starting...' : 'Start Comparison'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    popoverLayer,
  )
}
