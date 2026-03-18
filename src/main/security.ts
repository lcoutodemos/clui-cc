/**
 * Security utilities for Clui CC.
 *
 * Centralizes input sanitization, path validation, and binary verification
 * to prevent shell injection, path traversal, and binary hijacking.
 */

import { existsSync, statSync, realpathSync } from 'fs'
import { resolve, normalize, isAbsolute } from 'path'
import { homedir } from 'os'
import { log as _log } from './logger'

function log(msg: string): void {
  _log('security', msg)
}

// ─── Shell Argument Sanitization ───

/**
 * Validates that a string is safe to use as a shell argument.
 * Rejects strings containing shell metacharacters that could enable injection.
 */
export function isShellSafe(input: string): boolean {
  if (input.includes('\0')) return false
  const DANGEROUS_CHARS = /[;&|`$(){}[\]<>!\n\r]/
  return !DANGEROUS_CHARS.test(input)
}

/**
 * Validates a session ID (UUID v4 format only).
 */
export function isValidSessionId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/**
 * Validates a tab ID (UUID v4 format only).
 */
export function isValidTabId(id: string): boolean {
  return isValidSessionId(id)
}

// ─── Path Validation ───

const ALLOWED_BASES = [
  homedir(),
  '/tmp',
  '/var/folders',
]

/**
 * Validates that a file path is absolute, has no traversal sequences,
 * and resolves within allowed directories.
 * Returns the resolved path if valid, or null if rejected.
 */
export function validateFilePath(inputPath: string, allowedBases?: string[]): string | null {
  if (!inputPath || typeof inputPath !== 'string') return null
  if (inputPath.includes('\0')) return null

  const normalized = normalize(inputPath)
  if (!isAbsolute(normalized)) return null

  const resolved = resolve(normalized)
  const bases = allowedBases || ALLOWED_BASES
  const isAllowed = bases.some((base) => resolved.startsWith(base))
  if (!isAllowed) {
    log(`Path rejected: ${inputPath} resolved to ${resolved} — not in allowed bases`)
    return null
  }

  return resolved
}

/**
 * Validates a project path for Claude session operations.
 */
export function validateProjectPath(inputPath: string): string | null {
  if (!inputPath || typeof inputPath !== 'string') return null
  if (inputPath === '~') return homedir()
  if (inputPath.includes('\0')) return null

  const resolved = resolve(inputPath.replace(/^~/, homedir()))
  if (!isAbsolute(resolved)) return null

  if (inputPath.includes('..')) {
    log(`Project path rejected — contains traversal: ${inputPath}`)
    return null
  }

  return resolved
}

// ─── Binary Verification ───

const TRUSTED_BIN_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/usr/sbin',
  '/bin',
  '/sbin',
  resolve(homedir(), '.local/bin'),
  resolve(homedir(), '.npm-global/bin'),
]

/**
 * Verifies that a binary path exists, is a regular file in a trusted
 * directory, and is not world-writable.
 */
export function verifyBinary(binPath: string): { trusted: boolean; reason: string } {
  if (!binPath || !isAbsolute(binPath)) {
    return { trusted: false, reason: 'Not an absolute path' }
  }

  if (!existsSync(binPath)) {
    return { trusted: false, reason: 'File does not exist' }
  }

  try {
    const realPath = realpathSync(binPath)
    const stat = statSync(realPath)

    if (!stat.isFile()) {
      return { trusted: false, reason: 'Not a regular file' }
    }

    const inTrustedDir = TRUSTED_BIN_DIRS.some((dir) => realPath.startsWith(dir + '/'))
    if (!inTrustedDir) {
      const nvmPattern = resolve(homedir(), '.nvm/versions/node')
      if (!realPath.startsWith(nvmPattern)) {
        return { trusted: false, reason: `Not in a trusted directory: ${realPath}` }
      }
    }

    if (stat.mode & 0o002) {
      return { trusted: false, reason: 'File is world-writable — possible tamper' }
    }

    return { trusted: true, reason: 'OK' }
  } catch (err) {
    return { trusted: false, reason: `Stat failed: ${(err as Error).message}` }
  }
}

// ─── AppleScript Sanitization ───

/**
 * Escapes a string for safe inclusion in AppleScript double-quoted strings.
 */
export function escapeAppleScript(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
}

// ─── URL Validation ───

/**
 * Validates that a URL is a safe HTTP(S) URL.
 */
export function isValidHttpUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return /^https?:\/\//i.test(url)
}
