import { execFile } from 'child_process'
import type { GitStatus, GitFileStatus } from '../shared/types'

const MAX_DIFF_BYTES = 50 * 1024 // 50 KB

/**
 * Provides git status and diff information for a working directory.
 * Uses child_process.execFile (no shell) to prevent injection.
 */
export class GitContextProvider {
  async getStatus(cwd: string): Promise<GitStatus> {
    try {
      const stdout = await this.exec('git', ['status', '--porcelain', '-b'], cwd)
      return parseStatus(stdout)
    } catch {
      return { isRepo: false, branch: null, files: [] }
    }
  }

  async getDiff(cwd: string, file?: string): Promise<string> {
    try {
      const args = ['diff']
      if (file) {
        args.push('--', file)
      }
      const stdout = await this.exec('git', args, cwd)
      if (stdout.length > MAX_DIFF_BYTES) {
        return stdout.slice(0, MAX_DIFF_BYTES) + '\n\n--- Diff truncated at 50 KB ---'
      }
      return stdout
    } catch {
      return ''
    }
  }

  private exec(cmd: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, { cwd, maxBuffer: 1024 * 1024, timeout: 10000 }, (error, stdout) => {
        if (error) {
          reject(error)
        } else {
          resolve(stdout)
        }
      })
    })
  }
}

/**
 * Parse `git status --porcelain -b` output.
 *
 * First line: `## branch...tracking`
 * Subsequent lines: XY path (or XY old -> new for renames)
 */
export function parseStatus(raw: string): GitStatus {
  const lines = raw.split('\n').filter((l) => l.length > 0)

  let branch: string | null = null
  const files: GitFileStatus[] = []

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Branch line: "## main...origin/main" or "## HEAD (no branch)" or "## main"
      const branchPart = line.slice(3)
      const dotIndex = branchPart.indexOf('...')
      branch = dotIndex >= 0 ? branchPart.slice(0, dotIndex) : branchPart
      // Handle detached HEAD
      if (branch === 'HEAD (no branch)') {
        branch = 'HEAD (detached)'
      }
      continue
    }

    // File status lines: XY <path> or XY <old> -> <new>
    if (line.length < 4) continue

    const xy = line.slice(0, 2)
    const pathPart = line.slice(3)

    // Map porcelain XY codes to our simplified status
    const status = mapStatus(xy)
    if (status) {
      // For renames, extract the new path
      const arrowIndex = pathPart.indexOf(' -> ')
      const filePath = arrowIndex >= 0 ? pathPart.slice(arrowIndex + 4) : pathPart
      files.push({ status, path: filePath })
    }
  }

  return { isRepo: true, branch, files }
}

function mapStatus(xy: string): GitFileStatus['status'] | null {
  // XY: X = index status, Y = work-tree status
  // We show the most relevant status
  const x = xy[0]
  const y = xy[1]

  if (xy === '??') return '?'
  if (x === 'R' || y === 'R') return 'R'
  if (x === 'A' || y === 'A') return 'A'
  if (x === 'D' || y === 'D') return 'D'
  if (x === 'M' || y === 'M') return 'M'
  // Catch-all for other statuses (C, U, etc.)
  if (x !== ' ' || y !== ' ') return 'M'
  return null
}
