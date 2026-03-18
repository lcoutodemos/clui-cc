import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, ChartBar, Clock, Coins, Lightning } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'
import type { CostSummary } from '../../shared/types'

type TimeRange = 'today' | '7d' | '30d' | 'all'

function getTimestampForRange(range: TimeRange): number | undefined {
  if (range === 'all') return undefined
  const now = Date.now()
  switch (range) {
    case 'today': {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    case '7d': return now - 7 * 24 * 60 * 60 * 1000
    case '30d': return now - 30 * 24 * 60 * 60 * 1000
  }
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function formatTokens(count: number): string {
  if (count < 1000) return String(count)
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`
  return `${(count / 1_000_000).toFixed(2)}M`
}

function shortenPath(path: string): string {
  // Show last two segments of the path
  const parts = path.replace(/\\/g, '/').split('/')
  if (parts.length <= 2) return path
  return parts.slice(-2).join('/')
}

const RANGE_LABELS: Record<TimeRange, string> = {
  today: 'Today',
  '7d': '7 Days',
  '30d': '30 Days',
  all: 'All Time',
}

export function CostDashboard() {
  const colors = useColors()
  const closeCostDashboard = useSessionStore((s) => s.closeCostDashboard)

  const [range, setRange] = useState<TimeRange>('7d')
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const from = getTimestampForRange(range)
    window.clui.getCostSummary(from).then((data) => {
      if (!cancelled) {
        setSummary(data)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [range])

  const maxDayCost = useMemo(() => {
    if (!summary || summary.byDay.length === 0) return 0
    return Math.max(...summary.byDay.map((d) => d.costUsd))
  }, [summary])

  const maxModelCost = useMemo(() => {
    if (!summary) return 0
    const values = Object.values(summary.byModel).map((m) => m.costUsd)
    return values.length > 0 ? Math.max(...values) : 0
  }, [summary])

  const maxProjectCost = useMemo(() => {
    if (!summary) return 0
    const values = Object.values(summary.byProject).map((p) => p.costUsd)
    return values.length > 0 ? Math.max(...values) : 0
  }, [summary])

  const sortedModels = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.byModel)
      .sort((a, b) => b[1].costUsd - a[1].costUsd)
  }, [summary])

  const sortedProjects = useMemo(() => {
    if (!summary) return []
    return Object.entries(summary.byProject)
      .sort((a, b) => b[1].costUsd - a[1].costUsd)
      .slice(0, 8) // Show top 8 projects
  }, [summary])

  const isEmpty = !loading && summary && summary.runCount === 0

  return (
    <div
      data-clui-ui
      style={{
        height: 470,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px 10px',
        borderBottom: `1px solid ${colors.containerBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChartBar size={20} weight="regular" style={{ color: colors.accent }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
              Usage Dashboard
            </div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              Cost and token usage analytics
            </div>
          </div>
        </div>
        <button
          onClick={closeCostDashboard}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textTertiary, padding: 2, display: 'flex',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = colors.textPrimary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
        >
          <X size={14} />
        </button>
      </div>

      {/* Time range tabs */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 18px 10px',
      }}>
        {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '6px 11px',
              borderRadius: 999,
              border: `1px solid ${range === r ? colors.accent : colors.containerBorder}`,
              background: range === r ? colors.accentLight : 'transparent',
              color: range === r ? colors.accent : colors.textSecondary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 12px', scrollbarWidth: 'thin' }}>
        {loading ? (
          <LoadingState colors={colors} />
        ) : isEmpty ? (
          <EmptyState colors={colors} />
        ) : summary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Summary cards */}
            <div style={{ display: 'flex', gap: 10 }}>
              <SummaryCard
                icon={<Coins size={14} weight="regular" />}
                label="Total Cost"
                value={formatCost(summary.totalCostUsd)}
                sublabel={`${summary.runCount} run${summary.runCount === 1 ? '' : 's'}`}
                colors={colors}
              />
              <SummaryCard
                icon={<Lightning size={14} weight="regular" />}
                label="Total Tokens"
                value={formatTokens(summary.totalInputTokens + summary.totalOutputTokens)}
                sublabel={`${formatTokens(summary.totalInputTokens)} in / ${formatTokens(summary.totalOutputTokens)} out`}
                colors={colors}
              />
              <SummaryCard
                icon={<Clock size={14} weight="regular" />}
                label="Total Time"
                value={formatDuration(summary.totalDurationMs)}
                sublabel={summary.runCount > 0 ? `avg ${formatDuration(Math.round(summary.totalDurationMs / summary.runCount))}` : ''}
                colors={colors}
              />
            </div>

            {/* Daily spend chart */}
            {summary.byDay.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>
                  Daily Spend
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                  {summary.byDay.map((day) => {
                    const pct = maxDayCost > 0 ? (day.costUsd / maxDayCost) * 100 : 0
                    return (
                      <div
                        key={day.date}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          minWidth: 0,
                        }}
                        title={`${day.date}: ${formatCost(day.costUsd)} (${day.runs} run${day.runs === 1 ? '' : 's'})`}
                      >
                        <div
                          style={{
                            width: '100%',
                            maxWidth: 28,
                            height: `${Math.max(pct, 3)}%`,
                            borderRadius: 4,
                            background: `linear-gradient(to top, ${colors.accent}, rgba(217, 119, 87, 0.6))`,
                            transition: 'height 0.3s ease',
                            minHeight: 2,
                          }}
                        />
                        <div style={{
                          fontSize: 8,
                          color: colors.textTertiary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                          textAlign: 'center',
                        }}>
                          {day.date.slice(5)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* By Model breakdown */}
            {sortedModels.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>
                  By Model
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sortedModels.map(([model, data]) => {
                    const pct = maxModelCost > 0 ? (data.costUsd / maxModelCost) * 100 : 0
                    return (
                      <div key={model}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: colors.textSecondary }}>{model}</span>
                          <span style={{ fontSize: 10, color: colors.textTertiary }}>
                            {formatCost(data.costUsd)} ({data.runs} run{data.runs === 1 ? '' : 's'})
                          </span>
                        </div>
                        <div style={{
                          height: 6,
                          borderRadius: 3,
                          background: colors.surfacePrimary,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: colors.accent,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* By Project breakdown */}
            {sortedProjects.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>
                  By Project
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sortedProjects.map(([project, data]) => {
                    const pct = maxProjectCost > 0 ? (data.costUsd / maxProjectCost) * 100 : 0
                    return (
                      <div key={project}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '60%',
                          }}>
                            {shortenPath(project)}
                          </span>
                          <span style={{ fontSize: 10, color: colors.textTertiary, flexShrink: 0 }}>
                            {formatCost(data.costUsd)} ({data.runs} run{data.runs === 1 ? '' : 's'})
                          </span>
                        </div>
                        <div style={{
                          height: 6,
                          borderRadius: 3,
                          background: colors.surfacePrimary,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: colors.statusComplete,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Summary Card ───

function SummaryCard({ icon, label, value, sublabel, colors }: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel: string
  colors: ReturnType<typeof useColors>
}) {
  return (
    <div style={{
      flex: 1,
      padding: '10px 12px',
      borderRadius: 12,
      border: `1px solid ${colors.containerBorder}`,
      background: colors.surfaceHover,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <span style={{ color: colors.textTertiary, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 10, color: colors.textTertiary, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary, lineHeight: 1.2 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontSize: 9, color: colors.textTertiary, marginTop: 3 }}>
          {sublabel}
        </div>
      )}
    </div>
  )
}

// ─── States ───

function LoadingState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
          style={{
            height: 40,
            borderRadius: 10,
            background: colors.surfacePrimary,
          }}
        />
      ))}
    </div>
  )
}

function EmptyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <div style={{
      padding: '40px 10px',
      textAlign: 'center',
    }}>
      <ChartBar size={32} weight="thin" style={{ color: colors.textTertiary, margin: '0 auto 12px' }} />
      <div style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>
        No usage data yet
      </div>
      <div style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 1.5 }}>
        Cost data will appear here after your first completed task.
      </div>
    </div>
  )
}
