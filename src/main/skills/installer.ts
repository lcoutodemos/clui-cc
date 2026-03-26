/**
 * Skill installer — ensures manifest skills are present in ~/.claude/skills/.
 *
 * Runs on app startup (non-blocking). Uses atomic install:
 *   tmp dir → validate → rename into place.
 *
 * Respects user-managed skills: if a skill dir exists without .clui-version,
 * it was placed there by the user and we don't touch it.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, cpSync, readdirSync, lstatSync, realpathSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { spawnSync } from 'child_process'
import { randomUUID } from 'crypto'
import { SKILLS, type SkillEntry } from './manifest'

/** Directory containing bundled skill sources (relative to main process __dirname) */
const BUNDLED_SKILLS_DIR = join(__dirname, '../../skills')

const SKILLS_DIR = join(homedir(), '.claude', 'skills')
const VERSION_FILE = '.clui-version'

export type SkillState = 'pending' | 'downloading' | 'validating' | 'installed' | 'failed' | 'skipped'

export interface SkillStatus {
  name: string
  state: SkillState
  error?: string
  reason?: 'up-to-date' | 'user-managed'
}

interface VersionMeta {
  version: string
  source: string
  installedBy: string
  installedAt: string
}

function log(msg: string): void {
  const { appendFileSync } = require('fs')
  const line = `[${new Date().toISOString()}] [skills] ${msg}\n`
  try { appendFileSync(join(homedir(), '.clui-debug.log'), line) } catch {}
}

function readVersionFile(skillDir: string): VersionMeta | null {
  const fp = join(skillDir, VERSION_FILE)
  if (!existsSync(fp)) return null
  try {
    return JSON.parse(readFileSync(fp, 'utf-8'))
  } catch {
    return null
  }
}

function writeVersionFile(skillDir: string, entry: SkillEntry): void {
  const meta: VersionMeta = {
    version: entry.version,
    source: entry.source.type === 'github'
      ? `github:${entry.source.repo}@${entry.source.commitSha}`
      : 'bundled',
    installedBy: 'clui',
    installedAt: new Date().toISOString(),
  }
  writeFileSync(join(skillDir, VERSION_FILE), JSON.stringify(meta, null, 2) + '\n')
}

/**
 * Recursively walks dir and throws if any symlink resolves to a path outside dir.
 * Defends against malicious tarballs that include symlinks pointing to sensitive
 * files on the host (e.g. ~/.ssh/id_rsa, /etc/passwd).
 */
export function assertNoSymlinkEscape(dir: string): void {
  const base = realpathSync(dir)

  const scan = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isSymbolicLink()) {
        // realpathSync follows the chain to the final target
        const target = realpathSync(full)
        if (!target.startsWith(base + '/') && target !== base) {
          throw new Error(`Symlink escape detected: ${full} → ${target}`)
        }
      } else if (entry.isDirectory()) {
        scan(full)
      }
    }
  }

  scan(base)
}

function validateSkill(dir: string, requiredFiles: string[]): string | null {
  for (const f of requiredFiles) {
    if (!existsSync(join(dir, f))) {
      return `Missing required file: ${f}`
    }
  }
  return null
}

async function installGithubSkill(
  entry: SkillEntry & { source: { type: 'github'; repo: string; path: string; commitSha: string } },
  onStatus: (s: SkillStatus) => void,
): Promise<void> {
  const targetDir = join(SKILLS_DIR, entry.name)
  const tmpDir = join(SKILLS_DIR, `.tmp-${entry.name}-${randomUUID().slice(0, 8)}`)

  onStatus({ name: entry.name, state: 'downloading' })
  log(`Downloading ${entry.name} from ${entry.source.repo}@${entry.source.commitSha}`)

  try {
    mkdirSync(tmpDir, { recursive: true })

    // Download pinned tarball and extract only the skill subdirectory.
    // GitHub tarballs have a top-level directory like "anthropics-skills-<sha>/".
    // We strip the top-level + intermediate path components to get just the skill files.
    const { repo, path, commitSha } = entry.source
    const pathDepth = path.split('/').length + 1 // +1 for the github top-level dir
    const tarballUrl = `https://api.github.com/repos/${repo}/tarball/${commitSha}`

    // Use curl piped to tar via spawn — no shell interpolation, arguments passed directly
    // to each binary so special characters in tmpDir or path cannot escape into shell.
    const curl = spawnSync('/usr/bin/curl', ['-sL', tarballUrl], { timeout: 60000, maxBuffer: 100 * 1024 * 1024 })
    if (curl.status !== 0) {
      throw new Error(`curl failed (exit ${curl.status}): ${curl.stderr?.toString().trim()}`)
    }

    const tar = spawnSync(
      '/usr/bin/tar',
      // --no-symlinks: refuse to create symlinks during extraction (first line of defence)
      ['-xz', '--no-symlinks', `--strip-components=${pathDepth}`, '-C', tmpDir, `*/${path}`],
      { input: curl.stdout, timeout: 30000 },
    )
    if (tar.status !== 0) {
      throw new Error(`tar failed (exit ${tar.status}): ${tar.stderr?.toString().trim()}`)
    }

    // Second line of defence: scan the extracted tree and reject any symlink that
    // resolves outside tmpDir (catches hardlinks-as-symlinks, old tar versions that
    // ignore --no-symlinks, or any future extraction path we missed).
    assertNoSymlinkEscape(tmpDir)

    // Validate extracted files
    onStatus({ name: entry.name, state: 'validating' })
    const err = validateSkill(tmpDir, entry.requiredFiles)
    if (err) {
      throw new Error(`Validation failed: ${err}`)
    }

    // Atomic swap: remove old (if CLUI-managed), rename tmp into place
    if (existsSync(targetDir)) {
      const existing = readVersionFile(targetDir)
      if (existing?.installedBy === 'clui') {
        rmSync(targetDir, { recursive: true, force: true })
      } else {
        // User-managed — shouldn't reach here (checked earlier), but be safe
        rmSync(tmpDir, { recursive: true, force: true })
        onStatus({ name: entry.name, state: 'skipped', reason: 'user-managed' })
        return
      }
    }

    renameSync(tmpDir, targetDir)
    writeVersionFile(targetDir, entry)

    log(`Installed ${entry.name} v${entry.version}`)
    onStatus({ name: entry.name, state: 'installed' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`Failed to install ${entry.name}: ${msg}`)

    // Clean up tmp dir on failure
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}

    onStatus({ name: entry.name, state: 'failed', error: msg })
  }
}

async function installBundledSkill(
  entry: SkillEntry,
  onStatus: (s: SkillStatus) => void,
): Promise<void> {
  const sourceDir = join(BUNDLED_SKILLS_DIR, entry.name)
  const targetDir = join(SKILLS_DIR, entry.name)
  const tmpDir = join(SKILLS_DIR, `.tmp-${entry.name}-${randomUUID().slice(0, 8)}`)

  onStatus({ name: entry.name, state: 'downloading' }) // "downloading" reused for copy
  log(`Copying bundled skill ${entry.name} from ${sourceDir}`)

  try {
    if (!existsSync(sourceDir)) {
      throw new Error(`Bundled skill source not found: ${sourceDir}`)
    }

    mkdirSync(tmpDir, { recursive: true })
    cpSync(sourceDir, tmpDir, { recursive: true })

    // Validate
    onStatus({ name: entry.name, state: 'validating' })
    const err = validateSkill(tmpDir, entry.requiredFiles)
    if (err) {
      throw new Error(`Validation failed: ${err}`)
    }

    // Atomic swap
    if (existsSync(targetDir)) {
      const existing = readVersionFile(targetDir)
      if (existing?.installedBy === 'clui') {
        rmSync(targetDir, { recursive: true, force: true })
      } else {
        rmSync(tmpDir, { recursive: true, force: true })
        onStatus({ name: entry.name, state: 'skipped', reason: 'user-managed' })
        return
      }
    }

    renameSync(tmpDir, targetDir)
    writeVersionFile(targetDir, entry)

    log(`Installed bundled skill ${entry.name} v${entry.version}`)
    onStatus({ name: entry.name, state: 'installed' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`Failed to install bundled skill ${entry.name}: ${msg}`)
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    onStatus({ name: entry.name, state: 'failed', error: msg })
  }
}

async function installSkill(
  entry: SkillEntry,
  onStatus: (s: SkillStatus) => void,
): Promise<void> {
  const targetDir = join(SKILLS_DIR, entry.name)

  // Check if already installed and up-to-date
  if (existsSync(targetDir)) {
    const meta = readVersionFile(targetDir)

    if (!meta) {
      // Dir exists but no .clui-version — user-managed, don't touch
      log(`Skipping ${entry.name}: user-managed (no ${VERSION_FILE})`)
      onStatus({ name: entry.name, state: 'skipped', reason: 'user-managed' })
      return
    }

    if (meta.version === entry.version && meta.installedBy === 'clui') {
      // Re-validate required files to detect corrupt/partial installs
      const validationErr = validateSkill(targetDir, entry.requiredFiles)
      if (!validationErr) {
        log(`Skipping ${entry.name}: already at v${entry.version}`)
        onStatus({ name: entry.name, state: 'skipped', reason: 'up-to-date' })
        return
      }
      log(`Repairing ${entry.name}: version matches but ${validationErr}`)
    }

    // Version mismatch — needs update
    log(`Updating ${entry.name}: v${meta.version} → v${entry.version}`)
  }

  // Ensure parent dir exists
  mkdirSync(SKILLS_DIR, { recursive: true })

  if (entry.source.type === 'github') {
    await installGithubSkill(
      entry as SkillEntry & { source: { type: 'github'; repo: string; path: string; commitSha: string } },
      onStatus,
    )
  } else {
    await installBundledSkill(entry, onStatus)
  }
}

/**
 * Ensure all manifest skills are installed. Non-blocking, non-crashing.
 * Calls onStatus for each skill as it progresses through states.
 */
export async function ensureSkills(
  onStatus: (s: SkillStatus) => void = () => {},
): Promise<void> {
  log(`Checking ${SKILLS.length} skill(s)`)

  for (const entry of SKILLS) {
    onStatus({ name: entry.name, state: 'pending' })
    try {
      await installSkill(entry, onStatus)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`Unexpected error installing ${entry.name}: ${msg}`)
      onStatus({ name: entry.name, state: 'failed', error: msg })
    }
  }

  log('Skill provisioning complete')
}
