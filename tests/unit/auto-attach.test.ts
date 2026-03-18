import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { AutoAttachManager } from '../../src/main/auto-attach'

describe('AutoAttachManager', () => {
  const testRoot = join(tmpdir(), `clui-auto-attach-${Date.now()}`)
  const configDir = join(testRoot, 'config')
  const projectDir = join(testRoot, 'project')
  const outsideDir = join(testRoot, 'outside')
  let manager: AutoAttachManager

  beforeEach(() => {
    mkdirSync(configDir, { recursive: true })
    mkdirSync(projectDir, { recursive: true })
    mkdirSync(outsideDir, { recursive: true })
    manager = new AutoAttachManager(configDir)
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('persists relative auto-attach files and resolves them as attachments', () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), '# hello', 'utf-8')

    const state = manager.setFiles(projectDir, ['CLAUDE.md'])
    const reloaded = new AutoAttachManager(configDir).getState(projectDir)

    expect(state.config.files).toEqual(['CLAUDE.md'])
    expect(reloaded.attachments).toHaveLength(1)
    expect(reloaded.attachments[0].name).toBe('CLAUDE.md')
    expect(reloaded.attachments[0].autoAttached).toBe(true)
  })

  it('rejects files outside the project root', () => {
    writeFileSync(join(outsideDir, 'secrets.txt'), 'secret', 'utf-8')

    const state = manager.addFiles(projectDir, [join(outsideDir, 'secrets.txt')])

    expect(state.config.files).toEqual([])
    expect(state.warnings[0]).toContain('outside the project')
  })

  it('skips files that exceed the per-file size limit', () => {
    writeFileSync(join(projectDir, 'big.txt'), Buffer.alloc(600 * 1024, 1))

    const state = manager.setFiles(projectDir, ['big.txt'])

    expect(state.attachments).toHaveLength(0)
    expect(state.warnings[0]).toContain('exceeds 512KB')
  })

  it('skips files once the total auto-attach budget is exhausted', () => {
    const files = ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt']
    for (const file of files) {
      writeFileSync(join(projectDir, file), Buffer.alloc(450 * 1024, 1))
    }

    const state = manager.setFiles(projectDir, files)

    expect(state.attachments).toHaveLength(4)
    expect(state.warnings.some((warning) => warning.includes('2MB auto-attach limit'))).toBe(true)
  })
})
