# CLUI Architecture

## Overview

CLUI is an Electron desktop application (macOS and Linux) that provides a graphical interface for Claude Code CLI. It spawns `claude -p` subprocesses, parses their NDJSON output, and presents conversations in a floating overlay window.

### Platform Abstraction

The main process (`src/main/index.ts`) contains platform-specific branches for:

| Concern | macOS | Linux |
|---------|-------|-------|
| Window type | `type: 'panel'` (NSPanel) | Standard frameless window |
| Dock/taskbar | `app.dock.hide()` | `skipTaskbar: true` on window |
| Tray icon | Template image (auto dark/light) | Regular PNG icon |
| Global shortcuts | Native (Cocoa) | Via X11 (`--ozone-platform=x11`) |
| Screenshot | `/usr/sbin/screencapture -i` | `gnome-screenshot` / `scrot` / `import` |
| Open in terminal | AppleScript → Terminal.app | `x-terminal-emulator` / `gnome-terminal` / `konsole` / `xterm` |
| Whisper lookup | Homebrew paths + `/bin/zsh` | System paths + `/bin/bash` |

```
┌──────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│  React 19 + Zustand 5 + Tailwind CSS 4 + Framer Motion      │
│                                                              │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐  │
│  │ TabStrip  │ │Conversation  │ │ InputBar │ │ Marketplace│  │
│  │          │ │   View       │ │          │ │   Panel    │  │
│  └──────────┘ └──────────────┘ └──────────┘ └────────────┘  │
│                         │                                    │
│                    sessionStore (Zustand)                     │
│                         │                                    │
│              window.clui (preload bridge)                     │
├──────────────────────────────────────────────────────────────┤
│                     Preload Script                            │
│  Typed IPC bridge — contextBridge.exposeInMainWorld          │
├──────────────────────────────────────────────────────────────┤
│                     Main Process                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                   ControlPlane                        │    │
│  │  Tab registry, session lifecycle, queue management    │    │
│  │                                                       │    │
│  │  ┌─────────────┐  ┌──────────────────┐               │    │
│  │  │ RunManager   │  │ EventNormalizer  │               │    │
│  │  │ Spawns       │  │ Raw stream-json  │               │    │
│  │  │ claude -p    │──│ → canonical      │               │    │
│  │  │ per prompt   │  │   events         │               │    │
│  │  └─────────────┘  └──────────────────┘               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────┐  ┌────────────────────────────┐      │
│  │ PermissionServer   │  │ Marketplace Catalog        │      │
│  │ HTTP hooks on      │  │ GitHub raw fetch + cache   │      │
│  │ 127.0.0.1:19836    │  │ TTL: 5 minutes             │      │
│  └────────────────────┘  └────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
         │                              │
    claude -p (NDJSON)          raw.githubusercontent.com
    (local subprocess)          (optional, cached)
```

## Main Process (`src/main/`)

### ControlPlane (`claude/control-plane.ts`)

Single authority for all tab and session lifecycle. Manages:

- **Tab registry** — maps tabId → session metadata, status, process PID.
- **State machine** — each tab transitions through: `connecting → idle → running → completed → failed → dead`.
- **Request routing** — maps requestIds to active RunManager instances.
- **Queue + backpressure** — max 32 pending requests, prompts queue behind running tasks.
- **Health reconciliation** — responds to renderer polls with tab status + process liveness.
- **Session ID tracking** — maps Claude session IDs to tabs for permission routing.

### RunManager (`claude/run-manager.ts`)

Spawns one `claude -p --output-format stream-json` process per prompt. Responsibilities:

- Constructs CLI arguments (`--resume`, `--permission-mode`, `--settings`, `--add-dir`, etc.)
- Reads NDJSON from stdout line-by-line via `StreamParser`.
- Passes raw events to `EventNormalizer` for canonicalization.
- Maintains stderr ring buffer (100 lines) for error diagnostics.
- Cleans up process on cancel, tab close, or unexpected exit.
- Removes `CLAUDECODE` from spawned environment to prevent credential leakage.

### EventNormalizer (`claude/event-normalizer.ts`)

Maps raw Claude Code stream-json events to canonical `NormalizedEvent` types:

| Raw Event | Normalized Event |
|-----------|-----------------|
| `system` (subtype: init) | `session_init` |
| `stream_event` (content_block_delta, text_delta) | `text_chunk` |
| `stream_event` (content_block_start, tool_use) | `tool_call` |
| `stream_event` (content_block_delta, input_json_delta) | `tool_call_update` |
| `stream_event` (content_block_stop) | `tool_call_complete` |
| `assistant` | `task_update` |
| `result` | `task_complete` |
| `rate_limit_event` | `rate_limit` |

### PermissionServer (`hooks/permission-server.ts`)

HTTP server that intercepts Claude Code tool calls via PreToolUse hooks:

1. ControlPlane starts PermissionServer on `127.0.0.1:19836`.
2. `generateSettingsFile()` creates a temp JSON file with hook config pointing at the server.
3. RunManager passes `--settings <path>` to each `claude -p` spawn.
4. When Claude wants to use a tool, the CLI POSTs to the hook URL.
5. PermissionServer emits a `permission-request` event to ControlPlane.
6. ControlPlane routes it to the correct tab via `_findTabBySessionId()`.
7. Renderer shows a `PermissionCard` with Allow/Deny buttons.
8. User decision flows back: IPC → ControlPlane → PermissionServer → HTTP response.
9. Claude Code proceeds or skips the tool based on the response.

Security: per-launch app secret, per-run tokens, sensitive field masking, 5-minute auto-deny timeout.

### Marketplace Catalog (`marketplace/catalog.ts`)

Fetches plugin metadata from three Anthropic GitHub repos:
- `anthropics/skills` (Agent Skills)
- `anthropics/knowledge-work-plugins` (Knowledge Work)
- `anthropics/financial-services-plugins` (Financial Services)

Uses Electron's `net.request()` with a 5-minute TTL cache. Individual fetch failures are isolated — one broken repo doesn't block others.

### Skill Installer (`skills/installer.ts`)

Auto-installs bundled skills on startup (currently: `skill-creator`). Uses pinned commit SHAs for deterministic downloads. Atomic install: validates in temp dir before swapping into `~/.claude/skills/`. Respects user-managed skills (skips if no `.clui-version` marker).

## Preload (`src/preload/`)

The preload script uses `contextBridge.exposeInMainWorld` to expose a typed `window.clui` API. This is the only communication surface between renderer and main process.

All methods map to `ipcRenderer.invoke()` (request-response) or `ipcRenderer.send()` (fire-and-forget). The full API surface is defined in `CluiAPI` interface.

## Renderer (`src/renderer/`)

### State Management

Single Zustand store (`stores/sessionStore.ts`) holds all application state:
- Tab list with full `TabState` objects (messages, status, attachments, permissions, etc.)
- Active tab selection
- Marketplace state (catalog, search, filter, install progress)
- UI state (expanded, marketplace open)

### Theme System (`theme.ts`)

Dual color palette (dark + light) defined as JS objects. `useColors()` hook returns the active palette reactively. All tokens are synced to CSS custom properties via `syncTokensToCss()` so CSS files can reference `var(--clui-*)`.

Theme mode state machine: `system | light | dark` with separate `_systemIsDark` tracking for OS value.

### Key Components

- **TabStrip** — tab bar with new tab, history picker, settings popover.
- **ConversationView** — scrollable message timeline with markdown rendering (react-markdown + remark-gfm), tool call cards, permission cards.
- **InputBar** — prompt input with attachment chips, voice recording, slash command menu, model picker.
- **MarketplacePanel** — plugin browser with search, semantic tag filters, install confirmation.

### Performance Patterns

- Narrow Zustand selectors with custom equality functions (field-level comparison) to prevent re-renders during streaming.
- RAF-throttled mousemove handler for click-through detection.
- Debounced marketplace search (200ms).
- Health reconciliation skips setState when no tabs changed.

## IPC Channel Map

All channels are defined in `src/shared/types.ts` under the `IPC` const. Events flow through a single `clui:normalized-event` channel for all Claude Code stream events, with separate channels for tab status changes and enriched errors.

## Data Flow: Prompt → Response

```
User types prompt
    → InputBar calls window.clui.prompt(tabId, requestId, options)
    → ipcRenderer.invoke('clui:prompt', ...)
    → Main: ControlPlane.prompt()
    → RunManager spawns: claude -p --output-format stream-json --resume <sid>
    → Claude CLI writes NDJSON to stdout
    → StreamParser emits lines
    → EventNormalizer maps to NormalizedEvent
    → ControlPlane updates tab state + broadcasts via IPC
    → Renderer: useClaudeEvents hook receives events
    → sessionStore.handleNormalizedEvent() updates messages
    → React re-renders ConversationView
```
