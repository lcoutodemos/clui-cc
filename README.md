# Clui CC — Command Line User Interface for Claude Code

A lightweight, transparent desktop overlay for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) on macOS. Clui CC wraps the Claude Code CLI in a floating pill interface with multi-tab sessions, a permission approval UI, voice input, and a skills marketplace.

## Demo

[![Watch the demo](https://img.youtube.com/vi/NqRBIpaA4Fk/maxresdefault.jpg)](https://www.youtube.com/watch?v=NqRBIpaA4Fk)

<p align="center"><a href="https://www.youtube.com/watch?v=NqRBIpaA4Fk">▶ Watch the full demo on YouTube</a></p>

## Features

- **Floating overlay** — transparent, click-through window that stays on top. Toggle with `Alt+Space`.
- **Multi-tab sessions** — each tab spawns its own `claude -p` process with independent session state.
- **Permission approval UI** — intercepts tool calls via PreToolUse HTTP hooks so you can review and approve/deny from the UI.
- **Conversation history** — browse and resume past Claude Code sessions.
- **Skills marketplace** — install plugins from Anthropic's GitHub repos without leaving Clui CC.
- **Voice input** — local speech-to-text via Whisper (no cloud transcription).
- **File & screenshot attachments** — paste images or attach files directly.
- **Dual theme** — dark/light mode with system-follow option.

## Why Clui CC Is Different

- **Claude Code, but visual** — keep CLI power while getting a fast desktop UX for approvals, history, and multitasking.
- **Human-in-the-loop safety** — tool calls can be reviewed/approved in-app before execution.
- **Session-native workflow** — each tab runs an independent Claude session you can resume later.
- **Mostly local-first** — core behavior runs through your local Claude CLI, with minimal network dependency.

## Architecture At a Glance

Clui CC is an Electron app with three layers:

```
Renderer (React UI) -> Preload bridge -> Main process (ControlPlane/RunManager/PermissionServer)
```

Flow:

1. UI sends a prompt from a tab.
2. Main process starts `claude -p` for that tab.
3. Stream events are normalized and rendered live.
4. Tool permission requests are intercepted and shown in the approval UI.
5. Session state is tracked so you can resume work.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full technical deep-dive.

## Quick Start (Recommended)

Run these commands one at a time:

**1) Clone the repo**

```bash
git clone https://github.com/lcoutodemos/clui-cc.git
```

**2) Enter the project folder**

```bash
cd clui-cc
```

**3) Start the app**

```bash
./start.command
```

Optional (install voice dependency automatically first):

```bash
./start.command --with-voice
```

`start.command` runs environment checks first and prints exact fix commands if something is missing. If checks pass, it installs dependencies, builds, and launches the app.

To close the app:

```bash
./stop.command
```

You can also double-click `start.command` and `stop.command` from Finder.

Toggle the overlay: **Alt+Space** (or **Cmd+Shift+K** as fallback).

<details>
<summary><strong>Setup Prerequisites (Detailed)</strong></summary>

You need **macOS 13+**. Then install these one at a time — copy each command and paste it into Terminal.

**Step 1.** Install Xcode Command Line Tools (needed to compile native modules):

```bash
xcode-select --install
```

**Step 2.** Install Node.js (recommended: current LTS such as 20 or 22; minimum supported: 18). Download from [nodejs.org](https://nodejs.org), or use Homebrew:

```bash
brew install node
```

Verify it's on your PATH:

```bash
node --version
```

**Step 3.** Make sure Python has `setuptools` (needed by the native module compiler). On Python 3.12+ this is missing by default:

```bash
python3 -m pip install --upgrade pip setuptools
```

**Step 4.** Install Claude Code CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

**Step 5.** Authenticate Claude Code (follow the prompts that appear):

```bash
claude
```

**Step 6.** Verify Claude Code is working (should print `2.1.x` or higher):

```bash
claude --version
```

**Optional:** Install Whisper for voice input:

```bash
brew install whisper-cli
```

> **No API keys or `.env` file required.** Clui CC uses your existing Claude Code CLI authentication (Pro/Team/Enterprise subscription).

</details>

<details>
<summary><strong>Development Commands</strong></summary>

### Hot Reload

If you are actively developing:

```bash
npm install
```

```bash
npm run dev
```

Renderer changes update instantly. Main-process changes require restarting `npm run dev`.

### Production Build

```bash
npm run build
```

```bash
npx electron .
```

### Build as macOS App

Generate a standalone `Clui CC.app` that runs without a terminal:

```bash
npm run dist
```

The app is created at `release/mac-arm64/Clui CC.app` (Apple Silicon) or `release/mac/Clui CC.app` (Intel).

To install, drag it to `/Applications`:

```bash
cp -R "release/mac-arm64/Clui CC.app" /Applications/
```

Then open it from Spotlight, Launchpad, or the Applications folder like any native app.

> **Note:** The app is not code-signed. On first launch macOS may block it — go to **System Settings → Privacy & Security** and click **Open Anyway**.

</details>

<details>
<summary><strong>Architecture and Internals</strong></summary>

Clui CC is an Electron app with three layers:

```
┌─────────────────────────────────────────────────┐
│  Renderer (React 19 + Zustand + Tailwind CSS 4) │
│  Components, theme, state management             │
├─────────────────────────────────────────────────┤
│  Preload (window.clui bridge)                    │
│  Secure IPC surface between renderer and main    │
├─────────────────────────────────────────────────┤
│  Main Process                                    │
│  ControlPlane → RunManager → claude -p (NDJSON)  │
│  PermissionServer (HTTP hooks on 127.0.0.1)      │
│  Marketplace catalog (GitHub raw fetch + cache)   │
└─────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full deep-dive.

### Project Structure

```
src/
├── main/                   # Electron main process
│   ├── claude/             # ControlPlane, RunManager, EventNormalizer
│   ├── hooks/              # PermissionServer (PreToolUse HTTP hooks)
│   ├── marketplace/        # Plugin catalog fetching + install
│   ├── skills/             # Skill auto-installer
│   └── index.ts            # Window creation, IPC handlers, tray
├── renderer/               # React frontend
│   ├── components/         # TabStrip, ConversationView, InputBar, etc.
│   ├── stores/             # Zustand session store
│   ├── hooks/              # Event listeners, health reconciliation
│   └── theme.ts            # Dual palette + CSS custom properties
├── preload/                # Secure IPC bridge (window.clui API)
└── shared/                 # Canonical types, IPC channel definitions
```

### How It Works

1. Each tab creates a `claude -p --output-format stream-json` subprocess.
2. NDJSON events are parsed by `RunManager` and normalized by `EventNormalizer`.
3. `ControlPlane` manages tab lifecycle (connecting → idle → running → completed/failed/dead).
4. Tool permission requests arrive via HTTP hooks to `PermissionServer` (localhost only).
5. The renderer polls backend health every 1.5s and reconciles tab state.
6. Sessions are resumed with `--resume <session-id>` for continuity.

### Network Behavior

Clui CC operates almost entirely offline. The only outbound network calls are:

| Endpoint | Purpose | Required |
|----------|---------|----------|
| `raw.githubusercontent.com/anthropics/*` | Marketplace catalog (cached 5 min) | No — graceful fallback |
| `api.github.com/repos/anthropics/*/tarball/*` | Skill auto-install on startup | No — skipped on failure |

No telemetry, analytics, or auto-update mechanisms. All core Claude Code interaction goes through the local CLI.

</details>

## Troubleshooting

For setup issues and recovery commands, see [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).

Quick self-check:

```bash
npm run doctor
```

## Tested On

| Component | Version |
|-----------|---------|
| macOS | 15.x (Sequoia) |
| Node.js | 20.x LTS, 22.x |
| Python | 3.12 (with setuptools installed) |
| Electron | 33.x |
| Claude Code CLI | 2.1.71 |

## Known Limitations

- **macOS only** — transparent overlay, tray icon, and node-pty are macOS-specific. Windows/Linux support is not currently implemented.
- **Requires Claude Code CLI** — Clui CC is a UI layer, not a standalone AI client. You need an authenticated `claude` CLI.
- **Permission mode** — uses `--permission-mode default`. The PTY interactive transport is legacy and disabled by default.

## License

[MIT](LICENSE)
