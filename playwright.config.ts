import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: 'output/playwright/test-results',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'output/playwright/report' }],
  ],
  retries: process.env.CI ? 1 : 0,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
})
