import { describe, it, expect } from 'vitest'
import { shellSingleQuote } from '../shell-utils'

describe('shellSingleQuote', () => {
  it('wraps a simple path in single quotes', () => {
    expect(shellSingleQuote('/home/user/project')).toBe("'/home/user/project'")
  })

  it('escapes embedded single quotes using the close-escape-reopen pattern', () => {
    // "it's" → 'it'\''s'
    expect(shellSingleQuote("/tmp/it's here")).toBe("'/tmp/it'\\''s here'")
  })

  it('does NOT escape double quotes — they are inert inside single-quoted strings', () => {
    const path = '/tmp/evil"; rm -rf /'
    const result = shellSingleQuote(path)
    // double-quote must appear verbatim inside the single-quoted string
    expect(result).toBe("'/tmp/evil\"; rm -rf /'")
  })

  it('does NOT escape dollar signs — shell expansion is blocked by single quotes', () => {
    const path = '/tmp/$HOME/foo'
    expect(shellSingleQuote(path)).toBe("'/tmp/$HOME/foo'")
  })

  it('does NOT escape backticks — command substitution is blocked by single quotes', () => {
    const path = '/tmp/`whoami`/foo'
    expect(shellSingleQuote(path)).toBe("'/tmp/`whoami`/foo'")
  })

  it('does NOT escape backslashes — they are literal inside single-quoted strings', () => {
    const path = '/tmp/foo\\bar'
    expect(shellSingleQuote(path)).toBe("'/tmp/foo\\bar'")
  })

  it('handles multiple consecutive single quotes', () => {
    expect(shellSingleQuote("a''b")).toBe("'a'\\'''\\''\\'b'")
    // Verify the escaped form is a valid shell sequence (structurally)
    // a   → 'a'
    // ''  → '\'''\''
    // b   → 'b'
  })

  it('handles empty string', () => {
    expect(shellSingleQuote('')).toBe("''")
  })

  it('handles a classic AppleScript injection payload', () => {
    // This was the original attack vector: a project path that could break
    // out of an AppleScript `do script "..."` string.
    const maliciousPath = '/tmp/test"; do shell script "rm -rf /"; echo "'
    const result = shellSingleQuote(maliciousPath)
    // The double quotes appear verbatim — inert inside single-quoted shell strings.
    // The result, when used in a shell `cd '<result>'`, is safe.
    expect(result.startsWith("'")).toBe(true)
    expect(result.endsWith("'")).toBe(true)
    // No shell-significant characters can escape when the whole thing is single-quoted
    expect(result).not.toContain('$(')
    expect(result).not.toContain('`')
  })
})
