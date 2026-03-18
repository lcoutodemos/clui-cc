# Release Smoke Test

## Build Verification

### Fresh Clone Bootstrap

```bash
git clone https://github.com/lfrmonteiro99/clui-cc-windows.git
cd clui-cc-windows
npm run doctor     # verify environment — all checks should pass
npm install        # installs deps + runs postinstall (electron-builder install-app-deps + icon patch)
npm run build      # production build — must exit 0 with no errors
npm run test       # test suite — must exit 0 with no failures
```

**Prerequisites check (verified by `npm run doctor`):**
- macOS 13+ or Windows 10+
- macOS: Xcode Command Line Tools installed (`xcode-select -p` returns a path)
- macOS: macOS SDK available (`xcrun --sdk macosx --show-sdk-path` returns a path)
- Windows: Visual Studio Build Tools (for native modules)
- `node --version` returns 18+
- `python3` available with `distutils` importable (macOS)
- `claude --version` returns 2.1+

**Expected output:**
- `dist/main/index.js` — ~117 KB
- `dist/preload/index.js` — ~6 KB
- `dist/renderer/index.html` + `assets/index-*.js` (~1.7 MB) + `assets/index-*.css` (~25 KB)

### TypeScript

- `npm run build` — passes (uses esbuild, tolerant of some strict-mode warnings)
- `npx tsc --noEmit` — has pre-existing warnings (non-blocking)
  - These are narrowing/equality warnings from Zustand selector patterns and a legacy PTY file
  - Does NOT affect runtime behavior — electron-vite builds successfully

## Runtime Smoke Test Checklist

### Prerequisites
- [ ] macOS 13+ or Windows 10+
- [ ] Node.js 18+
- [ ] `claude` CLI installed and authenticated (`claude --version` returns 2.1+)

### Startup
- [ ] `npm run dev` launches the app
- [ ] Floating pill appears at bottom-center of screen
- [ ] `Alt+Space` (macOS) / `Ctrl+Space` (Windows) toggles visibility
- [ ] Tray icon appears in menu bar (macOS) / notification area (Windows)
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

### Command Palette
- [ ] `Ctrl+K` (Windows) / `Cmd+K` (macOS) opens the command palette
- [ ] Typing filters available commands
- [ ] Selecting a command executes it
- [ ] Escape closes the palette

### Cost Dashboard
- [ ] Open Settings → Usage section
- [ ] Cost breakdown by model, project, and day displays correctly
- [ ] Token counts are accurate after running prompts

### Notifications
- [ ] Toast notifications appear for task completion
- [ ] OS-native desktop notifications fire when app is not focused
- [ ] Notification preferences can be toggled in settings

### Inline Diff Viewer
- [ ] When Claude uses the Edit tool, a diff view appears
- [ ] Added lines shown in green, removed lines shown in red
- [ ] Diff is readable and correctly formatted

### Git Context Panel
- [ ] Git panel shows current branch name
- [ ] Modified/added/deleted files are listed
- [ ] Panel updates when working directory changes

### Multi-Model Comparison
- [ ] `/compare` command opens comparison launcher
- [ ] Side-by-side responses are displayed
- [ ] Results can be dismissed

### Workflow Chains
- [ ] `/workflow` command opens workflow manager
- [ ] Can create, edit, and execute workflow steps
- [ ] Progress display shows step-by-step execution

### Tab Groups
- [ ] Right-click tab opens context menu
- [ ] Can create and name tab groups
- [ ] Tab group headers are collapsible
- [ ] Tabs can be moved between groups

### Snippets
- [ ] Snippet manager accessible from settings
- [ ] Can create, edit, and delete prompt snippets
- [ ] Snippets appear in the input suggestions

### Session Export
- [ ] `/export` command opens export dialog
- [ ] Can export to Markdown or JSON format
- [ ] Exported file contains the correct session content

### Customizable Keyboard Shortcuts
- [ ] Shortcut settings accessible from settings panel
- [ ] Can rebind shortcuts to different key combinations
- [ ] Conflict detection warns about duplicate bindings

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

### Voice Input (requires Whisper)
- [ ] Microphone button starts recording
- [ ] Stop button ends recording and transcribes
- [ ] Transcribed text appears in input bar
- [ ] Error message if whisper not installed

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

- **Date:** 2026-03-18
- **Node:** v22.x
- **Electron:** 33.x
- **Claude CLI:** 2.1.71
- **macOS:** 15.x (Sequoia)
- **Windows:** 11 (26200)
- **Build result:** Pass (zero build errors, zero test failures)
