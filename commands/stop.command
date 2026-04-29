#!/bin/bash

# Resolve to repo root (one level up from commands/)
cd "$(dirname "$0")/.."

REPO_DIR="$(pwd)"
PID_FILE=".clui.pid"
stopped=0

# ── 1. Try tracked PID first ──

if [ -f "$PID_FILE" ]; then
  APP_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
    # Kill the process group (app + all child helpers)
    kill -TERM -"$APP_PID" 2>/dev/null || kill -TERM "$APP_PID" 2>/dev/null

    # Wait up to 3 seconds for graceful shutdown
    for i in 1 2 3; do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 1
    done

    # Force kill if still alive
    if kill -0 "$APP_PID" 2>/dev/null; then
      kill -KILL -"$APP_PID" 2>/dev/null || kill -KILL "$APP_PID" 2>/dev/null
      sleep 0.5
    fi

    stopped=1
  fi
  rm -f "$PID_FILE"
fi

# ── 2. Fallback: pattern-based kill for anything missed ──

leftover_pids=$(pgrep -f "$REPO_DIR/node_modules/electron" 2>/dev/null || true)
leftover_pids="$leftover_pids $(pgrep -f "$REPO_DIR/dist/main" 2>/dev/null || true)"
leftover_pids=$(echo "$leftover_pids" | xargs)

if [ -n "$leftover_pids" ]; then
  # Graceful first
  kill -TERM $leftover_pids 2>/dev/null
  sleep 2

  # Force kill survivors
  for pid in $leftover_pids; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null
    fi
  done
  stopped=1
fi

# ── 3. Verify ──

sleep 0.5
remaining=$(pgrep -f "$REPO_DIR/node_modules/electron" 2>/dev/null || true)
remaining="$remaining $(pgrep -f "$REPO_DIR/dist/main" 2>/dev/null || true)"
remaining=$(echo "$remaining" | xargs)

if [ -n "$remaining" ]; then
  echo "Warning: some processes could not be stopped:"
  echo "  PIDs: $remaining"
  echo
  echo "  To force kill manually:"
  echo "    kill -9 $remaining"
else
  if [ "$stopped" -eq 1 ]; then
    echo "Clui CC stopped."
  else
    echo "Clui CC was not running."
  fi
fi
