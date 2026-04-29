# Agent Guide — Clui CC

> This file is optimized for AI coding agents (Claude Code, Cursor, Copilot, etc.).
> For human-readable docs see [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

## What This Project Is

Clui CC is a **macOS-only Electron overlay** that wraps the Claude Code CLI (`claude -p --output-format stream-json`) in a floating pill UI. It is NOT a web app, NOT a VS Code extension, and does NOT call the Anthropic API directly — it spawns CLI subprocesses.

## Quick Reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev mode (hot-reload) | `npm run dev` |
| Type-check / build | `npm run build` |
| Toggle overlay | `⌥ + Space` (fallback: `Cmd+Shift+K`) |
| Debug logging | `CLUI_DEBUG=1 npm run dev` (writes to `~/.clui-debug.log`) |

**Main process changes require full restart.** Renderer changes hot-reload.

## Architecture (3-Layer)

```
Renderer (React 19 + Zustand 5 + Tailwind CSS 4)
    ↕  contextBridge IPC (src/preload/index.ts)
Main Process (Node.js / Electron 33)
    ↕  spawns subprocess
Claude Code CLI (claude -p --output-format stream-json)
```

### Layer Responsibilities

| Layer | Directory | Manages |
|-------|-----------|---------|
| **Renderer** | `src/renderer/` | UI state, theming, user input, message display |
| **Preload** | `src/preload/` | Typed IPC bridge (`window.clui` API). Security boundary. |
| **Main** | `src/main/` | Process lifecycle, tab state machine, permission server, marketplace |

### Key Files by Concern

| Concern | File(s) |
|---------|---------|
| Tab lifecycle & state machine | `src/main/claude/control-plane.ts` |
| Spawning Claude CLI processes | `src/main/claude/run-manager.ts` |
| Raw NDJSON → canonical events | `src/main/claude/event-normalizer.ts` |
| Permission hook server | `src/main/hooks/permission-server.ts` |
| All TypeScript types & IPC channels | `src/shared/types.ts` |
| Zustand state store | `src/renderer/stores/sessionStore.ts` |
| Theme / color system | `src/renderer/theme.ts` |
| Main window & IPC handler setup | `src/main/index.ts` |
| Marketplace catalog | `src/main/marketplace/catalog.ts` |
| Skill installer | `src/main/skills/installer.ts` |

## Data Flow: Prompt → Response

```
InputBar.tsx → window.clui.prompt(tabId, requestId, opts)
  → ipcRenderer.invoke('clui:prompt')
  → ControlPlane.prompt()
  → RunManager spawns: claude -p --output-format stream-json --resume <sid>
  → stdout emits NDJSON lines
  → EventNormalizer → NormalizedEvent
  → ControlPlane broadcasts via IPC
  → useClaudeEvents hook → sessionStore.handleNormalizedEvent()
  → React re-renders
```

## Canonical Types

All IPC and event types live in `src/shared/types.ts`. Key types:

- **`NormalizedEvent`** — union of all events the main process emits to the renderer
- **`TabState`** — full state of a single tab (status, messages, permissions, session metadata)
- **`TabStatus`** — state machine: `connecting → idle → running → completed/failed/dead`
- **`IPC`** — const object with all IPC channel names (use these, never raw strings)
- **`RunOptions`** — options passed when spawning a Claude CLI run
- **`CatalogPlugin`** — marketplace plugin metadata

## Conventions & Rules

### Must Follow

1. **TypeScript strict mode** — zero errors required (`npm run build` must pass)
2. **Use `IPC.*` constants** for all IPC channel names — never hardcode strings
3. **Use `useColors()` hook** for all color references in renderer — never hardcode colors
4. **Narrow Zustand selectors** with custom equality functions for performance
5. **All new IPC channels** must be added to `src/shared/types.ts` AND wired in both `src/preload/index.ts` and `src/main/index.ts`
6. **Tab state transitions** go through `ControlPlane` only — never mutate tab state directly

### Security — Do Not Break

- **Permission server** binds to `127.0.0.1` only (never `0.0.0.0`)
- **Per-launch app secret** (random UUID) validates hook requests — do not weaken
- **Per-run tokens** route permission responses to correct tab — do not bypass
- **`CLAUDECODE` env var** is explicitly removed from spawned processes
- **Sensitive fields** (tokens, passwords, secrets, keys, auth, credentials) are masked via `maskSensitiveFields()` before display
- **5-minute auto-deny timeout** on unanswered permissions — do not remove

### Don't

- Don't import main-process modules from renderer (or vice versa) — the preload bridge is the only crossing point
- Don't add network calls — the app is designed to be nearly offline (only marketplace fetches from GitHub)
- Don't use `node-pty` for new features — it's legacy, prefer `RunManager` (stdio-based)
- Don't add Electron `remote` module usage — it's disabled for security

## Adding a New Feature — Checklist

### New IPC channel
1. Add channel name to `IPC` const in `src/shared/types.ts`
2. Add handler in `src/main/index.ts` (`ipcMain.handle` or `ipcMain.on`)
3. Expose via `contextBridge` in `src/preload/index.ts`
4. Call from renderer via `window.clui.*`

### New UI component
1. Create in `src/renderer/components/`
2. Use `useColors()` for all colors
3. Use Phosphor icons (`@phosphor-icons/react`) — not other icon libraries
4. Animations via Framer Motion

### New event type from Claude CLI
1. Add raw type to `ClaudeEvent` union in `src/shared/types.ts`
2. Add normalized form to `NormalizedEvent` union
3. Handle in `EventNormalizer.normalize()` (`src/main/claude/event-normalizer.ts`)
4. Handle in `sessionStore.handleNormalizedEvent()` (`src/renderer/stores/sessionStore.ts`)

### New tab state field
1. Add to `TabState` interface in `src/shared/types.ts`
2. Initialize in `createTab()` in both `ControlPlane` and `sessionStore`
3. Update via `ControlPlane` events — never directly from renderer

## Stack

| Layer | Tech | Version |
|-------|------|---------|
| Desktop | Electron | 33 |
| Build | electron-vite | 3 |
| UI | React | 19 |
| State | Zustand | 5 |
| Styling | Tailwind CSS | 4 |
| Animation | Framer Motion | 12 |
| Icons | Phosphor Icons | 2 |
| Markdown | react-markdown + remark-gfm | 9 / 4 |
| PTY (legacy) | node-pty | 1.1 |

## Network Surface

| Endpoint | Purpose | Required |
|----------|---------|----------|
| `raw.githubusercontent.com/anthropics/*` | Marketplace catalog (cached 5 min) | No |
| `api.github.com/repos/anthropics/*/tarball/*` | Skill auto-install | No |
| `127.0.0.1:19836` | Permission hook server (local only) | Yes |

No telemetry. No analytics. No auto-update.

## Common Pitfalls

1. **Forgetting to restart dev server** after main-process changes — renderer hot-reloads but main does not
2. **Adding raw color values** instead of using `useColors()` — breaks theming
3. **Mutating tab state from renderer** instead of going through ControlPlane events
4. **Hardcoding IPC strings** instead of using `IPC.*` constants
5. **Testing on non-macOS** — this is macOS-only (transparent windows, node-pty bindings)
6. **Not handling the `session_dead` event** — if a Claude process crashes, the tab must transition to `dead` status
