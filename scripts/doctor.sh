#!/bin/bash
# Clui CC environment doctor — read-only diagnostics, no installs.

echo "Clui CC Environment Check"
echo "========================="
echo

fail=0
SDK_PATH=""

# Compare two dotted versions: returns 0 if $1 >= $2
version_gte() {
  [ "$(printf '%s\n%s' "$1" "$2" | sort -V | head -1)" = "$2" ]
}

check() {
  local label="$1"
  local ok="$2"
  local detail="$3"
  if [ "$ok" = "1" ]; then
    printf "  PASS  %s — %s\n" "$label" "$detail"
  else
    printf "  FAIL  %s — %s\n" "$label" "$detail"
    fail=1
  fi
}

# macOS
if [ "$(uname)" = "Darwin" ]; then
  ver=$(sw_vers -productVersion 2>/dev/null || echo "0")
  if version_gte "$ver" "13.0"; then
    check "macOS" "1" "$ver"
  else
    check "macOS" "0" "$ver — requires 13+"
  fi
else
  check "macOS" "0" "not macOS ($(uname)) — Clui CC requires macOS"
fi

# Node
if command -v node &>/dev/null; then
  node_ver=$(node --version | sed 's/^v//')
  if version_gte "$node_ver" "18.0.0"; then
    check "Node.js" "1" "v$node_ver"
  else
    check "Node.js" "0" "v$node_ver — requires 18+ — brew install node"
  fi
else
  check "Node.js" "0" "not found — brew install node"
fi

# npm
if command -v npm &>/dev/null; then
  check "npm" "1" "$(npm --version)"
else
  check "npm" "0" "not found — brew install node"
fi

# Python
if command -v python3 &>/dev/null; then
  pyver=$(python3 --version 2>&1 | awk '{print $2}')
  check "Python 3" "1" "$pyver"
else
  check "Python 3" "0" "not found — brew install python@3.11"
fi

# distutils
if command -v python3 &>/dev/null; then
  if python3 -c "import distutils" 2>/dev/null; then
    check "distutils" "1" "importable"
  else
    check "distutils" "0" "missing — python3 -m pip install --upgrade pip setuptools"
  fi
else
  check "distutils" "0" "skipped (no python3)"
fi

# Xcode CLT
if xcode-select -p &>/dev/null; then
  check "Xcode CLT" "1" "$(xcode-select -p)"
else
  check "Xcode CLT" "0" "not installed — xcode-select --install"
fi

# macOS SDK
if xcrun --sdk macosx --show-sdk-path &>/dev/null; then
  SDK_PATH=$(xcrun --sdk macosx --show-sdk-path)
  check "macOS SDK" "1" "$SDK_PATH"
else
  check "macOS SDK" "0" "not found — reinstall Xcode CLT"
fi

# clang++
if command -v clang++ &>/dev/null; then
  cver=$(clang++ --version 2>&1 | head -1)
  check "clang++" "1" "$cver"

  # C++ headers (only probe if clang++ exists)
  PROBE_DIR=$(mktemp -d)
  echo '#include <functional>' > "$PROBE_DIR/probe.cpp"
  echo 'int main() { return 0; }' >> "$PROBE_DIR/probe.cpp"
  if clang++ -std=c++17 -c "$PROBE_DIR/probe.cpp" -o "$PROBE_DIR/probe.o" 2>/dev/null; then
    check "C++ headers" "1" "<functional> compiles"
  elif [ -n "$SDK_PATH" ] && clang++ -std=c++17 -isysroot "$SDK_PATH" -I"$SDK_PATH/usr/include/c++/v1" -c "$PROBE_DIR/probe.cpp" -o "$PROBE_DIR/probe.o" 2>/dev/null; then
    check "C++ headers" "1" "<functional> compiles (using SDK include path)"
  else
    check "C++ headers" "0" "<functional> missing — reinstall Xcode CLT"
  fi
  rm -rf "$PROBE_DIR"
else
  check "clang++" "0" "not found — xcode-select --install"
  check "C++ headers" "0" "skipped (no clang++)"
fi

# Claude CLI
if command -v claude &>/dev/null; then
  cver=$(claude --version 2>/dev/null || echo "unknown")
  check "Claude CLI" "1" "$cver"
else
  check "Claude CLI" "0" "not found — npm install -g @anthropic-ai/claude-code"
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "Some checks failed. Fix them above, then rerun:"
  echo
  echo "  ./commands/setup.command"
else
  echo "Environment looks good."
fi
