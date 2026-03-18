/**
 * Diff algorithm (LCS-based) — produces unified-style diff hunks.
 * Pure logic, no React or DOM dependencies.
 *
 * Uses a standard LCS (Longest Common Subsequence) table to derive
 * the minimal edit script, then groups edits into context-bounded hunks.
 */

export interface DiffLine {
  type: 'addition' | 'deletion' | 'context'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

export interface DiffHunk {
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

/** Edit operation: 0 = context, -1 = deletion, 1 = addition */
type EditOp = { op: 0 | -1 | 1; line: string }

/**
 * Compute the LCS table between two line arrays.
 * dp[i][j] = length of LCS of a[0..i-1] and b[0..j-1]
 */
function lcsTable(a: string[], b: string[]): Uint16Array[] {
  const n = a.length
  const m = b.length
  // dp is (n+1) x (m+1), each row is a Uint16Array for memory efficiency
  const dp: Uint16Array[] = []
  for (let i = 0; i <= n; i++) {
    dp.push(new Uint16Array(m + 1))
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  return dp
}

/**
 * Backtrack the LCS table to produce an edit script.
 * Walks from dp[n][m] back to dp[0][0].
 */
function backtrack(dp: Uint16Array[], a: string[], b: string[]): EditOp[] {
  const edits: EditOp[] = []
  let i = a.length
  let j = b.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      edits.push({ op: 0, line: a[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({ op: 1, line: b[j - 1] })
      j--
    } else {
      edits.push({ op: -1, line: a[i - 1] })
      i--
    }
  }

  edits.reverse()
  return edits
}

/**
 * Generate unified diff hunks between two strings.
 * @param oldStr - Original text
 * @param newStr - Modified text
 * @param contextLines - Number of context lines around changes (default: 3)
 * @returns Array of diff hunks; empty if strings are identical
 */
export function generateDiff(oldStr: string, newStr: string, contextLines = 3): DiffHunk[] {
  if (oldStr === newStr) return []

  const oldLines = oldStr === '' ? [] : oldStr.split('\n')
  const newLines = newStr === '' ? [] : newStr.split('\n')

  if (oldLines.length === 0 && newLines.length === 0) return []

  const dp = lcsTable(oldLines, newLines)
  const edits = backtrack(dp, oldLines, newLines)

  // Assign line numbers
  interface NumberedEdit { op: 0 | -1 | 1; line: string; oldNum?: number; newNum?: number }
  const numbered: NumberedEdit[] = []
  let oldNum = 1
  let newNum = 1
  for (const e of edits) {
    if (e.op === 0) {
      numbered.push({ ...e, oldNum, newNum })
      oldNum++
      newNum++
    } else if (e.op === -1) {
      numbered.push({ ...e, oldNum })
      oldNum++
    } else {
      numbered.push({ ...e, newNum })
      newNum++
    }
  }

  // Find indices of all changed lines
  const changeIndices: number[] = []
  for (let i = 0; i < numbered.length; i++) {
    if (numbered[i].op !== 0) changeIndices.push(i)
  }

  if (changeIndices.length === 0) return []

  // Group changes into hunks with surrounding context
  const hunks: DiffHunk[] = []
  let hunkStart = Math.max(0, changeIndices[0] - contextLines)
  let hunkEnd = Math.min(numbered.length - 1, changeIndices[0] + contextLines)

  for (let ci = 1; ci < changeIndices.length; ci++) {
    const nextStart = Math.max(0, changeIndices[ci] - contextLines)
    const nextEnd = Math.min(numbered.length - 1, changeIndices[ci] + contextLines)

    if (nextStart <= hunkEnd + 1) {
      hunkEnd = nextEnd
    } else {
      hunks.push(buildHunk(numbered, hunkStart, hunkEnd))
      hunkStart = nextStart
      hunkEnd = nextEnd
    }
  }
  hunks.push(buildHunk(numbered, hunkStart, hunkEnd))

  return hunks
}

function buildHunk(
  edits: Array<{ op: 0 | -1 | 1; line: string; oldNum?: number; newNum?: number }>,
  start: number,
  end: number,
): DiffHunk {
  const first = edits[start]
  const oldStart = first.op === 1 ? (first.newNum ?? 1) : (first.oldNum ?? 1)
  const newStart = first.op === -1 ? (first.oldNum ?? 1) : (first.newNum ?? 1)

  const lines: DiffLine[] = []
  for (let i = start; i <= end; i++) {
    const e = edits[i]
    lines.push({
      type: e.op === 0 ? 'context' : e.op === -1 ? 'deletion' : 'addition',
      content: e.line,
      oldLineNum: e.oldNum,
      newLineNum: e.newNum,
    })
  }

  return { oldStart, newStart, lines }
}
