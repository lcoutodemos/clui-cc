/**
 * Diagnostics bundle — collects system info and sanitized logs
 * for bug reports and support.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir, platform, arch, release } from 'os'

const LOG_FILE = join(homedir(), '.clui-debug.log')

export interface DiagnosticBundle {
  platform: string
  arch: string
  osRelease: string
  nodeVersion: string
  electronVersion: string
  timestamp: string
  debugLog: string
  errors: string[]
}

/**
 * Collect system info and recent debug log content.
 */
export function buildDiagnosticBundle(): DiagnosticBundle {
  let debugLog = ''
  try {
    if (existsSync(LOG_FILE)) {
      const full = readFileSync(LOG_FILE, 'utf-8')
      // Take last 500 lines
      const lines = full.split('\n')
      debugLog = lines.slice(-500).join('\n')
    }
  } catch {}

  return {
    platform: platform(),
    arch: arch(),
    osRelease: release(),
    nodeVersion: process.versions.node || 'unknown',
    electronVersion: process.versions.electron || 'unknown',
    timestamp: new Date().toISOString(),
    debugLog,
    errors: [],
  }
}

/**
 * Remove PII, secrets, and user-specific paths from a diagnostic bundle.
 */
export function sanitizeBundle(bundle: DiagnosticBundle): DiagnosticBundle {
  return {
    ...bundle,
    debugLog: sanitizeText(bundle.debugLog),
    errors: bundle.errors.map(sanitizeText),
  }
}

function sanitizeText(text: string): string {
  return text
    // Mask home directory paths
    .replace(new RegExp(escapeRegex(homedir()), 'gi'), '<HOME>')
    // Mask API keys and tokens
    .replace(/\b(sk-[a-zA-Z0-9_-]{10,})\b/g, '<REDACTED_KEY>')
    .replace(/\b(Bearer\s+)[^\s]+/gi, '$1<REDACTED_TOKEN>')
    // Mask password-like values
    .replace(/(password|secret|token|key|auth|credential)s?\s*[=:]\s*\S+/gi, '$1=<REDACTED>')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
