import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const readmePath = path.resolve(__dirname, '..', '..', 'README.md')
const readme = fs.readFileSync(readmePath, 'utf8')

describe('README', () => {
  it('documents the core sections promised in issue #73', () => {
    expect(readme).toContain('# Clui CC')
    expect(readme).toContain('## What Is Clui CC')
    expect(readme).toContain('## Features')
    expect(readme).toContain('## Screenshots')
    expect(readme).toContain('## Prerequisites')
    expect(readme).toContain('## Quick Start')
    expect(readme).toContain('## Architecture')
    expect(readme).toContain('## Links')
  })

  it('lists the headline product capabilities that already exist in the app', () => {
    expect(readme).toContain('Multi-tab sessions with drag-to-reorder and tab groups')
    expect(readme).toContain('Command palette')
    expect(readme).toContain('Inline code diff viewer')
    expect(readme).toContain('Cost dashboard')
    expect(readme).toContain('Workflow chains')
    expect(readme).toContain('Git-aware context panel')
    expect(readme).toContain('Marketplace for skills and plugins')
    expect(readme).toContain('Session export')
    expect(readme).toContain('Voice input')
    expect(readme).toContain('Dark/light theme')
  })

  it('includes working setup instructions and platform prerequisites', () => {
    expect(readme).toContain('Node.js 18+')
    expect(readme).toContain('Claude Code CLI 2.1+')
    expect(readme).toContain('macOS 13+')
    expect(readme).toContain('Windows 10+')
    expect(readme).toContain('npm install')
    expect(readme).toContain('npm run dev')
    expect(readme).toContain('npm run build')
  })

  it('contains a text architecture diagram and links to deeper project docs', () => {
    expect(readme).toContain('Renderer')
    expect(readme).toContain('Preload')
    expect(readme).toContain('Main')
    expect(readme).toContain('Claude Code CLI')
    expect(readme).toContain('[CONTRIBUTING.md](CONTRIBUTING.md)')
    expect(readme).toContain('[SECURITY.md](SECURITY.md)')
    expect(readme).toContain('[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)')
  })

  it('embeds at least two screenshots in the README', () => {
    const screenshots = readme.match(/!\[[^\]]*]\([^)]+\)/g) ?? []
    expect(screenshots.length).toBeGreaterThanOrEqual(2)
  })
})
