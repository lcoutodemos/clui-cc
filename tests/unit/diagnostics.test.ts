import { describe, it, expect, vi } from 'vitest'
import { buildDiagnosticBundle, sanitizeBundle } from '../../src/main/diagnostics'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
  }
})

describe('diagnostics', () => {
  it('buildDiagnosticBundle returns system info', () => {
    const bundle = buildDiagnosticBundle()
    expect(bundle.platform).toBeDefined()
    expect(bundle.arch).toBeDefined()
    expect(bundle.nodeVersion).toBeDefined()
    expect(bundle.electronVersion).toBeDefined()
    expect(typeof bundle.timestamp).toBe('string')
  })

  it('sanitizeBundle removes sensitive paths', () => {
    const raw = {
      platform: 'win32',
      arch: 'x64',
      nodeVersion: '20.0.0',
      electronVersion: '33.0.0',
      timestamp: new Date().toISOString(),
      debugLog: 'C:\\Users\\secret-user\\AppData\\file.log contains api_key=sk-12345',
      errors: [],
    }

    const sanitized = sanitizeBundle(raw)
    expect(sanitized.debugLog).not.toContain('secret-user')
    expect(sanitized.debugLog).not.toContain('sk-12345')
  })

  it('sanitizeBundle masks tokens and keys', () => {
    const raw = {
      platform: 'darwin',
      arch: 'arm64',
      nodeVersion: '20.0.0',
      electronVersion: '33.0.0',
      timestamp: new Date().toISOString(),
      debugLog: 'Authorization: Bearer sk-ant-1234567890 and password=hunter2',
      errors: [],
    }

    const sanitized = sanitizeBundle(raw)
    expect(sanitized.debugLog).not.toContain('sk-ant-1234567890')
    expect(sanitized.debugLog).not.toContain('hunter2')
  })
})
