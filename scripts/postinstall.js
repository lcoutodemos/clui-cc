#!/usr/bin/env node
const { spawnSync } = require('child_process')

if (process.platform !== 'darwin') {
  process.exit(0)
}

const result = spawnSync('bash', ['scripts/patch-dev-icon.sh'], { stdio: 'inherit' })
if (result.error) {
  console.warn(`[postinstall] icon patch skipped: ${result.error.message}`)
  process.exit(0)
}
process.exit(result.status ?? 0)
