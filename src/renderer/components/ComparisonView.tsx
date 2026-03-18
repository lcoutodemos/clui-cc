import React from 'react'
import { motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useComparisonStore } from '../stores/comparisonStore'
import { useSessionStore, AVAILABLE_MODELS } from '../stores/sessionStore'
import { ConversationView } from './ConversationView'

function modelLabel(modelId: string): string {
  const found = AVAILABLE_MODELS.find((m) => m.id === modelId)
  return found?.label || modelId
}

function PaneCost({ tabId }: { tabId: string }) {
  const tab = useSessionStore(
    (s) => s.tabs.find((t) => t.id === tabId),
    (a, b) => a === b || (!!a && !!b && a.lastResult === b.lastResult && a.status === b.status),
  )
  const colors = useColors()

  if (!tab?.lastResult) return null

  const r = tab.lastResult
  return (
    <div
      className="flex items-center gap-2 text-[10px]"
      style={{ color: colors.textTertiary }}
    >
      <span>${r.totalCostUsd.toFixed(4)}</span>
      <span>{(r.durationMs / 1000).toFixed(1)}s</span>
      <span>{r.numTurns} turn{r.numTurns !== 1 ? 's' : ''}</span>
    </div>
  )
}

function PaneStatus({ tabId }: { tabId: string }) {
  const status = useSessionStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.status,
  )
  const colors = useColors()

  if (!status || status === 'idle' || status === 'completed') return null

  const statusColor =
    status === 'running' || status === 'connecting' ? colors.statusRunning
    : status === 'failed' || status === 'dead' ? colors.statusError
    : colors.textTertiary

  return (
    <span className="text-[10px]" style={{ color: statusColor }}>
      {status}
    </span>
  )
}

export function ComparisonView() {
  const activeComparison = useComparisonStore((s) => s.activeComparison)
  const endComparison = useComparisonStore((s) => s.endComparison)
  const colors = useColors()

  if (!activeComparison) return null

  const { tabIdA, tabIdB, modelA, modelB } = activeComparison

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Pane headers + close button */}
      <div
        className="flex items-center"
        style={{
          borderBottom: `1px solid ${colors.toolBorder}`,
          flexShrink: 0,
        }}
      >
        {/* Left pane header */}
        <div
          className="flex-1 flex items-center justify-between px-3 py-1.5"
          style={{ minWidth: 0 }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[11px] font-semibold truncate"
              style={{ color: colors.textPrimary }}
            >
              {modelLabel(modelA)}
            </span>
            <PaneStatus tabId={tabIdA} />
          </div>
          <PaneCost tabId={tabIdA} />
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            alignSelf: 'stretch',
            background: colors.toolBorder,
          }}
        />

        {/* Right pane header */}
        <div
          className="flex-1 flex items-center justify-between px-3 py-1.5"
          style={{ minWidth: 0 }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[11px] font-semibold truncate"
              style={{ color: colors.textPrimary }}
            >
              {modelLabel(modelB)}
            </span>
            <PaneStatus tabId={tabIdB} />
          </div>
          <PaneCost tabId={tabIdB} />
        </div>

        {/* Close button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={endComparison}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            color: colors.textTertiary,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            marginRight: 6,
          }}
          title="Close comparison"
        >
          <X size={13} />
        </motion.button>
      </div>

      {/* Split panes */}
      <div className="flex flex-1 min-h-0">
        {/* Left pane */}
        <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          <ConversationView overrideTabId={tabIdA} />
        </div>

        {/* Vertical divider */}
        <div
          style={{
            width: 1,
            background: colors.toolBorder,
            flexShrink: 0,
          }}
        />

        {/* Right pane */}
        <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          <ConversationView overrideTabId={tabIdB} />
        </div>
      </div>
    </div>
  )
}
