# Troubleshooting

If setup fails, run this first:

```bash
npm run doctor        # macOS
npm run doctor:win    # Windows (PowerShell)
```

This checks your local environment and prints pass/fail status without changing your system.

---

## Common (All Platforms)

### App Launches but No Claude Response

Verify Claude CLI is installed and authenticated:

```bash
claude --version
```

```bash
claude
```

### Marketplace Shows "Failed to Load"

Expected when offline. Marketplace needs internet access; core app features continue to work.

---

## macOS

### Install Fails with "gyp" or "make" Errors

Install Xcode Command Line Tools, then retry:

```bash
xcode-select --install
```

```bash
npm install
```

### Install Fails with `ModuleNotFoundError: No module named 'distutils'`

Python 3.12+ removed `distutils`. Install `setuptools`:

```bash
python3 -m pip install --upgrade pip setuptools
```

```bash
npm install
```

If that still fails, install Python 3.11 and point npm to it:

```bash
brew install python@3.11
```

```bash
npm config set python $(brew --prefix python@3.11)/bin/python3.11
```

```bash
npm install
```

To undo that Python override later:

```bash
npm config delete python
```

### Install Fails with `fatal error: 'functional' file not found`

C++ headers are missing/broken, usually due to Xcode CLT issues.

Check toolchain first:

```bash
xcode-select -p
```

```bash
xcrun --sdk macosx --show-sdk-path
```

If either command fails (or the error persists), reinstall CLT:

```bash
sudo rm -rf /Library/Developer/CommandLineTools
```

```bash
xcode-select --install
```

Then retry:

```bash
npm install
```

If CLT is installed but the error still appears on newer macOS versions, compile explicitly against the SDK include path:

```bash
SDK=$(xcrun --sdk macosx --show-sdk-path)
clang++ -std=c++17 -isysroot "$SDK" -I"$SDK/usr/include/c++/v1" -x c++ - -o /dev/null <<'EOF'
#include <functional>
int main() { return 0; }
EOF
```

### Install Fails on `node-pty`

`node-pty` is native and requires macOS toolchains. Confirm:

- macOS 13+
- Xcode CLT installed
- Python 3 with `setuptools`/`distutils` available

Then retry `npm install`.

### `Alt+Space` Does Not Toggle

Grant Accessibility permissions:

- System Settings -> Privacy & Security -> Accessibility

Fallback shortcut:

- `Cmd+Shift+K`

### Window Is Invisible / No UI (macOS)

Try:

- `Cmd+Shift+K`
- Confirm app is running from the menu bar tray

---

## Windows

### `Ctrl+Space` Conflicts with IME

The default Windows shortcut (`Ctrl+Space`) conflicts with Input Method Editors (IME) used for CJK languages. To resolve:

- Open Settings in the app and change the toggle shortcut to a non-conflicting key combination.

### `npm install` Fails with node-gyp Errors

Native modules (like `node-pty`) require C++ build tools on Windows.

1. Install Visual Studio Build Tools:
   ```
   winget install Microsoft.VisualStudio.2022.BuildTools
   ```
   Or download from https://visualstudio.microsoft.com/visual-cpp-build-tools/ and select "Desktop development with C++" workload.

2. Retry:
   ```bash
   npm install
   ```

### App Launches but Overlay Is Not Visible

This can happen with certain GPU drivers or remote desktop sessions.

- Try launching with GPU acceleration disabled:
  ```bash
  npx electron . --disable-gpu
  ```
- Update your GPU drivers to the latest version.
- Check if the app appears in the system tray (bottom-right notification area).

### "Permission Denied" or Claude CLI Not Found

Ensure `claude` is on your system PATH:

```bash
claude --version
```

If the command is not found:
- Reinstall the Claude Code CLI.
- Verify the install location is in your PATH environment variable.
- Restart your terminal after PATH changes.

### Spawn ENOENT Errors

If you see `spawn ENOENT` errors, the app cannot find `claude.cmd` or `claude.exe`. The app prefers `.cmd`/`.exe` over POSIX shims on Windows. Ensure you have the Windows-native Claude CLI install (not WSL).
