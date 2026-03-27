# Clui CC — Command Line User Interface for Claude Code

A lightweight, transparent desktop overlay for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) on macOS and Windows. Clui CC wraps the Claude Code CLI in a floating pill interface with multi-tab sessions, a permission approval UI, voice input, and a skills marketplace.

## Demo

[![Watch the demo](https://img.youtube.com/vi/NqRBIpaA4Fk/maxresdefault.jpg)](https://www.youtube.com/watch?v=NqRBIpaA4Fk)

<p align="center"><a href="https://www.youtube.com/watch?v=NqRBIpaA4Fk">▶ Watch the full demo on YouTube</a></p>

## Features

- **Floating overlay** — transparent, click-through window that stays on top. Toggle with `⌥ + Space` on Mac or `Alt + Space` on Windows.
- **Multi-tab sessions** — each tab spawns its own `claude -p` process with independent session state.
- **Ollama Support (Experimental)** — Use cloud models (Qwen, GLM, etc.) via Ollama and skip the standard Claude login.
- **Permission approval UI** — intercepts tool calls via PreToolUse HTTP hooks so you can review and approve/deny from the UI.
- **Conversation history** — browse and resume past Claude Code sessions.
- **Skills marketplace** — install plugins from Anthropic's GitHub repos without leaving Clui CC.
- **Voice input** — local speech-to-text via Whisper (required, installed automatically).
- **File & screenshot attachments** — paste images or attach files directly.
- **Dual theme** — dark/light mode with system-follow option.

## Why Clui CC

- **Claude Code, but visual** — keep CLI power while getting a fast desktop UX for approvals, history, and multitasking.
- **Human-in-the-loop safety** — tool calls are reviewed and approved in-app before execution.
- **Session-native workflow** — each tab runs an independent Claude session you can resume later.
- **Local-first** — everything runs through your local Claude CLI. No telemetry, no cloud dependency.
- **Ollama-friendly** — point to cloud ollama models to test without consuming Anthropic credits.

## How It Works

```
UI prompt → Main process spawns claude -p → NDJSON stream → live render
                                          → tool call? → permission UI → approve/deny
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full deep-dive.

## Install App (Recommended)

### macOS

The fastest way to get Clui CC running as a regular Mac app. This installs dependencies, voice support (Whisper), builds the app, copies it to `/Applications`, and launches it.

**1) Clone the repo**

```bash
git clone https://github.com/lcoutodemos/clui-cc.git
```

**2) Double-click `install-app.command`**

Open the `clui-cc` folder in Finder and double-click `install-app.command`.

> **First launch:** macOS may block the app because it's unsigned. Go to **System Settings → Privacy & Security → Open Anyway**. You only need to do this once.
> **Folder cleanup:** the installer removes temporary `dist/` and `release/` folders after a successful install to keep the repo tidy.

### Windows

Currently, Windows users must build the application from source. A pre-compiled installer will be available in the future.

**1) Clone the repo**

```powershell
git clone https://github.com/lcoutodemos/clui-cc.git
cd clui-cc
```

**2) Install Dependencies & Build**

```powershell
npm install
npm run build
```

**3) Run the App**

```powershell
npm run dev
```

To create a standalone installer for yourself:
```powershell
npm run dist:win
```
The installer will be located in the `release/` folder.

<p align="center"><img src="docs/shortcut.png" width="520" alt="Press Alt + Space (Windows) or Option + Space (Mac) to show/hide the overlay" /></p>

## Ollama Support (Skip Login)

Clui CC includes experimental support for [Ollama](https://ollama.com/), allowing you to use cloud LLM models and skip the standard Claude Code login/API key check.

**How to use:**
1. Ensure Ollama is running locally (`http://localhost:11434`).
2. In Clui CC, when prompted for setup, you can select **"Skip Login (Use Local LLM or API Key)"**.
3. Point your Claude CLI to Ollama by using specific model names (e.g., `qwen`, `glm`, `kimi`).
4. Clui CC will automatically set the `ANTHROPIC_BASE_URL` to your local Ollama instance and use dummy authentication.

<details>
<summary><strong>Terminal / Developer Commands</strong></summary>

Only `install-app.command` is kept at root intentionally for non-technical users. Developer scripts live in `commands/`.

### Quick Start (Terminal)

```bash
git clone https://github.com/lcoutodemos/clui-cc.git
```

```bash
cd clui-cc
```

**Mac:**
```bash
./commands/setup.command
```

```bash
./commands/start.command
```

To stop:

```bash
./commands/stop.command
```
**Windows:**
```powershell
npm install
npm run dev
```

> Press **Alt + Space** (Windows) or **⌥ + Space** (Mac) to show/hide the overlay.

### Developer Workflow

```bash
npm install
```

```bash
npm run dev
```

Renderer changes update instantly. Main-process changes require restarting `npm run dev`.

### Other Commands

| Command | Purpose |
|---------|---------|
| `./commands/setup.command` | Environment check + install dependencies |
| `./commands/start.command` | Build and launch from source |
| `./commands/stop.command` | Stop all Clui CC processes |
| `npm run dev` | Launch development server |
| `npm run build` | Production build (no packaging) |
| `npm run dist:mac` | Package as macOS `.app` into `release/` |
| `npm run dist:win` | Package as Windows `.exe` installer into `release/` |
| `npm run doctor` | Run environment diagnostic |

</details>

<details>
<summary><strong>Setup Prerequisites (Detailed)</strong></summary>

### For Windows

1. **Install Claude Code CLI**:
   ```powershell
   npm install -g @anthropic-ai/claude-code
   ```
2. **Authentication**: (Optional if using Ollama)
   ```powershell
   claude auth login
   ```

### For macOS

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

**Step 5.** Authenticate Claude Code (follow the prompts that appear - Optional if using Ollama):

```bash
claude
```

**Step 6.** Install Whisper for voice input:

```bash
# Apple Silicon (M1/M2/M3/M4) — preferred:
brew install whisperkit-cli
# Apple Silicon fallback, or Intel Mac:
brew install whisper-cpp
```

> **No API keys or `.env` file required.** Clui CC uses your existing Claude Code CLI authentication (Pro/Team/Enterprise subscription).

</details>

<details>
<summary><strong>Architecture and Internals</strong></summary>

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

## Tested On (Mac)

| Component | Version |
|-----------|---------|
| macOS | 15.x (Sequoia) |
| Node.js | 20.x LTS, 22.x |
| Python | 3.12 (with setuptools installed) |
| Electron | 33.x |
| Claude Code CLI | 2.1.71 |

## Tested On (Windows)

| Component | Version |
|-----------|---------|
| Windows | 11 |
| Node.js | 20.x LTS, 22.x |
| Python | 3.12 (with setuptools installed) |
| Electron | 33.x |
| Claude Code CLI | 2.1.71 |

## Known Limitations

- **macOS & Windows support** — transparent overlay, tray icon, and multi-tab sessions are fully supported on both platforms. Linux support is not currently implemented.
- **Requires Claude Code CLI** — Clui CC is a UI layer, not a standalone AI client. You need an authenticated `claude` CLI.
- **Permission mode** — uses `--permission-mode default`. The PTY interactive transport is legacy and disabled by default.

## License

[MIT](LICENSE)
