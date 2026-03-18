import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: [
        'src/renderer/components/InputBar.tsx',
        'src/renderer/components/ConversationView.tsx',
        'src/renderer/components/TabStrip.tsx',
        'src/renderer/components/CommandPalette.tsx',
        'src/renderer/components/CostDashboard.tsx',
        'src/renderer/components/SettingsPopover.tsx',
        'src/renderer/components/DiffViewer.tsx',
        'src/renderer/components/WorkflowManager.tsx',
        'src/renderer/components/Toast.tsx',
        'src/renderer/components/ToastContainer.tsx',
        'src/renderer/components/ErrorBoundary.tsx',
      ],
      exclude: ['src/preload/**'],
    },
    // Allow mocking process.platform for cross-platform tests
    unstubGlobals: true,
    restoreMocks: true,
  },
})
