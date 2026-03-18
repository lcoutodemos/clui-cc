/**
 * Screenshot command builder — platform-aware capture flow.
 */

import { join } from 'path'
import { tmpdir } from 'os'

export interface ScreenshotCommand {
  program: string
  args: string[]
}

let counter = 0

/**
 * Returns a unique temp path for a screenshot file.
 */
export function getScreenshotTempPath(): string {
  return join(tmpdir(), `clui-screenshot-${Date.now()}-${++counter}.png`)
}

/**
 * Build the platform-appropriate screenshot capture command.
 *
 * - macOS: uses `/usr/sbin/screencapture -i` (interactive region select)
 * - Windows: uses SnippingTool.exe /clip (interactive region select → clipboard → file)
 * - Linux: returns null (not supported)
 */
export function buildScreenshotCommand(outputPath: string): ScreenshotCommand | null {
  if (process.platform === 'darwin') {
    return {
      program: '/usr/sbin/screencapture',
      args: ['-i', outputPath],
    }
  }

  if (process.platform === 'win32') {
    const escapedPath = outputPath.replace(/'/g, "''")
    // Launch Snipping Tool for interactive region select, then save clipboard to file.
    // If user cancels the snip, clipboard won't have an image → file won't be created.
    const psScript = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      'Add-Type -AssemblyName System.Drawing;',
      '[System.Windows.Forms.Clipboard]::Clear();',
      '$p = Start-Process -FilePath "SnippingTool.exe" -ArgumentList "/clip" -PassThru;',
      '$p.WaitForExit();',
      '$img = [System.Windows.Forms.Clipboard]::GetImage();',
      `if ($img) { $img.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png); $img.Dispose() }`,
    ].join(' ')

    return {
      program: 'powershell',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
    }
  }

  return null
}
