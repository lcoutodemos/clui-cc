#!/bin/bash
set -e

DIAG_FILE="$HOME/.clui-last-run.json"
LOG_FILE="$HOME/.clui-debug.log"

if [ ! -f "$DIAG_FILE" ]; then
  echo "No CLUI run diagnostics found yet."
  echo
  echo "Send one prompt in Clui CC, then run this command again."
  exit 0
fi

echo "CLUI last-run diagnostics"
echo "File: $DIAG_FILE"
echo

if command -v node >/dev/null 2>&1; then
  node - "$DIAG_FILE" <<'NODE'
const fs = require('fs')
const path = process.argv[2]
const data = JSON.parse(fs.readFileSync(path, 'utf8'))
const t = data.timings || {}

function line(label, value) {
  if (value === undefined || value === null || value === '') return
  console.log(`${label}: ${value}`)
}

line('Run ID', data.runId)
line('Claude binary', data.claudeBinary)
line('CWD', data.cwd)
line('Used resume', data.usedResume)
line('Model', data.model || 'Claude Code default')
line('Permission mode', data.permissionMode)
line('Effort', data.effort || 'Claude Code default')
line('Prompt chars', data.promptChars)
line('Prompt bytes', data.promptBytes)
line('Appended system prompt chars', data.appendedSystemPromptChars)
line('Appended system prompt approx tokens', data.appendedSystemPromptApproxTokens)
line('Add-dir count', data.addDirCount)
console.log('')
console.log('Timings')
line('Client to IPC', t.clientToIpcMs != null ? `${t.clientToIpcMs} ms` : null)
line('IPC to spawn', t.ipcToSpawnMs != null ? `${t.ipcToSpawnMs} ms` : null)
line('Spawn to first raw event', t.spawnToFirstRawEventMs != null ? `${t.spawnToFirstRawEventMs} ms` : null)
line('Spawn to first text chunk', t.spawnToFirstTextChunkMs != null ? `${t.spawnToFirstTextChunkMs} ms` : null)
line('Wall time', t.wallTimeMs != null ? `${t.wallTimeMs} ms` : null)
line('Claude reported duration', t.claudeDurationMs != null ? `${t.claudeDurationMs} ms` : null)
console.log('')
line('Cost USD', data.costUsd)
line('Turns', data.numTurns)
line('Tool calls', data.toolCallCount)
line('Permission request seen', data.sawPermissionRequest)
line('Exit code', data.exitCode)
line('Signal', data.signal)
if (data.usage) {
  console.log('')
  console.log('Usage')
  for (const [key, value] of Object.entries(data.usage)) line(key, value)
}
console.log('')
console.log('Claude args')
console.log((data.args || []).join(' '))
NODE
else
  cat "$DIAG_FILE"
fi

echo
echo "Debug log: $LOG_FILE"
