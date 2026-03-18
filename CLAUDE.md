# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Clui CC is an Electron desktop overlay that wraps the Claude Code CLI (`claude -p --output-format stream-json`) in a floating pill UI with multi-tab sessions, permission approval, marketplace, and voice input. It does NOT call the Anthropic API directly — it spawns CLI subprocesses. Supports macOS (production) and Windows (beta).

## Commands

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev mode (hot-reload renderer) | `npm run dev` |
| Type-check + build | `npm run build` |
| Run tests | `npm run test` |
| Tests in watch mode | `npm run test:watch` |
| Environment diagnostics | `npm run doctor` |
| Debug logging | `CLUI_DEBUG=1 npm run dev` (writes `~/.clui-debug.log`) |
| Toggle overlay | `Alt+Space` (macOS) / `Ctrl+Space` (Windows) |

Tests use [Vitest](https://vitest.dev/). `npm run build` (TypeScript strict mode) and `npm run test` must both pass. Main process changes require full restart; renderer changes hot-reload.

## Architecture (3-Layer)

```
Renderer (React 19 + Zustand 5 + Tailwind CSS 4 + Framer Motion)
    ↕  contextBridge IPC (src/preload/index.ts)
Main Process (Node.js / Electron 33)
    ↕  spawns subprocess
Claude Code CLI (claude -p --output-format stream-json)
```

### Data Flow: Prompt → Response

```
InputBar → window.clui.prompt(tabId, requestId, opts)
  → ipcRenderer.invoke('clui:prompt')
  → ControlPlane.prompt()
  → RunManager spawns: claude -p --output-format stream-json --resume <sid>
  → stdout NDJSON → StreamParser → EventNormalizer → NormalizedEvent
  → ControlPlane broadcasts via IPC
  → useClaudeEvents hook → sessionStore.handleNormalizedEvent()
  → React re-renders
```

### Key Files by Concern

| Concern | File |
|---------|------|
| Tab lifecycle & state machine | `src/main/claude/control-plane.ts` |
| Spawning Claude CLI processes | `src/main/claude/run-manager.ts` |
| Raw NDJSON → canonical events | `src/main/claude/event-normalizer.ts` |
| Permission hook HTTP server | `src/main/hooks/permission-server.ts` |
| All types & IPC channel names | `src/shared/types.ts` |
| Session state store | `src/renderer/stores/sessionStore.ts` |
| Notification store (toasts) | `src/renderer/stores/notificationStore.ts` |
| Command palette store | `src/renderer/stores/commandPaletteStore.ts` |
| Comparison store (multi-model) | `src/renderer/stores/comparisonStore.ts` |
| Workflow store | `src/renderer/stores/workflowStore.ts` |
| Tab group store | `src/renderer/stores/tabGroupStore.ts` |
| Snippet store | `src/renderer/stores/snippetStore.ts` |
| Shortcut store | `src/renderer/stores/shortcutStore.ts` |
| Export store | `src/renderer/stores/exportStore.ts` |
| Tab ordering | `src/renderer/stores/tabOrder.ts` |
| Cost tracking | `src/main/cost-tracker.ts` |
| Git context | `src/main/git-context.ts` |
| Auto-attach config | `src/main/auto-attach.ts` |
| Diff algorithm | `src/renderer/utils/diff.ts` |
| Keyboard shortcuts | `src/shared/keyboard-shortcuts.ts` |
| Session export logic | `src/shared/session-export.ts` |
| Command palette definitions | `src/shared/command-palette.ts` |
| Theme / color system | `src/renderer/theme.ts` |
| Window creation & IPC handlers | `src/main/index.ts` |
| Typed IPC bridge | `src/preload/index.ts` |
| Marketplace catalog | `src/main/marketplace/catalog.ts` |

## Conventions

- **TypeScript strict mode** — zero errors required, `npm run build` must pass.
- **`IPC.*` constants** for all IPC channel names (defined in `src/shared/types.ts`) — never hardcode strings.
- **`useColors()` hook** for all color references in renderer — never hardcode color values.
- **Narrow Zustand selectors** with custom equality functions to prevent re-renders during streaming.
- **Phosphor icons** (`@phosphor-icons/react`) — no other icon libraries.
- **Framer Motion** for animations.
- **Tab state transitions** go through ControlPlane only — never mutate tab state from renderer.
- Do not import main-process modules from renderer or vice versa — preload bridge is the only crossing point.
- Do not use `node-pty` for new features — it's legacy; prefer `RunManager` (stdio-based).
- Do not add network calls — the app is nearly offline (only marketplace fetches from GitHub).
- Do not use Electron `remote` module — disabled for security.

## Security Rules — Do Not Break

- Permission server binds to `127.0.0.1` only (never `0.0.0.0`).
- Per-launch app secret (random UUID) validates hook requests.
- Per-run tokens route permission responses to correct tab.
- `CLAUDECODE` env var is removed from spawned processes.
- Sensitive fields masked via `maskSensitiveFields()` before display.
- 5-minute auto-deny timeout on unanswered permissions.

## Adding Features — Wiring Checklist

**New IPC channel:** Add to `IPC` const in `src/shared/types.ts` → handler in `src/main/index.ts` → expose in `src/preload/index.ts` → call via `window.clui.*`.

**New event type from CLI:** Add raw type to `ClaudeEvent` union in `src/shared/types.ts` → add normalized form to `NormalizedEvent` → handle in `EventNormalizer.normalize()` → handle in `sessionStore.handleNormalizedEvent()`.

**New tab state field:** Add to `TabState` in `src/shared/types.ts` → initialize in `createTab()` in both ControlPlane and sessionStore → update only via ControlPlane events.

## Common Pitfalls

- Forgetting to restart dev server after main-process changes (renderer hot-reloads, main does not).
- Adding raw color values instead of `useColors()` — breaks theming.
- Mutating tab state from renderer instead of going through ControlPlane.
- Not handling `session_dead` event — crashed Claude processes must transition tab to `dead` status.
