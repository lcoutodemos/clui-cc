import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { generateDiff } from '../utils/diff'
import type { DiffHunk, DiffLine } from '../utils/diff'

// ─── Constants ───

const LARGE_DIFF_THRESHOLD = 50
const GUTTER_WIDTH = '4ch'
const BORDER_WIDTH = 3

// ─── Types ───

export interface DiffViewerProps {
  filePath: string
  oldString: string
  newString: string
  defaultCollapsed?: boolean
}

// ─── Component ───

export function DiffViewer({ filePath, oldString, newString, defaultCollapsed }: DiffViewerProps) {
  const colors = useColors()

  const hunks = useMemo(
    () => generateDiff(oldString, newString),
    [oldString, newString],
  )

  const totalLines = useMemo(
    () => hunks.reduce((sum, h) => sum + h.lines.length, 0),
    [hunks],
  )

  const { additions, deletions } = useMemo(() => {
    let add = 0
    let del = 0
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'addition') add++
        else if (line.type === 'deletion') del++
      }
    }
    return { additions: add, deletions: del }
  }, [hunks])

  const isLarge = totalLines > LARGE_DIFF_THRESHOLD
  const shouldStartCollapsed = defaultCollapsed ?? isLarge

  const [collapsed, setCollapsed] = useState(shouldStartCollapsed)

  // No diff — identical content
  if (hunks.length === 0) return null

  const fileName = filePath.split(/[/\\]/).pop() || filePath

  return (
    <div
      style={{
        borderRadius: 6,
        border: `1px solid ${colors.toolBorder}`,
        background: colors.codeBg,
        overflow: 'hidden',
        fontSize: 12,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '6px 10px',
          background: colors.surfacePrimary,
          border: 'none',
          borderBottom: collapsed ? 'none' : `1px solid ${colors.toolBorder}`,
          cursor: 'pointer',
          textAlign: 'left',
          color: colors.textSecondary,
          fontSize: 12,
          fontFamily: 'inherit',
        }}
      >
        {collapsed
          ? <CaretRight size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          : <CaretDown size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
        }
        <span
          style={{
            color: colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={filePath}
        >
          {fileName}
        </span>
        <span style={{ color: colors.textTertiary, fontSize: 11, flexShrink: 0 }}>
          {collapsed ? `Show ${totalLines} lines changed` : ''}
        </span>
      </button>

      {/* Diff body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ overflowX: 'auto' }}>
              {hunks.map((hunk, hunkIdx) => (
                <HunkBlock key={hunkIdx} hunk={hunk} colors={colors} showHeader={hunks.length > 1} />
              ))}
            </div>

            {/* Summary footer */}
            <div
              style={{
                padding: '4px 10px',
                borderTop: `1px solid ${colors.toolBorder}`,
                color: colors.textTertiary,
                fontSize: 11,
              }}
            >
              <span style={{ color: colors.diffAddedBorder }}>+{additions}</span>
              {' '}
              <span style={{ color: colors.diffRemovedBorder }}>-{deletions}</span>
              {' lines changed'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Hunk block ───

function HunkBlock({
  hunk,
  colors,
  showHeader,
}: {
  hunk: DiffHunk
  colors: ReturnType<typeof useColors>
  showHeader: boolean
}) {
  const oldCount = hunk.lines.filter((l) => l.type !== 'addition').length
  const newCount = hunk.lines.filter((l) => l.type !== 'deletion').length

  return (
    <div>
      {showHeader && (
        <div
          style={{
            padding: '2px 10px',
            color: colors.diffHunkHeader,
            fontStyle: 'italic',
            fontSize: 11,
            background: colors.surfacePrimary,
            userSelect: 'none',
          }}
        >
          @@ -{hunk.oldStart},{oldCount} +{hunk.newStart},{newCount} @@
        </div>
      )}
      {hunk.lines.map((line, lineIdx) => (
        <DiffLineRow key={lineIdx} line={line} colors={colors} />
      ))}
    </div>
  )
}

// ─── Individual diff line ───

function DiffLineRow({
  line,
  colors,
}: {
  line: DiffLine
  colors: ReturnType<typeof useColors>
}) {
  const bgColor =
    line.type === 'addition' ? colors.diffAddedBg :
    line.type === 'deletion' ? colors.diffRemovedBg :
    'transparent'

  const borderColor =
    line.type === 'addition' ? colors.diffAddedBorder :
    line.type === 'deletion' ? colors.diffRemovedBorder :
    'transparent'

  const prefix =
    line.type === 'addition' ? '+' :
    line.type === 'deletion' ? '-' :
    ' '

  return (
    <div
      style={{
        display: 'flex',
        background: bgColor,
        borderLeft: `${BORDER_WIDTH}px solid ${borderColor}`,
        minHeight: 20,
        lineHeight: '20px',
      }}
    >
      {/* Old line number gutter */}
      <span
        style={{
          width: GUTTER_WIDTH,
          minWidth: GUTTER_WIDTH,
          textAlign: 'right',
          paddingRight: 4,
          color: colors.textMuted,
          userSelect: 'none',
          fontSize: 11,
        }}
      >
        {line.oldLineNum ?? ''}
      </span>

      {/* New line number gutter */}
      <span
        style={{
          width: GUTTER_WIDTH,
          minWidth: GUTTER_WIDTH,
          textAlign: 'right',
          paddingRight: 6,
          color: colors.textMuted,
          userSelect: 'none',
          fontSize: 11,
        }}
      >
        {line.newLineNum ?? ''}
      </span>

      {/* Prefix (+/-/space) */}
      <span
        style={{
          width: '2ch',
          minWidth: '2ch',
          color: line.type === 'addition' ? colors.diffAddedBorder
               : line.type === 'deletion' ? colors.diffRemovedBorder
               : colors.textMuted,
          userSelect: 'none',
        }}
      >
        {prefix}
      </span>

      {/* Line content */}
      <span
        style={{
          color: line.type === 'context' ? colors.textTertiary : colors.textPrimary,
          whiteSpace: 'pre',
          paddingRight: 10,
        }}
      >
        {line.content}
      </span>
    </div>
  )
}
