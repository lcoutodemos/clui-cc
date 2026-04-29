#!/bin/bash
set -e

# Resolve to repo root (one level up from commands/)
cd "$(dirname "$0")/.."

# ── Helpers ──

fail=0
SDK_PATH=""

step() { echo; echo "--- $1"; }
pass() { echo "  OK: $1"; }
fail() { echo "  FAIL: $1"; fail=1; }
fix() {
  echo
  echo "  To fix, copy and run this command:"
  echo
  echo "    $1"
  echo
}

version_gte() {
  [ "$(printf '%s\n%s' "$1" "$2" | sort -V | head -1)" = "$2" ]
}

# ── Preflight Checks ──

step "Checking environment"

# macOS
if [ "$(uname)" != "Darwin" ]; then
  fail "Clui CC requires macOS 13+. Detected: $(uname). This project does not run on Linux or Windows."
else
  macos_ver=$(sw_vers -productVersion 2>/dev/null || echo "0")
  if version_gte "$macos_ver" "13.0"; then
    pass "macOS $macos_ver"
  else
    fail "macOS $macos_ver is too old. Clui CC requires macOS 13+."
    echo "  Update macOS in System Settings > General > Software Update."
  fi
fi

# Node
if command -v node &>/dev/null; then
  node_ver=$(node --version | sed 's/^v//')
  if version_gte "$node_ver" "18.0.0"; then
    pass "Node.js v$node_ver"
  else
    fail "Node.js v$node_ver is too old. Clui CC requires Node 18+."
    fix "brew install node"
  fi
else
  fail "Node.js is not installed."
  fix "brew install node"
fi

# npm
if command -v npm &>/dev/null; then
  pass "npm $(npm --version)"
else
  fail "npm is not installed (should come with Node.js)."
  fix "brew install node"
fi

# Python 3 + distutils
if command -v python3 &>/dev/null; then
  pass "Python $(python3 --version 2>&1 | awk '{print $2}')"

  if python3 -c "import distutils" 2>/dev/null; then
    pass "Python distutils available"
  else
    fail "Python is missing 'distutils' (needed by native module compiler)."
    fix "python3 -m pip install --upgrade pip setuptools"
  fi
else
  fail "Python 3 is not installed."
  fix "brew install python@3.11"
fi

# Xcode CLT
if xcode-select -p &>/dev/null; then
  pass "Xcode CLT at $(xcode-select -p)"
else
  fail "Xcode Command Line Tools are not installed."
  fix "xcode-select --install"
fi

# macOS SDK
if xcrun --sdk macosx --show-sdk-path &>/dev/null; then
  SDK_PATH=$(xcrun --sdk macosx --show-sdk-path)
  pass "macOS SDK at $SDK_PATH"
else
  fail "macOS SDK not found. Xcode Command Line Tools may be broken."
  echo
  echo "  Try: xcode-select --install"
  echo "  If that doesn't help:"
  echo "    sudo rm -rf /Library/Developer/CommandLineTools"
  echo "    xcode-select --install"
  echo
fi

# C++ compiler + headers
if command -v clang++ &>/dev/null; then
  pass "clang++ available"

  PROBE_DIR=$(mktemp -d)
  echo '#include <functional>' > "$PROBE_DIR/probe.cpp"
  echo 'int main() { return 0; }' >> "$PROBE_DIR/probe.cpp"
  if clang++ -std=c++17 -c "$PROBE_DIR/probe.cpp" -o "$PROBE_DIR/probe.o" 2>/dev/null; then
    pass "C++ standard headers OK"
  elif [ -n "$SDK_PATH" ] && clang++ -std=c++17 -isysroot "$SDK_PATH" -I"$SDK_PATH/usr/include/c++/v1" -c "$PROBE_DIR/probe.cpp" -o "$PROBE_DIR/probe.o" 2>/dev/null; then
    pass "C++ standard headers OK (using SDK include path)"
  else
    fail "C++ headers are broken (<functional> not found)."
    echo
    echo "  Try: xcode-select --install"
    echo "  If that doesn't help:"
    echo "    sudo rm -rf /Library/Developer/CommandLineTools"
    echo "    xcode-select --install"
    echo
  fi
  rm -rf "$PROBE_DIR"
else
  fail "clang++ not found. Xcode Command Line Tools may be broken."
  fix "xcode-select --install"
fi

# Claude CLI
if command -v claude &>/dev/null; then
  pass "Claude Code CLI found"
else
  fail "Claude Code CLI is not installed."
  fix "npm install -g @anthropic-ai/claude-code"
fi

# Bail if any check failed
if [ "$fail" -ne 0 ]; then
  echo
  echo "Some checks failed. Fix them above, then rerun:"
  echo
  echo "  ./commands/setup.command"
  echo
  exit 1
fi

echo
echo "All checks passed."

# ── Install ──

step "Installing dependencies"
if [ -n "$SDK_PATH" ]; then
  export SDKROOT="$SDK_PATH"
  export CXXFLAGS="-isysroot $SDKROOT -I$SDKROOT/usr/include/c++/v1 ${CXXFLAGS:-}"
fi
if ! npm install; then
  echo
  echo "npm install failed. Most common fixes:"
  echo
  echo "  1. xcode-select --install"
  echo "  2. python3 -m pip install --upgrade pip setuptools"
  echo "  3. Rerun: ./commands/setup.command"
  echo
  exit 1
fi

# Guard against stale lockfiles/dependency trees that keep vulnerable versions.
installed_builder=$(node -p "require('./node_modules/electron-builder/package.json').version" 2>/dev/null || echo "")
installed_electron=$(node -p "require('./node_modules/electron/package.json').version" 2>/dev/null || echo "")

if [ -z "$installed_builder" ] || [ -z "$installed_electron" ]; then
  echo
  echo "Could not verify installed Electron dependencies."
  echo "Try:"
  echo "  rm -rf node_modules package-lock.json"
  echo "  npm install"
  echo "  ./commands/setup.command"
  echo
  exit 1
fi

if ! version_gte "$installed_builder" "26.8.1" || ! version_gte "$installed_electron" "35.7.5"; then
  echo
  echo "Detected outdated install (electron-builder $installed_builder, electron $installed_electron)."
  echo "Applying required security baseline..."
  echo
  npm install -D electron-builder@^26.8.1 electron@^35.7.5
fi

final_builder=$(node -p "require('./node_modules/electron-builder/package.json').version" 2>/dev/null || echo "")
final_electron=$(node -p "require('./node_modules/electron/package.json').version" 2>/dev/null || echo "")
echo "Installed: electron-builder $final_builder, electron $final_electron"

echo
echo "Setup complete. To launch the app, run:"
echo
echo "  ./commands/start.command"
echo
