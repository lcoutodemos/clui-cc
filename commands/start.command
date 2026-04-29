#!/bin/bash
set -e

# Resolve to repo root (one level up from commands/)
cd "$(dirname "$0")/.."

if [ ! -d "node_modules" ]; then
  echo "Dependencies not installed."
  echo
  echo "  If this is your first time, run:"
  echo "    ./commands/setup.command"
  echo
  echo "  Or install manually:"
  echo "    npm install"
  echo
  exit 1
fi

# Clean stale PID file
PID_FILE=".clui.pid"
if [ -f "$PID_FILE" ]; then
  old_pid=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$old_pid" ] && ! kill -0 "$old_pid" 2>/dev/null; then
    rm -f "$PID_FILE"
  fi
fi

echo "Building Clui CC..."
if ! npx electron-vite build --mode production; then
  echo
  echo "Build failed. Try: rm -rf node_modules && npm install"
  exit 1
fi

echo "Clui CC running. ⌥ + Space to toggle. Use ./commands/stop.command or tray icon > Quit to close."

# Launch in a new process group and record the PID
npx electron . &
APP_PID=$!
echo "$APP_PID" > "$PID_FILE"

# Clean up PID file when the app exits
wait "$APP_PID" 2>/dev/null
rm -f "$PID_FILE"
