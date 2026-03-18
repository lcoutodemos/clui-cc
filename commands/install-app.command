#!/bin/bash
# ──────────────────────────────────────────────────────
#  Clui CC — Install App
#
#  Double-click this file in Finder to:
#   1. Set up dependencies
#   2. Install voice support (Whisper)
#   3. Build a standalone macOS app
#   4. Copy it to /Applications
#   5. Clean temporary build files
#   6. Launch it
# ──────────────────────────────────────────────────────
set -e

# Resolve to repo root (one level up from commands/)
cd "$(dirname "$0")/.."

APP_NAME="Clui CC"
DEST="/Applications/${APP_NAME}.app"

step() { echo; echo "═══ $1 ═══"; echo; }

# ── 1. Setup ──

step "Step 1/6 — Setting up environment and dependencies"

if ! bash ./commands/setup.command; then
  echo
  echo "Setup failed. Fix the issues above, then double-click this file again."
  echo
  exit 1
fi

# ── 2. Whisper (required for voice input) ──

step "Step 2/6 — Checking voice support (Whisper)"

if command -v whisperkit-cli &>/dev/null || command -v whisper &>/dev/null; then
  echo "Whisper is already installed."
else
  echo "Whisper is not installed. Voice input requires it."
  echo

  if ! command -v brew &>/dev/null; then
    echo "Homebrew is required to install Whisper but was not found."
    echo
    echo "  Install Homebrew first:"
    echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo
    echo "  Then double-click this file again."
    echo
    exit 1
  fi

  echo "Installing Whisper via Homebrew..."
  echo
  if ! brew install whisperkit-cli; then
    echo
    echo "Whisper installation failed."
    echo
    echo "  Try running manually:"
    echo "    brew install whisperkit-cli"
    echo
    echo "  Then double-click this file again."
    echo
    exit 1
  fi

  # Verify
  if ! command -v whisperkit-cli &>/dev/null && ! command -v whisper &>/dev/null; then
    echo
    echo "Whisper was installed but the command is not available."
    echo
    echo "  Try opening a new Terminal window and running:"
    echo "    whisperkit-cli --help"
    echo
    echo "  If that works, double-click this file again."
    echo
    exit 1
  fi

  echo "Whisper installed successfully."
fi

# ── 3. Build ──

step "Step 3/6 — Building ${APP_NAME}.app"

if ! npm run dist; then
  echo
  echo "Build failed."
  echo
  echo "  Try these steps one at a time:"
  echo "    rm -rf node_modules"
  echo "    npm install"
  echo "    npm run dist"
  echo
  echo "  If it still fails, see docs/TROUBLESHOOTING.md"
  echo
  exit 1
fi

# ── 4. Detect and copy ──

step "Step 4/6 — Installing to /Applications"

APP_SOURCE=""
if [ -d "release/mac-arm64/${APP_NAME}.app" ]; then
  APP_SOURCE="release/mac-arm64/${APP_NAME}.app"
elif [ -d "release/mac/${APP_NAME}.app" ]; then
  APP_SOURCE="release/mac/${APP_NAME}.app"
fi

if [ -z "$APP_SOURCE" ]; then
  echo "Could not find the built app."
  echo
  echo "  Expected one of:"
  echo "    release/mac-arm64/${APP_NAME}.app  (Apple Silicon)"
  echo "    release/mac/${APP_NAME}.app        (Intel)"
  echo
  echo "  Check what was built:"
  echo "    ls release/"
  echo
  exit 1
fi

echo "Found: $APP_SOURCE"

if [ -d "$DEST" ]; then
  echo "Replacing existing ${APP_NAME} in /Applications..."
  rm -rf "$DEST"
fi

cp -R "$APP_SOURCE" "$DEST"
echo "Copied to $DEST"

# ── 5. Cleanup ──

step "Step 5/6 — Cleaning temporary build files"

if [ "${KEEP_BUILD_ARTIFACTS:-0}" = "1" ]; then
  echo "Keeping build artifacts (KEEP_BUILD_ARTIFACTS=1)."
else
  rm -rf ./dist ./release
  echo "Removed: dist/ and release/"
fi

# ── 6. Launch ──

step "Step 6/6 — Launching ${APP_NAME}"

open "$DEST"

echo "Done! ${APP_NAME} is running."
echo
echo "  Show/hide the overlay:  ⌥ + Space  (Option + Space)"
echo "  Quit:                   Click the menu bar icon > Quit"
echo
echo "  First launch: if macOS shows a security warning, go to"
echo "  System Settings > Privacy & Security > Open Anyway"
echo "  You only need to do this once."
echo
