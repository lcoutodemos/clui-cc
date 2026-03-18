# Troubleshooting

If setup fails, run this first:

```bash
npm run doctor
```

This checks your local environment and prints pass/fail status without changing your system.

## Install Fails with "gyp" or "make" Errors

**macOS:** Install Xcode Command Line Tools, then retry:

```bash
xcode-select --install
```

```bash
npm install
```

**Linux:** Install build essentials and pkg-config:

```bash
# Debian/Ubuntu
sudo apt install build-essential pkg-config python3 python3-setuptools

# Fedora/RHEL
sudo dnf groupinstall "Development Tools" && sudo dnf install pkg-config python3-setuptools

# Arch
sudo pacman -S base-devel pkg-config python-setuptools
```

```bash
npm install
```

## Install Fails with `ModuleNotFoundError: No module named 'distutils'`

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

## Install Fails with `fatal error: 'functional' file not found`

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

## Install Fails on `node-pty`

`node-pty` is a native module and requires platform toolchains.

**macOS** — confirm:
- macOS 13+
- Xcode CLT installed
- Python 3 with `setuptools`/`distutils` available

**Linux** — confirm:
- `build-essential` (or equivalent) installed
- `pkg-config` installed
- Python 3 with `setuptools` available

Then retry `npm install`.

## App Launches but No Claude Response

Verify Claude CLI is installed and authenticated:

```bash
claude --version
```

```bash
claude
```

## `Alt+Space` Does Not Toggle

**macOS:** Grant Accessibility permissions:

- System Settings -> Privacy & Security -> Accessibility

**Linux (Wayland):** The app uses XWayland for global shortcuts. If `Alt+Space` is claimed by your desktop environment (e.g., GNOME uses it for window menu), remap or disable the DE shortcut:

- **GNOME:** Settings -> Keyboard -> Keyboard Shortcuts -> search "Activate the window menu" -> disable or rebind
- **KDE:** System Settings -> Shortcuts -> search "Alt+Space" -> remove conflict

Fallback shortcut:

- macOS: `Cmd+Shift+K`
- Linux: `Ctrl+Shift+K`

## Packaged App Won't Open (Security Warning)

The `.app` built by `npm run dist` is unsigned. macOS Gatekeeper blocks unsigned apps by default.

To allow it:

1. Open **System Settings → Privacy & Security**
2. Scroll to the security section
3. Click **Open Anyway** next to the Clui CC message

You only need to do this once. This is a local build, not App Store distribution.

## Install Fails at Whisper Step

The installer requires Whisper for voice input. If it fails:

**macOS:**

1. Make sure Homebrew is installed:

```bash
brew --version
```

If not, install it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. Install Whisper manually:

```bash
brew install whisper-cli
```

3. Rerun the installer:

```bash
./install-app.command
```

**Linux:**

Install via pip:

```bash
pip install openai-whisper
```

Or install whisper-cpp from source:

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp && make
sudo cp main /usr/local/bin/whisper-cli
```

Download a model:

```bash
mkdir -p ~/.local/share/whisper
curl -L -o ~/.local/share/whisper/ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
```

## Install Fails at Build Step

Run the steps manually to see the detailed error:

```bash
./commands/setup.command
```

```bash
npm run dist
```

If `npm run dist` fails, try a clean reinstall:

```bash
rm -rf node_modules
```

```bash
npm install
```

```bash
npm run dist
```

## Marketplace Shows "Failed to Load"

Expected when offline. Marketplace needs internet access; core app features continue to work.

## Window Is Invisible / No UI

Try:

- `Alt+Space`
- `Cmd+Shift+K` (macOS) or `Ctrl+Shift+K` (Linux)
- Confirm app is running from the system tray

## Linux: Window Tiles Instead of Floating (Tiling WMs)

If using i3, sway, Hyprland, or another tiling WM, add a floating rule:

```
# i3 config (~/.config/i3/config)
for_window [class="clui-cc"] floating enable, sticky enable

# sway config (~/.config/sway/config)
for_window [app_id="clui-cc"] floating enable, sticky enable

# Hyprland config (~/.config/hypr/hyprland.conf)
windowrulev2 = float, class:clui-cc
windowrulev2 = pin, class:clui-cc
```

## Linux: Transparency Not Working

Clui CC requires a compositor for transparent windows. Most desktop environments include one (GNOME, KDE, XFCE with compositing enabled).

If using a standalone WM without a compositor, install one:

```bash
# picom (works with i3, openbox, etc.)
sudo apt install picom
picom &
```

## Linux: AppImage Won't Launch

Make sure FUSE is available (required by AppImage):

```bash
# Debian/Ubuntu
sudo apt install libfuse2

# Fedora
sudo dnf install fuse-libs
```

Or extract and run without FUSE:

```bash
./Clui-CC-*-x64.AppImage --appimage-extract
./squashfs-root/clui-cc
```
