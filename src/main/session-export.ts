import { dialog, type BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { buildSessionExportContent } from '../shared/session-export'
import type { ExportOptions, SessionExportData, SessionExportResult } from '../shared/types'

export async function exportSessionToFile(
  mainWindow: BrowserWindow | null,
  data: SessionExportData,
  options: ExportOptions,
): Promise<SessionExportResult> {
  try {
    const extension = options.format === 'json' ? 'json' : 'md'
    const content = buildSessionExportContent(data, options)
    const fileName = `${slugify(data.title || data.sessionId || 'session-export')}.${extension}`
    const defaultDir = existsSync(data.projectPath) ? data.projectPath : homedir()
    const dialogOptions = {
      title: 'Export Session',
      defaultPath: join(defaultDir, fileName),
      filters: [
        options.format === 'json'
          ? { name: 'JSON', extensions: ['json'] }
          : { name: 'Markdown', extensions: ['md'] },
      ],
    }

    const result = process.platform === 'darwin' || !mainWindow
      ? await dialog.showSaveDialog(dialogOptions)
      : await dialog.showSaveDialog(mainWindow, dialogOptions)

    if (result.canceled || !result.filePath) {
      return { ok: true, path: null }
    }

    await writeFile(result.filePath, content, 'utf8')
    return { ok: true, path: result.filePath }
  } catch (error) {
    return {
      ok: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'session-export'
}
