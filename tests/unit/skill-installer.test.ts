import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'stream'
import { EventEmitter } from 'events'

// Mock modules before importing the module under test
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    rmSync: vi.fn(),
    cpSync: vi.fn(),
    appendFileSync: vi.fn(),
  }
})

vi.mock('https', () => ({
  get: vi.fn(),
}))

vi.mock('zlib', async () => {
  const actual = await vi.importActual<typeof import('zlib')>('zlib')
  return {
    ...actual,
    createGunzip: vi.fn(() => {
      const passthrough = new (require('stream').PassThrough)()
      return passthrough
    }),
  }
})

import { downloadAndExtractTarball } from '../../src/main/skills/download'

describe('downloadAndExtractTarball', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects on HTTP error status', async () => {
    const https = await import('https')
    const mockGet = vi.mocked(https.get)

    mockGet.mockImplementation((_url: any, cb: any) => {
      const response = new Readable({ read() {} }) as any
      response.statusCode = 404
      response.headers = {}
      cb(response)
      response.push(null)
      return new EventEmitter() as any
    })

    await expect(
      downloadAndExtractTarball('https://example.com/tarball', '/tmp/out', 2, 'skills/test')
    ).rejects.toThrow('HTTP 404')
  })

  it('follows redirects (301/302)', async () => {
    const https = await import('https')
    const mockGet = vi.mocked(https.get)

    let callCount = 0
    mockGet.mockImplementation((_url: any, cb: any) => {
      callCount++
      const response = new Readable({ read() {} }) as any

      if (callCount === 1) {
        response.statusCode = 302
        response.headers = { location: 'https://example.com/real-tarball' }
        cb(response)
        response.push(null)
      } else {
        // Second call should error to stop the chain (we're testing redirect following)
        response.statusCode = 500
        response.headers = {}
        cb(response)
        response.push(null)
      }
      return new EventEmitter() as any
    })

    await expect(
      downloadAndExtractTarball('https://example.com/tarball', '/tmp/out', 2, 'skills/test')
    ).rejects.toThrow('HTTP 500')

    // Verify it followed the redirect
    expect(callCount).toBe(2)
    expect(mockGet).toHaveBeenCalledWith('https://example.com/real-tarball', expect.any(Function))
  })

  it('rejects on too many redirects', async () => {
    const https = await import('https')
    const mockGet = vi.mocked(https.get)

    mockGet.mockImplementation((_url: any, cb: any) => {
      const response = new Readable({ read() {} }) as any
      response.statusCode = 302
      response.headers = { location: 'https://example.com/loop' }
      cb(response)
      response.push(null)
      return new EventEmitter() as any
    })

    await expect(
      downloadAndExtractTarball('https://example.com/tarball', '/tmp/out', 2, 'skills/test')
    ).rejects.toThrow('Too many redirects')
  })

  it('rejects on network error', async () => {
    const https = await import('https')
    const mockGet = vi.mocked(https.get)

    mockGet.mockImplementation((_url: any, _cb: any) => {
      const req = new EventEmitter() as any
      req.destroy = vi.fn()
      req.setTimeout = vi.fn()
      setTimeout(() => req.emit('error', new Error('ECONNREFUSED')), 10)
      return req
    })

    await expect(
      downloadAndExtractTarball('https://example.com/tarball', '/tmp/out', 2, 'skills/test')
    ).rejects.toThrow('ECONNREFUSED')
  })

  it('rejects on timeout', async () => {
    const https = await import('https')
    const mockGet = vi.mocked(https.get)

    mockGet.mockImplementation((_url: any, _cb: any) => {
      const req = new EventEmitter() as any
      req.destroy = vi.fn()
      req.setTimeout = vi.fn()
      setTimeout(() => req.emit('timeout'), 10)
      return req
    })

    await expect(
      downloadAndExtractTarball('https://example.com/tarball', '/tmp/out', 2, 'skills/test')
    ).rejects.toThrow('timed out')
  })
})
