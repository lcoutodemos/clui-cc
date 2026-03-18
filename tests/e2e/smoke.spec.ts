import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { dismissPermissionWizard, launchCluiApp } from './helpers/clui'

test('shows permission wizard on first launch and persists balanced preset', async ({}, testInfo) => {
  const firstLaunch = await launchCluiApp(testInfo)

  await expect(firstLaunch.page.getByTestId('permission-wizard')).toBeVisible()
  await firstLaunch.page.getByTestId('permission-preset-balanced').click()
  await firstLaunch.page.getByTestId('permission-wizard-apply').click()
  await expect(firstLaunch.page.getByTestId('permission-wizard')).toHaveCount(0)

  await expect.poll(() => fs.existsSync(firstLaunch.settingsPath)).toBe(true)

  const settings = JSON.parse(fs.readFileSync(firstLaunch.settingsPath, 'utf8'))
  expect(settings.permissions.allow).toContain('Bash(git:*)')
  expect(settings.permissions.allow).toHaveLength(19)

  await firstLaunch.electronApp.close()

  const secondLaunch = await launchCluiApp(testInfo, firstLaunch.homeDir)

  await expect(secondLaunch.page.getByTestId('permission-wizard')).toHaveCount(0)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await secondLaunch.page.getByTestId('settings-button').click()
    if (await secondLaunch.page.getByTestId('settings-permissions-button').isVisible()) {
      break
    }
    await secondLaunch.page.waitForTimeout(200)
  }
  await expect(secondLaunch.page.getByTestId('settings-permissions-button')).toBeVisible()
  await secondLaunch.page.getByTestId('settings-permissions-button').click()
  await expect(secondLaunch.page.getByTestId('permission-editor')).toBeVisible()
  await expect(secondLaunch.page.getByText('Bash(git:*)')).toBeVisible()
  await expect(secondLaunch.page.getByTestId('permission-count')).toHaveText('19')

  await secondLaunch.electronApp.close()
})

test('creates a tab and renders a fake Claude response end-to-end', async ({}, testInfo) => {
  const { electronApp, page } = await launchCluiApp(testInfo)

  await dismissPermissionWizard(page)

  await page.getByTestId('tab-new-button').click()
  await expect(page.locator('[role="tab"]')).toHaveCount(2)

  await page.locator('[role="tab"]').last().click()
  await expect(page.getByText('Choose folder')).toBeVisible()

  await page.getByTestId('composer-input').fill('say hello from e2e')
  await page.getByTestId('composer-send').click()

  await expect(page.getByTestId('conversation-view').getByText('say hello from e2e')).toBeVisible()
  await expect(page.getByTestId('conversation-view').getByText('Fake response to: say hello from e2e')).toBeVisible()

  await electronApp.close()
})
