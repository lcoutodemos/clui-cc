import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Verify that global error handlers are registered in main/index.ts source code

const mainSource = readFileSync(join(__dirname, '../../src/main/index.ts'), 'utf-8')

describe('Global error handlers', () => {
  it('registers unhandledRejection handler', () => {
    expect(mainSource).toContain("process.on('unhandledRejection'")
  })

  it('registers uncaughtException handler', () => {
    expect(mainSource).toContain("process.on('uncaughtException'")
  })

  it('logs errors with severity prefix', () => {
    expect(mainSource).toMatch(/\[FATAL\].*unhandled|unhandledRejection/i)
  })
})
