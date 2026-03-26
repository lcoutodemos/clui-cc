/**
 * Shell and script escaping utilities.
 * Extracted as pure functions so they can be tested independently.
 */

/**
 * Wraps a string in POSIX single quotes, escaping any single-quote characters
 * inside. Single-quoted strings block all shell expansion ($, `, \, globs).
 *
 * Examples:
 *   /home/user        →  '/home/user'
 *   /tmp/it's here    →  '/tmp/it'\''s here'
 *   /foo"; rm -rf /   →  '/foo"; rm -rf /'
 */
export function shellSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'"
}
