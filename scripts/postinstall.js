#!/usr/bin/env node
const { spawnSync } = require('child_process')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })

  if (result.error) {
    console.warn(`[postinstall] ${command} skipped: ${result.error.message}`)
    process.exit(0)
  }

  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1)
  }
}

const isCi = /^(1|true)$/i.test(process.env.CI ?? '')

if (isCi) {
  console.log('[postinstall] skipping electron-builder install-app-deps in CI')
} else {
  run(process.execPath, [require.resolve('electron-builder/out/cli/cli.js'), 'install-app-deps'])
}

if (process.platform !== 'darwin') {
  process.exit(0)
}

run('bash', ['scripts/patch-dev-icon.sh'])
