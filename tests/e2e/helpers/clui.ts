import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import type { Page, TestInfo } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { _electron as electron } from 'playwright'

export interface CluiAppSession {
  electronApp: ElectronApplication
  page: Page
  homeDir: string
  settingsPath: string
}

export function createIsolatedHome(testInfo: TestInfo): {
  homeDir: string
  appDataDir: string
  localAppDataDir: string
  settingsPath: string
} {
  const homeDir = testInfo.outputPath('home')
  const appDataDir = path.join(homeDir, 'AppData', 'Roaming')
  const localAppDataDir = path.join(homeDir, 'AppData', 'Local')
  const settingsPath = path.join(homeDir, '.claude', 'settings.json')

  fs.mkdirSync(appDataDir, { recursive: true })
  fs.mkdirSync(localAppDataDir, { recursive: true })
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })

  return { homeDir, appDataDir, localAppDataDir, settingsPath }
}

export async function launchCluiApp(testInfo: TestInfo, homeDir?: string): Promise<CluiAppSession> {
  const isolated = homeDir
    ? {
        homeDir,
        appDataDir: path.join(homeDir, 'AppData', 'Roaming'),
        localAppDataDir: path.join(homeDir, 'AppData', 'Local'),
        settingsPath: path.join(homeDir, '.claude', 'settings.json'),
      }
    : createIsolatedHome(testInfo)

  fs.mkdirSync(isolated.appDataDir, { recursive: true })
  fs.mkdirSync(isolated.localAppDataDir, { recursive: true })
  fs.mkdirSync(path.dirname(isolated.settingsPath), { recursive: true })

  const electronApp = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1',
      CLUI_E2E: '1',
      CLUI_CLAUDE_BIN: process.execPath,
      CLUI_CLAUDE_NODE_SCRIPT: path.join(process.cwd(), 'tests', 'e2e', 'fixtures', 'fake-claude.cjs'),
      HOME: isolated.homeDir,
      USERPROFILE: isolated.homeDir,
      APPDATA: isolated.appDataDir,
      LOCALAPPDATA: isolated.localAppDataDir,
    },
  })

  const page = await electronApp.firstWindow()
  await page.waitForSelector('[data-testid="app-root"]')

  return {
    electronApp,
    page,
    homeDir: isolated.homeDir,
    settingsPath: isolated.settingsPath,
  }
}

export async function dismissPermissionWizard(page: Page): Promise<void> {
  const wizard = page.getByTestId('permission-wizard')
  if (await wizard.count()) {
    await page.getByTestId('permission-wizard-apply').click()
    await wizard.waitFor({ state: 'detached' })
  }
}
