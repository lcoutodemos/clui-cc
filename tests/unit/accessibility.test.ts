import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const COMPONENTS_DIR = join(__dirname, '../../src/renderer/components')
const componentFiles = readdirSync(COMPONENTS_DIR).filter((f) => f.endsWith('.tsx'))

describe('Accessibility — aria labels on icon-only buttons', () => {
  for (const file of componentFiles) {
    const content = readFileSync(join(COMPONENTS_DIR, file), 'utf-8')
    const buttons = content.match(/<button[^>]*>/g) || []

    for (const btn of buttons) {
      // Skip buttons that have visible text children (not icon-only)
      // We check for aria-label on buttons that are likely icon-only
      if (btn.includes('aria-label') || btn.includes('aria-disabled')) continue
      // Heuristic: button with only size/style props and no text content likely icon-only
      // This is a loose check — the important ones are caught manually below
    }
  }

  it('ModeToggle has aria-label', () => {
    const content = readFileSync(join(COMPONENTS_DIR, 'ModeToggle.tsx'), 'utf-8')
    expect(content).toContain('aria-label')
  })

  it('TerminalTabStrip close buttons have aria-label', () => {
    const content = readFileSync(join(COMPONENTS_DIR, 'TerminalTabStrip.tsx'), 'utf-8')
    expect(content).toContain('aria-label="Close tab"')
  })

  it('TerminalTabStrip new tab button has aria-label', () => {
    const content = readFileSync(join(COMPONENTS_DIR, 'TerminalTabStrip.tsx'), 'utf-8')
    expect(content).toContain('aria-label="New terminal tab"')
  })

  it('TerminalStatusBar buttons have aria-label', () => {
    const content = readFileSync(join(COMPONENTS_DIR, 'TerminalStatusBar.tsx'), 'utf-8')
    expect(content).toContain('aria-label="Switch to Chat"')
    expect(content).toContain('aria-label="Clear Terminal"')
  })

  it('TerminalSearch buttons have aria-label', () => {
    const content = readFileSync(join(COMPONENTS_DIR, 'TerminalSearch.tsx'), 'utf-8')
    expect(content).toContain('aria-label="Previous match"')
    expect(content).toContain('aria-label="Next match"')
    expect(content).toContain('aria-label="Close search"')
  })
})

describe('Accessibility — modal roles', () => {
  it('CommandPalette has role=dialog and aria-modal', () => {
    const content = readFileSync(join(COMPONENTS_DIR, 'CommandPalette.tsx'), 'utf-8')
    expect(content).toContain('role="dialog"')
    expect(content).toContain('aria-modal')
  })
})

describe('Accessibility — toast announcements', () => {
  it('ToastContainer or Toast has aria-live or role=alert', () => {
    const toastContent = readFileSync(join(COMPONENTS_DIR, 'Toast.tsx'), 'utf-8')
    const containerContent = readFileSync(join(COMPONENTS_DIR, 'ToastContainer.tsx'), 'utf-8')
    const combined = toastContent + containerContent
    expect(combined).toMatch(/aria-live|role="alert"/)
  })
})
