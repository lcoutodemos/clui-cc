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
 * - Windows: uses PowerShell with System.Drawing (full screen capture)
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
    const escapedPath = outputPath.replace(/\\/g, '\\\\')
    const psScript = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      'Add-Type -AssemblyName System.Drawing;',
      '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;',
      '$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height);',
      '$gfx = [System.Drawing.Graphics]::FromImage($bmp);',
      '$gfx.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);',
      `$bmp.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png);`,
      '$gfx.Dispose();',
      '$bmp.Dispose();',
    ].join(' ')

    return {
      program: 'powershell',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
    }
  }

  return null
}
