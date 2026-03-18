import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'path'
import { homedir } from 'os'
import { getProjectSessionKey } from './session-path'
import type { Attachment, AutoAttachConfig, AutoAttachState } from '../shared/types'

const AUTO_ATTACH_DIR = join(homedir(), '.clui', 'auto-attach')
const MAX_FILE_SIZE = 512 * 1024
const MAX_TOTAL_SIZE = 2 * 1024 * 1024
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.toml': 'text/toml',
  '.ts': 'text/plain',
  '.tsx': 'text/plain',
  '.js': 'text/plain',
  '.jsx': 'text/plain',
}

function ensureAutoAttachDir(): void {
  if (!existsSync(AUTO_ATTACH_DIR)) {
    mkdirSync(AUTO_ATTACH_DIR, { recursive: true })
  }
}

function normalizePathForCompare(filePath: string): string {
  return resolve(filePath).replace(/\\/g, '/').toLowerCase()
}

function isWithinProject(projectRoot: string, filePath: string): boolean {
  const root = normalizePathForCompare(projectRoot)
  const target = normalizePathForCompare(filePath)
  return target === root || target.startsWith(`${root}/`)
}

function normalizeProjectRoot(projectPath: string): string {
  return resolve(projectPath === '~' ? homedir() : projectPath)
}

function normalizeRelativePath(projectRoot: string, inputPath: string): string | null {
  const resolvedPath = isAbsolute(inputPath)
    ? resolve(inputPath)
    : resolve(projectRoot, inputPath)

  if (!isWithinProject(projectRoot, resolvedPath)) {
    return null
  }

  const nextRelative = relative(projectRoot, resolvedPath).replace(/\\/g, '/')
  if (!nextRelative || nextRelative.startsWith('..')) {
    return null
  }

  return nextRelative
}

function buildAttachment(filePath: string, relativePath: string, size: number): Attachment {
  const ext = extname(filePath).toLowerCase()
  const mimeType = MIME_MAP[ext] || 'application/octet-stream'
  let dataUrl: string | undefined

  if (IMAGE_EXTS.has(ext)) {
    try {
      const buf = readFileSync(filePath)
      dataUrl = `data:${mimeType};base64,${buf.toString('base64')}`
    } catch {}
  }

  return {
    id: crypto.randomUUID(),
    type: IMAGE_EXTS.has(ext) ? 'image' : 'file',
    name: relativePath || basename(filePath),
    path: filePath,
    mimeType,
    dataUrl,
    size,
    autoAttached: true,
  }
}

export class AutoAttachManager {
  constructor(private readonly baseDir = AUTO_ATTACH_DIR) {}

  getState(projectPath: string): AutoAttachState {
    const config = this.getConfig(projectPath)
    return this.buildState(config)
  }

  setFiles(projectPath: string, files: string[]): AutoAttachState {
    const projectRoot = normalizeProjectRoot(projectPath)
    const warnings: string[] = []
    const deduped = new Set<string>()

    for (const file of files) {
      const normalized = normalizeRelativePath(projectRoot, file)
      if (!normalized) {
        warnings.push(`${file} is outside the project and was ignored.`)
        continue
      }
      deduped.add(normalized)
    }

    const config: AutoAttachConfig = {
      projectPath: projectRoot,
      files: [...deduped],
    }

    this.writeConfig(config)
    const state = this.buildState(config)
    return {
      ...state,
      warnings: [...warnings, ...state.warnings],
    }
  }

  addFiles(projectPath: string, absolutePaths: string[]): AutoAttachState {
    const current = this.getConfig(projectPath)
    return this.setFiles(current.projectPath, [...current.files, ...absolutePaths])
  }

  removeFile(projectPath: string, relativePath: string): AutoAttachState {
    const current = this.getConfig(projectPath)
    return this.setFiles(
      current.projectPath,
      current.files.filter((file) => file !== relativePath),
    )
  }

  private buildState(config: AutoAttachConfig): AutoAttachState {
    const projectRoot = normalizeProjectRoot(config.projectPath)
    const attachments: Attachment[] = []
    const warnings: string[] = []
    let totalBytes = 0

    for (const relativePath of config.files) {
      const normalized = normalizeRelativePath(projectRoot, relativePath)
      if (!normalized) {
        warnings.push(`${relativePath} is outside the project and was skipped.`)
        continue
      }

      const fullPath = resolve(projectRoot, normalized)
      if (!existsSync(fullPath)) {
        warnings.push(`${normalized} does not exist and was skipped.`)
        continue
      }

      const stats = statSync(fullPath)
      if (!stats.isFile()) {
        warnings.push(`${normalized} is not a file and was skipped.`)
        continue
      }

      if (stats.size > MAX_FILE_SIZE) {
        warnings.push(`${normalized} exceeds 512KB and was skipped.`)
        continue
      }

      if (totalBytes + stats.size > MAX_TOTAL_SIZE) {
        warnings.push(`${normalized} would exceed the 2MB auto-attach limit and was skipped.`)
        continue
      }

      attachments.push(buildAttachment(fullPath, normalized, stats.size))
      totalBytes += stats.size
    }

    return {
      config: {
        projectPath: projectRoot,
        files: config.files,
      },
      attachments,
      warnings,
    }
  }

  private getConfig(projectPath: string): AutoAttachConfig {
    const projectRoot = normalizeProjectRoot(projectPath)
    const filePath = this.getConfigPath(projectRoot)

    try {
      if (!existsSync(filePath)) {
        return { projectPath: projectRoot, files: [] }
      }

      const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
      const files = Array.isArray(raw?.files)
        ? raw.files.filter((file: unknown): file is string => typeof file === 'string')
        : []

      return {
        projectPath: projectRoot,
        files,
      }
    } catch {
      return { projectPath: projectRoot, files: [] }
    }
  }

  private writeConfig(config: AutoAttachConfig): void {
    const filePath = this.getConfigPath(config.projectPath)
    const dirPath = dirname(filePath)

    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true })
    }

    ensureAutoAttachDir()
    writeFileSync(filePath, JSON.stringify({ files: config.files }, null, 2), 'utf-8')
  }

  private getConfigPath(projectPath: string): string {
    ensureAutoAttachDir()
    return join(this.baseDir, `${getProjectSessionKey(projectPath)}.json`)
  }
}
