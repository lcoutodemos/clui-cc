// ─── Command Palette — Pure Logic (no renderer deps) ───

export interface PaletteCommand {
  id: string
  category: 'action' | 'tab' | 'model' | 'theme' | 'terminal'
  icon: string
  label: string
  description?: string
  shortcut?: string
}

export const MAX_RECENT_COMMANDS = 5

// ─── Fuzzy Scoring ───

const SCORE_EXACT_PREFIX = 100
const SCORE_WORD_PREFIX = 60
const SCORE_SUBSTRING = 40
const SCORE_FUZZY_CHAR = 10

/**
 * Score how well `query` matches `text`.
 * Returns 0 for no match. Higher = better.
 *
 * Hierarchy: exact prefix > word-boundary prefix > substring > fuzzy chars.
 */
export function fuzzyScore(query: string, text: string): number {
  if (query.length === 0) return 0

  const q = query.toLowerCase()
  const t = text.toLowerCase()

  // Exact prefix
  if (t.startsWith(q)) {
    return SCORE_EXACT_PREFIX + q.length
  }

  // Word-boundary prefix (e.g. "hist" matches "Open History" at word "History")
  const words = t.split(/[\s\-_/]+/)
  for (const word of words) {
    if (word.startsWith(q)) {
      return SCORE_WORD_PREFIX + q.length
    }
  }

  // Substring
  if (t.includes(q)) {
    return SCORE_SUBSTRING + q.length
  }

  // Fuzzy: every char in query appears in text in order
  let ti = 0
  let matched = 0
  for (let qi = 0; qi < q.length; qi++) {
    while (ti < t.length) {
      if (t[ti] === q[qi]) {
        matched++
        ti++
        break
      }
      ti++
    }
  }

  if (matched === q.length) {
    return SCORE_FUZZY_CHAR + matched
  }

  return 0
}

// ─── Filtering ───

/**
 * Filter and sort commands by fuzzy match against label, description, and id.
 * Returns all commands (original order) when query is empty.
 */
export function fuzzyFilter(commands: PaletteCommand[], query: string): PaletteCommand[] {
  if (query.trim().length === 0) return commands

  const scored: Array<{ command: PaletteCommand; score: number }> = []

  for (const command of commands) {
    const labelScore = fuzzyScore(query, command.label)
    const descScore = command.description ? fuzzyScore(query, command.description) : 0
    // ID match is a fallback — weight it lower so label/description wins
    const idScore = Math.floor(fuzzyScore(query, command.id) * 0.5)
    const best = Math.max(labelScore, descScore, idScore)
    if (best > 0) {
      scored.push({ command, score: best })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.command)
}

// ─── Recent Commands ───

/**
 * Add a command id to the front of the recent list.
 * Deduplicates and caps at MAX_RECENT_COMMANDS.
 */
export function addRecentCommand(recentIds: string[], commandId: string): string[] {
  const filtered = recentIds.filter((id) => id !== commandId)
  return [commandId, ...filtered].slice(0, MAX_RECENT_COMMANDS)
}

/**
 * Resolve recent command IDs to full PaletteCommand objects,
 * filtering out IDs that no longer exist in the commands list.
 */
export function getRecentCommands(recentIds: string[], commands: PaletteCommand[]): PaletteCommand[] {
  const commandMap = new Map(commands.map((c) => [c.id, c]))
  const result: PaletteCommand[] = []
  for (const id of recentIds) {
    const cmd = commandMap.get(id)
    if (cmd) result.push(cmd)
  }
  return result
}
