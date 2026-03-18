# Clui CC

Clui CC is an Electron overlay for Claude Code CLI. It keeps Claude in a floating desktop shell with tabs, workflows, diffs, permissions, costs, and Git-aware context so you can stay inside your coding flow without living in the terminal.

The app runs locally on macOS and Windows, talks to Claude through the installed `claude` CLI, and keeps the renderer, preload bridge, and main-process orchestration clearly separated.

## What Is Clui CC

Clui CC is a desktop companion for Claude Code. The renderer gives you a focused chat-and-tools UI, the preload layer exposes a typed `window.clui` bridge, and the main process manages Claude sessions, permission hooks, marketplace installs, screenshots, notifications, and local state.

If you already use Claude Code in the terminal, Clui CC adds the interface and workflow layer on top: multi-tab conversations, inline tool diffs, session history, cost tracking, voice input, and project-specific context management.

## Features

- Multi-tab sessions with drag-to-reorder and tab groups
- Command palette (Ctrl+K / Cmd+K)
- Inline code diff viewer for Edit/Write tool calls
- Cost dashboard with usage analytics
- Multi-model comparison (split view)
- Workflow chains / macros
- Git-aware context panel
- OS native + in-app toast notifications
- Marketplace for skills and plugins
- Customizable keyboard shortcuts
- Session export (Markdown/JSON)
- Snippets and prompt templates
- Context files auto-attach
- Permission approval with auto-deny timeout
- Voice input (Whisper)
- Dark/light theme

## Screenshots

![Dark mode conversation view with Claude response](docs/screenshots/app-dark-expanded.png)

Dark mode expanded view with a live conversation, attachments, status bar, and the floating shell layout.

![Command palette overlay](docs/screenshots/command-palette.png)

Command palette opened over the overlay UI for fast actions such as tab management, theme switching, marketplace access, and model selection.

These screenshots were captured from the Electron app in isolated E2E mode with the fake Claude backend so the visuals stay deterministic in the repo.

## Prerequisites

- macOS 13+ or Windows 10+
- Node.js 18+
- Claude Code CLI 2.1+
- macOS: Xcode Command Line Tools recommended for native dependency rebuilds
- Windows: Visual Studio Build Tools recommended for native dependency rebuilds

Verify your environment before starting:

```bash
node --version
npm --version
claude --version
```

## Quick Start

Clone the repo and install dependencies:

```bash
git clone https://github.com/lfrmonteiro99/clui-cc-windows.git
cd clui-cc-windows
npm install
```

Run the platform doctor if you want a quick environment check:

```bash
npm run doctor
npm run doctor:win
```

Start the desktop app in development:

```bash
npm run dev
```

Run validation and create a production build:

```bash
npm run test
npm run build
```

## Architecture

Clui CC is split into three runtime layers plus the Claude Code CLI. The renderer owns the UI and local interaction state, the preload script exposes a typed IPC surface, and the main process owns subprocesses, permissions, sessions, marketplace installs, notifications, screenshots, and diagnostics.

```text
+--------------------+    window.clui / IPC    +--------------------+    IPC handlers / services    +-----------------------+
| Renderer           | <---------------------> | Preload            | <---------------------------> | Main                  |
| React 19           |                         | contextBridge      |                               | ControlPlane          |
| Zustand stores     |                         | typed API surface  |                               | RunManager            |
| Command palette    |                         |                    |                               | Permission server     |
| Conversations      |                         |                    |                               | Marketplace / Git     |
+--------------------+                         +--------------------+                               +-----------------------+
                                                                                                             |
                                                                                                             v
                                                                                                   +-------------------+
                                                                                                   | Claude Code CLI   |
                                                                                                   | stream-json runs  |
                                                                                                   | local subprocess  |
                                                                                                   +-------------------+
```

For a deeper breakdown of the renderer stores, main-process services, IPC channels, and prompt-to-response flow, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Links

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
