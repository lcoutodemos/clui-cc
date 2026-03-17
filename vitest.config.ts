import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
      exclude: ['src/renderer/**', 'src/preload/**'],
    },
    // Allow mocking process.platform for cross-platform tests
    unstubGlobals: true,
    restoreMocks: true,
  },
})
