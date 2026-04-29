# Release Smoke Test

## Build Verification

### Fresh Clone Bootstrap

```bash
git clone https://github.com/adamking77/clui-cc.git
cd clui-cc
npm run doctor     # verify environment — all checks should pass
npm install        # installs deps + runs postinstall (electron-builder install-app-deps + icon patch)
npm run build      # production build — must exit 0 with no errors
```

**Prerequisites check (verified by `npm run doctor`):**
- macOS 13+
- Xcode Command Line Tools installed (`xcode-select -p` returns a path)
- macOS SDK available (`xcrun --sdk macosx --show-sdk-path` returns a path)
- clang++ available with working C++ headers
- `node --version` returns 18+
- `python3` available with `distutils` importable
- `claude --version` returns 2.1+

**Expected output:**
- `dist/main/index.js` — ~117 KB
- `dist/preload/index.js` — ~6 KB
- `dist/renderer/index.html` + `assets/index-*.js` (~1.5 MB) + `assets/index-*.css` (~25 KB)

### TypeScript

- `npm run build` — passes (uses esbuild, tolerant of some strict-mode warnings)
- `npx tsc --noEmit` — has pre-existing warnings (68 as of v0.1.0, non-blocking)
  - These are narrowing/equality warnings from Zustand selector patterns and a legacy PTY file
  - Does NOT affect runtime behavior — electron-vite builds successfully

## Runtime Smoke Test Checklist

### Prerequisites
- [ ] macOS 13+
- [ ] Xcode Command Line Tools installed (`xcode-select -p` returns a path)
- [ ] Node.js 18+
- [ ] `claude` CLI installed and authenticated (`claude --version` returns 2.1+)

### Startup
- [ ] `npm run dev` or `./commands/start.command` launches the app
- [ ] Floating pill appears at bottom-center of screen
- [ ] `⌥ + Space` toggles visibility (fallback: `Cmd+Shift+K`)
- [ ] Tray icon appears in menu bar
- [ ] Tray menu shows Quit option

### Tab Management
- [ ] Default tab created on launch
- [ ] Click `+` creates a new tab
- [ ] Clicking tab switches active tab
- [ ] Tab shows correct status dot (idle = gray, running = orange, completed = green)

### Prompt & Response
- [ ] Type a prompt and press Enter
- [ ] Tab status changes to "running" (orange dot)
- [ ] Text streams into conversation view
- [ ] Tool calls appear as expandable cards
- [ ] Task completes, status changes to "completed" (green dot)
- [ ] Cost/tokens shown in status bar

### Permission System
- [ ] When Claude tries to use a tool, a permission card appears
- [ ] "Allow" lets the tool run
- [ ] "Deny" blocks the tool
- [ ] Permission denial is reflected in task completion

### Settings
- [ ] Three-dot button in tab strip opens settings popover
- [ ] Sound toggle works (on/off)
- [ ] Theme picker works (System/Light/Dark)
- [ ] UI size toggle works (Compact/Expanded)
- [ ] Settings persist across restart (localStorage)

### History
- [ ] Clock icon opens session history picker
- [ ] Previous sessions listed with timestamps
- [ ] Clicking a session loads its messages

### Marketplace
- [ ] HeadCircuit (brain) button opens marketplace panel
- [ ] Plugins load from GitHub (requires network)
- [ ] Search filters by name/description/tags
- [ ] Filter chips narrow results by semantic tag
- [ ] "Installed" filter shows installed plugins
- [ ] Install flow shows confirmation with exact CLI commands
- [ ] Graceful error state when offline

### Voice Input (Whisper required — installed by install-app.command)
- [ ] Microphone button starts recording
- [ ] Stop button ends recording and transcribes
- [ ] Transcribed text appears in input bar

### Attachments
- [ ] Paperclip button opens file picker
- [ ] Camera button takes screenshot
- [ ] Pasting an image from clipboard works
- [ ] Attachment chips appear below input

### Theme
- [ ] Dark mode: warm dark surfaces, orange accent
- [ ] Light mode: light surfaces, same orange accent
- [ ] System mode follows OS dark/light setting

### Window Behavior
- [ ] Window is transparent (click-through on non-UI areas)
- [ ] Window stays on top of other windows
- [ ] Expanded UI mode widens the panel
- [ ] Collapsing back to compact restores original size
- [ ] No shadow clipping at window edges

## Offline Behavior

- [ ] App launches and is usable without network
- [ ] Marketplace shows error state with "Retry" button
- [ ] Skill auto-install silently skips on failure
- [ ] All prompt/response functionality works (uses local CLI)

## Last Verified

- **Date:** 2026-03-12
- **Node:** v22.x
- **Electron:** 33.x
- **Claude CLI:** 2.1.71
- **macOS:** 15.x (Sequoia)
- **Build result:** Pass (zero build errors)
