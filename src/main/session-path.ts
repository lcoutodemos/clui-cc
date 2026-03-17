/**
 * Session path encoding — must match Claude CLI's encoding exactly.
 *
 * Claude CLI stores project sessions at:
 *   ~/.claude/projects/<encoded-path>/
 *
 * Encoding rules (verified against real Windows session directories):
 *   - Backslash (\) → dash (-)
 *   - Forward slash (/) → dash (-)
 *   - Colon (:) → dash (-)
 *   - All other characters preserved as-is (including spaces, unicode)
 *   - Consecutive dashes are NOT collapsed (C:\ → C--)
 */
export function getProjectSessionKey(projectPath: string): string {
  return projectPath
    .replace(/[\\/:]/g, '-')
}
