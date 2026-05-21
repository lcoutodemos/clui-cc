import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

/** Claude encodes project paths as ~/.claude/projects/<path-with-slashes-as-dashes>/ */
export function encodeProjectPath(projectPath: string): string {
  const cwd = projectPath === '~' ? homedir() : projectPath
  return cwd.replace(/\//g, '-')
}

function modelsFilePath(projectPath: string): string {
  return join(homedir(), '.claude', 'projects', encodeProjectPath(projectPath), 'clui-models.json')
}

export function getSessionModel(projectPath: string, sessionId: string): string | null {
  try {
    const filePath = modelsFilePath(projectPath)
    if (!existsSync(filePath)) return null
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    const model = data[sessionId]
    return typeof model === 'string' ? model : null
  } catch {
    return null
  }
}

export function setSessionModel(projectPath: string, sessionId: string, modelId: string | null): void {
  const filePath = modelsFilePath(projectPath)
  mkdirSync(dirname(filePath), { recursive: true })

  let data: Record<string, string> = {}
  try {
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, string>
    }
  } catch {}

  if (modelId) {
    data[sessionId] = modelId
  } else {
    delete data[sessionId]
  }

  writeFileSync(filePath, JSON.stringify(data, null, 2))
}
