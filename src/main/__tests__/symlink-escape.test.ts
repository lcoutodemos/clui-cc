import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'fs'
import { join, sep } from 'path'
import { tmpdir } from 'os'
import { assertNoSymlinkEscape } from '../skills/installer'

// Each test gets a fresh isolated temp directory
let base: string
let outside: string

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'clui-symtest-'))
  outside = mkdtempSync(join(tmpdir(), 'clui-outside-'))
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

describe('assertNoSymlinkEscape', () => {
  it('passes for a directory with no symlinks', () => {
    writeFileSync(join(base, 'skill.md'), '# skill')
    mkdirSync(join(base, 'sub'))
    writeFileSync(join(base, 'sub', 'file.ts'), 'export {}')

    expect(() => assertNoSymlinkEscape(base)).not.toThrow()
  })

  it('passes for a symlink that points to a file inside the base directory', () => {
    writeFileSync(join(base, 'real.md'), 'content')
    symlinkSync(join(base, 'real.md'), join(base, 'link.md'))

    expect(() => assertNoSymlinkEscape(base)).not.toThrow()
  })

  it('throws when a top-level symlink points outside the base directory', () => {
    writeFileSync(join(outside, 'secret'), 'sensitive data')
    symlinkSync(join(outside, 'secret'), join(base, 'escape'))

    expect(() => assertNoSymlinkEscape(base)).toThrow('Symlink escape detected')
  })

  it('throws when a nested symlink points outside the base directory', () => {
    mkdirSync(join(base, 'deep', 'nested'), { recursive: true })
    writeFileSync(join(outside, 'target'), 'exfiltrated')
    symlinkSync(join(outside, 'target'), join(base, 'deep', 'nested', 'escape'))

    expect(() => assertNoSymlinkEscape(base)).toThrow('Symlink escape detected')
  })

  it('throws for a symlink to a sensitive path like ~/.ssh/id_rsa (simulated)', () => {
    // Simulate the classic tarball attack: skill/config → /etc/passwd equivalent
    writeFileSync(join(outside, 'passwd'), 'root:x:0:0')
    symlinkSync(join(outside, 'passwd'), join(base, 'config'))

    expect(() => assertNoSymlinkEscape(base)).toThrow('Symlink escape detected')
  })

  it('throws for a symlink chain where the final target is outside', () => {
    // Chain: base/link1 → base/link2 → outside/secret
    // realpathSync must follow the full chain
    writeFileSync(join(outside, 'secret'), 'exfil')
    symlinkSync(join(outside, 'secret'), join(base, 'link2'))
    symlinkSync(join(base, 'link2'), join(base, 'link1'))

    expect(() => assertNoSymlinkEscape(base)).toThrow('Symlink escape detected')
  })

  it('throws when the error message includes the offending symlink path', () => {
    writeFileSync(join(outside, 'target'), 'data')
    const escapeLink = join(base, 'evil-link')
    symlinkSync(join(outside, 'target'), escapeLink)

    let msg = ''
    try { assertNoSymlinkEscape(base) } catch (e) { msg = String(e) }

    // Error must identify the symlink path so operators can diagnose which file is malicious
    expect(msg).toContain('evil-link')
    expect(msg).toContain(sep) // contains a path separator — it's a real path, not a vague message
  })
})
