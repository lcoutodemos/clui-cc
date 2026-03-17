/**
 * Native Node.js tarball download and extraction.
 *
 * Replaces the POSIX-only `curl | tar` pipeline with cross-platform
 * Node.js built-in modules (https, zlib, tar header parsing).
 */

import * as https from 'https'
import { createGunzip } from 'zlib'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'

const MAX_REDIRECTS = 5
const TIMEOUT_MS = 60_000
const USER_AGENT = 'clui-cc/0.1.0'

/**
 * Download a GitHub tarball and extract a specific subdirectory into `outDir`.
 *
 * @param url        - Tarball URL (e.g., GitHub API tarball endpoint)
 * @param outDir     - Directory to extract files into
 * @param stripDepth - Number of leading path components to strip (like tar --strip-components)
 * @param filterPath - Only extract files under this path prefix (like tar's path filter)
 */
export function downloadAndExtractTarball(
  url: string,
  outDir: string,
  stripDepth: number,
  filterPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let redirectCount = 0

    function doRequest(reqUrl: string) {
      const req = https.get(reqUrl, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
        // Handle redirects
        if (res.statusCode && (res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          redirectCount++
          if (redirectCount > MAX_REDIRECTS) {
            reject(new Error('Too many redirects'))
            return
          }
          doRequest(res.headers.location)
          return
        }

        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        const gunzip = createGunzip()
        const chunks: Buffer[] = []

        res.pipe(gunzip)

        gunzip.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })

        gunzip.on('end', () => {
          try {
            const data = Buffer.concat(chunks)
            extractTar(data, outDir, stripDepth, filterPath)
            resolve()
          } catch (err) {
            reject(err)
          }
        })

        gunzip.on('error', (err) => reject(err))
        res.on('error', (err) => reject(err))
      })

      req.on('error', (err) => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Download timed out'))
      })
      req.setTimeout(TIMEOUT_MS)
    }

    doRequest(url)
  })
}

/**
 * Parse and extract a tar archive from a Buffer.
 *
 * Supports both classic V7 tar and USTAR format:
 * - Reads the 155-byte `prefix` field at offset 345 for paths > 100 chars
 * - Handles type flag '0' (regular file) and '\0' (V7 regular file)
 */
function extractTar(
  data: Buffer,
  outDir: string,
  stripDepth: number,
  filterPath: string,
): void {
  let offset = 0

  while (offset < data.length - 512) {
    const header = data.subarray(offset, offset + 512)

    // Check for end-of-archive (two consecutive zero blocks)
    if (header.every((b) => b === 0)) break

    // Read file name: USTAR uses prefix (offset 345, 155 bytes) + name (offset 0, 100 bytes)
    const name = parseString(header, 0, 100)
    const prefix = parseString(header, 345, 155)
    const fileName = prefix ? `${prefix}/${name}` : name

    const size = parseOctal(header, 124, 12)
    const typeFlag = header[156]

    offset += 512 // move past header

    // Only process regular files (type '0' or null/empty)
    if (typeFlag === 48 /* '0' */ || typeFlag === 0) {
      const stripped = stripComponents(fileName, stripDepth)

      if (stripped && matchesFilter(fileName, stripDepth, filterPath)) {
        const outPath = join(outDir, stripped)
        mkdirSync(dirname(outPath), { recursive: true })
        writeFileSync(outPath, data.subarray(offset, offset + size))
      }
    }

    // Advance past file content (padded to 512-byte blocks)
    offset += Math.ceil(size / 512) * 512
  }
}

function parseString(buf: Buffer, offset: number, length: number): string {
  const raw = buf.subarray(offset, offset + length)
  const nullIdx = raw.indexOf(0)
  return raw.subarray(0, nullIdx === -1 ? length : nullIdx).toString('utf-8')
}

function parseOctal(buf: Buffer, offset: number, length: number): number {
  const str = parseString(buf, offset, length).trim()
  return parseInt(str, 8) || 0
}

function stripComponents(filePath: string, depth: number): string {
  const parts = filePath.split('/').filter(Boolean)
  if (parts.length <= depth) return ''
  return parts.slice(depth).join('/')
}

function matchesFilter(filePath: string, stripDepth: number, filterPath: string): boolean {
  if (!filterPath) return true
  const parts = filePath.split('/').filter(Boolean)
  // After the top-level dir (first component), check if remaining path starts with filterPath
  const afterTop = parts.slice(1).join('/')
  return afterTop.startsWith(filterPath)
}
