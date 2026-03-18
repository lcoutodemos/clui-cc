import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MagnifyingGlass, SpinnerGap, ArrowClockwise, HeadCircuit, Compass, GithubLogo } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import { useColors } from '../theme'
import type { CatalogPlugin, PluginStatus } from '../../shared/types'

export function MarketplacePanel() {
  const colors = useColors()
  const catalog = useMarketplaceStore((s) => s.catalog)
  const loading = useMarketplaceStore((s) => s.loading)
  const error = useMarketplaceStore((s) => s.error)
  const pluginStates = useMarketplaceStore((s) => s.pluginStates)
  const search = useMarketplaceStore((s) => s.search)
  const filter = useMarketplaceStore((s) => s.filter)
  const closeMarketplace = useMarketplaceStore((s) => s.closeMarketplace)
  const setSearch = useMarketplaceStore((s) => s.setMarketplaceSearch)
  const setFilter = useMarketplaceStore((s) => s.setMarketplaceFilter)
  const loadMarketplace = useMarketplaceStore((s) => s.loadMarketplace)
  const buildYourOwn = useSessionStore((s) => s.buildYourOwn)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Derive filter chips dynamically from catalog semantic tags, sorted by frequency
  const filters = useMemo(() => {
    const tagCounts = new Map<string, number>()
    for (const p of catalog) {
      for (const t of (p.tags || [])) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
      }
    }
    // Sort by frequency (descending), then alphabetically
    const sorted = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)
    return ['All', ...sorted, 'Installed']
  }, [catalog])

  // Debounced search
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(val), 200)
  }, [setSearch])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // Filtered plugins
  const lowerSearch = localSearch.toLowerCase()
  const filtered = useMemo(() => {
    return catalog.filter((p) => {
      const pluginName = (p.name || '').toLowerCase()
      const pluginDescription = (p.description || '').toLowerCase()
      const pluginTags = Array.isArray(p.tags) ? p.tags : []
      const matchesSearch = !lowerSearch ||
        pluginName.includes(lowerSearch) ||
        pluginDescription.includes(lowerSearch) ||
        pluginTags.some((t) => String(t).toLowerCase().includes(lowerSearch)) ||
        (p.author || '').toLowerCase().includes(lowerSearch) ||
        (p.repo || '').toLowerCase().includes(lowerSearch) ||
        (p.marketplace || '').toLowerCase().includes(lowerSearch)
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Installed' && pluginStates[p.id] === 'installed') ||
        pluginTags.includes(filter)
      return matchesSearch && matchesFilter
    })
  }, [catalog, lowerSearch, filter, pluginStates])

  // Reorder cards so expanded card sits on a full-width row with no grid gaps.
  // If the expanded card was in the right column (odd index), its left neighbor
  // drops below it to fill the next row — no empty cells.
  const displayOrder = useMemo(() => {
    if (expandedId === null) return filtered
    const idx = filtered.findIndex((p) => p.id === expandedId)
    if (idx === -1) return filtered
    const expanded = filtered[idx]
    const before = filtered.slice(0, idx)
    const after = filtered.slice(idx + 1)
    if (idx % 2 === 1 && before.length > 0) {
      // Odd index (right column): move left neighbor to after the expanded card
      const leftNeighbor = before.pop()!
      return [...before, expanded, leftNeighbor, ...after]
    }
    return [...before, expanded, ...after]
  }, [filtered, expandedId])

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
          <HeadCircuit size={20} weight="regular" style={{ color: colors.accent }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
              Skills Marketplace
            </div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              Install skills and plugins without leaving CLUI
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => loadMarketplace(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textTertiary,
              padding: 2,
              display: 'flex',
              borderRadius: 4,
            }}
            title="Refresh marketplace"
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
          >
            <ArrowClockwise size={14} />
          </button>
          <button
            onClick={closeMarketplace}
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
      </div>

      {/* Search + Build your own */}
      <div style={{ padding: '12px 18px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: colors.inputPillBg,
          borderRadius: 12,
          padding: '9px 12px',
          border: `1px solid ${colors.containerBorder}`,
          minWidth: 0,
          flex: 1,
        }}>
          <MagnifyingGlass size={13} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search skills, tags, authors..."
            value={localSearch}
            onChange={handleSearchChange}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: colors.textPrimary, fontSize: 12, fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          onClick={buildYourOwn}
          style={{
            flexShrink: 0,
            height: 36,
            padding: '0 12px',
            borderRadius: 9999,
            border: `1px dashed ${colors.accentBorderMedium}`,
            background: colors.accentLight,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s',
            color: colors.accent,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.accent }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.accentBorderMedium }}
        >
          <Compass size={12} weight="regular" />
          Build your own
        </button>
      </div>

      {/* Filter chips */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '0 18px 12px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '6px 11px',
              borderRadius: 999,
              border: `1px solid ${filter === f ? colors.accent : colors.containerBorder}`,
              background: filter === f ? colors.accentLight : 'transparent',
              color: filter === f ? colors.accent : colors.textSecondary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Body */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '0 18px', scrollbarWidth: 'thin' }}>
        {loading ? (
          <LoadingState colors={colors} />
        ) : error ? (
          <ErrorState error={error} colors={colors} onRetry={() => loadMarketplace(true)} />
        ) : filtered.length === 0 ? (
          <EmptyState colors={colors} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              paddingBottom: 6,
            }}
          >
            {displayOrder.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                status={pluginStates[plugin.id] || 'not_installed'}
                colors={colors}
                expanded={expandedId === plugin.id}
                scrollContainerRef={scrollContainerRef}
                onToggleExpand={() => {
                  setExpandedId(expandedId === plugin.id ? null : plugin.id)
                }}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── PluginCard ───

function PluginCard({ plugin, status, colors, expanded, onToggleExpand, scrollContainerRef }: {
  plugin: CatalogPlugin
  status: PluginStatus
  colors: ReturnType<typeof useColors>
  expanded: boolean
  onToggleExpand: () => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const installPlugin = useMarketplaceStore((s) => s.installMarketplacePlugin)
  const uninstallPlugin = useMarketplaceStore((s) => s.uninstallMarketplacePlugin)
  const cardRef = useRef<HTMLDivElement>(null)
  const needsScrollRef = useRef(false)

  useEffect(() => {
    if (expanded) needsScrollRef.current = true
  }, [expanded])

  const handleLayoutComplete = useCallback(() => {
    if (!needsScrollRef.current || !expanded || !cardRef.current || !scrollContainerRef.current) return
    needsScrollRef.current = false
    const container = scrollContainerRef.current
    const card = cardRef.current
    const containerRect = container.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    // Scroll so the card is vertically centered in the scroll container
    const cardTopRelative = cardRect.top - containerRect.top + container.scrollTop
    const targetScroll = cardTopRelative - (containerRect.height - cardRect.height) / 2
    container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
  }, [expanded, scrollContainerRef])

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (status === 'failed') {
      installPlugin(plugin)
    } else {
      setShowConfirm(true)
      if (!expanded) onToggleExpand()
    }
  }

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowConfirm(false)
    installPlugin(plugin)
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowConfirm(false)
  }

  const handleGithubClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `https://github.com/${plugin.repo || 'unknown/repo'}/tree/main/${plugin.sourcePath || ''}`
    window.clui.openExternal(url)
  }

  // Collapse → clear confirm
  useEffect(() => {
    if (!expanded) setShowConfirm(false)
  }, [expanded])

  const safeName = plugin.name || 'Unnamed plugin'
  const safeDescription = plugin.description || 'No description provided.'
  const safeCategory = plugin.category || 'Other'
  const safeMarketplace = plugin.marketplace || 'Marketplace'
  const safeAuthor = plugin.author || 'Unknown'
  const safeRepo = plugin.repo || 'unknown/repo'
  const safeVersion = plugin.version || 'n/a'

  const githubButton = (
    <button
      onClick={handleGithubClick}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: colors.textTertiary,
        padding: 2,
        display: 'flex',
        borderRadius: 4,
      }}
      title="View source on GitHub"
      onMouseEnter={(e) => (e.currentTarget.style.color = colors.textPrimary)}
      onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
    >
      <GithubLogo size={14} />
    </button>
  )

  return (
    <motion.div
      ref={cardRef}
      layout
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      onLayoutAnimationComplete={handleLayoutComplete}
      onClick={onToggleExpand}
      style={{
        padding: '12px',
        borderRadius: 14,
        border: `1px solid ${expanded ? colors.surfaceSecondary : colors.containerBorder}`,
        background: expanded ? colors.surfaceActive : colors.surfaceHover,
        minHeight: expanded ? undefined : 154,
        width: expanded ? '100%' : 'calc(50% - 5px)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!expanded) {
          e.currentTarget.style.background = colors.surfaceActive
          e.currentTarget.style.borderColor = colors.surfaceSecondary
        }
      }}
      onMouseLeave={(e) => {
        if (!expanded) {
          e.currentTarget.style.background = colors.surfaceHover
          e.currentTarget.style.borderColor = colors.containerBorder
        }
      }}
    >
      {expanded ? (
        /* ── Expanded: full-width single column ── */
        <div>
          {/* Header row: tags + actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Tag label={safeCategory} colors={colors} emphasis="accent" />
              {(plugin.tags || []).map((tag) => (
                <Tag key={tag} label={tag} colors={colors} />
              ))}
            </div>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {githubButton}
              <StatusButton status={status} colors={colors} onClick={handleInstallClick} onUninstall={(e) => { e.stopPropagation(); uninstallPlugin(plugin) }} />
            </div>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
            {safeName}
          </div>
          <div style={{
            fontSize: 11,
            color: colors.textSecondary,
            marginTop: 5,
            lineHeight: 1.5,
          }}>
            {safeDescription}
          </div>
          <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: 8 }}>
            {safeRepo} · by {safeAuthor} · v{safeVersion}
          </div>

          {/* Confirm panel or installing status */}
          {showConfirm && status === 'not_installed' && (
            <div style={{
              padding: '10px 12px', borderRadius: 10, marginTop: 10,
              background: colors.surfacePrimary, border: `1px solid ${colors.containerBorder}`,
            }}>
              <div style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 4 }}>
                {plugin.isSkillMd ? 'Will install to:' : 'Will run:'}
              </div>
              <div style={{
                fontSize: 10, fontFamily: 'monospace', color: colors.textSecondary,
                background: colors.codeBg, padding: '4px 6px', borderRadius: 4,
                lineHeight: 1.6,
              }}>
                {plugin.isSkillMd
                  ? <>~/.claude/skills/{plugin.installName}/SKILL.md</>
                  : <>claude plugin install {plugin.installName}@{safeMarketplace}</>
                }
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={handleConfirm}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                    background: colors.accent, color: colors.textOnAccent, border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Confirm Install
                </button>
                <button
                  onClick={handleCancel}
                  style={{
                    fontSize: 10, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
                    background: 'transparent', color: colors.textSecondary,
                    border: `1px solid ${colors.containerBorder}`,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {status === 'installing' && (
            <div style={{
              padding: '10px 12px', borderRadius: 10, marginTop: 10,
              background: colors.surfacePrimary, border: `1px solid ${colors.containerBorder}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'flex' }}
              >
                <SpinnerGap size={14} style={{ color: colors.accent }} />
              </motion.div>
              <span style={{ fontSize: 11, color: colors.textSecondary }}>Installing plugin...</span>
            </div>
          )}
        </div>
      ) : (
        /* ── Collapsed: original layout ── */
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <Tag label={safeCategory} colors={colors} emphasis="accent" />
              {(plugin.tags || []).slice(0, 2).map((tag) => (
                <Tag key={tag} label={tag} colors={colors} />
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
              {safeName}
            </div>
            <div style={{
              fontSize: 11,
              color: colors.textSecondary,
              marginTop: 5,
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {safeDescription}
            </div>
            <div style={{ fontSize: 10, color: colors.textTertiary, marginTop: 8 }}>
              {safeRepo} · by {safeAuthor} · v{safeVersion}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {githubButton}
            <StatusButton status={status} colors={colors} onClick={handleInstallClick} onUninstall={(e) => { e.stopPropagation(); uninstallPlugin(plugin) }} />
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── StatusButton ───

function StatusButton({ status, colors, onClick, onUninstall }: {
  status: PluginStatus
  colors: ReturnType<typeof useColors>
  onClick: (e: React.MouseEvent) => void
  onUninstall?: (e: React.MouseEvent) => void
}) {
  const [hovered, setHovered] = useState(false)
  switch (status) {
    case 'installed':
      return (
        <button
          onClick={onUninstall}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 8,
            background: hovered ? colors.statusErrorBg : colors.statusCompleteBg,
            color: hovered ? colors.statusError : colors.statusComplete,
            whiteSpace: 'nowrap',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          {hovered ? 'Uninstall' : 'Installed'}
        </button>
      )
    case 'installing':
      return (
        <span style={{
          fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 8,
          background: colors.accentLight, color: colors.accent,
          display: 'flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap',
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ display: 'flex' }}
          >
            <SpinnerGap size={10} />
          </motion.div>
          Installing...
        </span>
      )
    case 'failed':
      return (
        <button
          onClick={onClick}
          style={{
            fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 8,
            background: colors.statusErrorBg, color: colors.statusError,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          Failed — Retry
        </button>
      )
    default:
      return (
        <button
          onClick={onClick}
          style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
            background: colors.accentLight, color: colors.accent,
            border: `1px solid ${colors.accentBorder}`,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = colors.accentSoft)}
          onMouseLeave={(e) => (e.currentTarget.style.background = colors.accentLight)}
        >
          Install
        </button>
      )
  }
}

function Tag({ label, colors, emphasis }: {
  label: string
  colors: ReturnType<typeof useColors>
  emphasis?: 'accent'
}) {
  const isAccent = emphasis === 'accent'
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1,
        padding: '5px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        border: `1px solid ${isAccent ? colors.accentBorderMedium : colors.containerBorder}`,
        background: isAccent ? colors.accentLight : colors.surfacePrimary,
        color: isAccent ? colors.accent : colors.textSecondary,
      }}
    >
      {label}
    </span>
  )
}

// ─── States ───

function LoadingState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ padding: '8px 10px' }}>
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
            style={{
              height: 12, width: '60%', borderRadius: 4,
              background: colors.surfacePrimary, marginBottom: 4,
            }}
          />
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.1 }}
            style={{
              height: 10, width: '90%', borderRadius: 4,
              background: colors.surfacePrimary,
            }}
          />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ error, colors, onRetry }: {
  error: string
  colors: ReturnType<typeof useColors>
  onRetry: () => void
}) {
  return (
    <div style={{ padding: '20px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: colors.statusError, marginBottom: 8 }}>
        {error.length > 100 ? error.substring(0, 100) + '...' : error}
      </div>
      <button
        onClick={onRetry}
        style={{
          fontSize: 10, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
          background: colors.accentLight, color: colors.accent,
          border: `1px solid ${colors.accentBorder}`,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        <ArrowClockwise size={11} /> Retry
      </button>
    </div>
  )
}

function EmptyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <div style={{
      padding: '24px 10px', textAlign: 'center',
      fontSize: 11, color: colors.textTertiary,
    }}>
      No plugins match your search
    </div>
  )
}
