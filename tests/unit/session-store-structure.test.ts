import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('sessionStore structure', () => {
  it('stays lean after extracting focused domains', () => {
    const sessionStorePath = path.resolve(__dirname, '..', '..', 'src', 'renderer', 'stores', 'sessionStore.ts')
    const lines = fs.readFileSync(sessionStorePath, 'utf8').split(/\r?\n/).length

    expect(lines).toBeLessThan(400)
  })
})
