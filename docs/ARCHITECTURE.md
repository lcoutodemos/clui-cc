# CLUI Architecture

## Overview

CLUI is an Electron desktop application (macOS + Windows) that provides a graphical interface for Claude Code CLI. It spawns `claude -p` subprocesses, parses their NDJSON output, and presents conversations in a floating overlay window.

```
┌──────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│  React 19 + Zustand 5 + Tailwind CSS 4 + Framer Motion      │
│                                                              │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐  │
│  │ TabStrip  │ │Conversation  │ │ InputBar │ │ Marketplace│  │
│  │          │ │   View       │ │          │ │   Panel    │  │
│  └──────────┘ └──────────────┘ └──────────┘ └────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌───────────┐  │
│  │ Command    │ │ Cost       │ │ DiffViewer│ │ Git Panel │  │
│  │ Palette    │ │ Dashboard  │ │           │ │           │  │
│  └────────────┘ └────────────┘ └───────────┘ └───────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌───────────┐  │
│  │ Comparison │ │ Snippet    │ │ Shortcut  │ │  Toast    │  │
│  │ View       │ │ Manager    │ │ Settings  │ │ Container │  │
│  └────────────┘ └────────────┘ └───────────┘ └───────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐               │
│  │ Workflow   │ │ TabGroup   │ │ TabContext│               │
│  │ Manager    │ │ Header     │ │ Menu      │               │
│  └────────────┘ └────────────┘ └───────────┘               │
│                         │                                    │
│          Multi-store architecture (Zustand)                  │
│                         │                                    │
│              window.clui (preload bridge)                    │
├──────────────────────────────────────────────────────────────┤
│                     Preload Script                           │
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
│                                                              │
│  ┌────────────────────┐  ┌────────────────────────────┐      │
│  │ CostTracker        │  │ GitContext                 │      │
│  │ Per-run cost/token  │  │ Git status + diff for     │      │
│  │ recording + summary │  │ working directory          │      │
│  └────────────────────┘  └────────────────────────────┘      │
│                                                              │
│  ┌────────────────────┐                                      │
│  │ AutoAttach         │                                      │
│  │ Project-scoped     │                                      │
│  │ context files      │                                      │
│  └────────────────────┘                                      │
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

### CostTracker (`cost-tracker.ts`)

Records per-run cost and token usage data. Provides:

- `recordRun()` — persists a `CostRecord` after each task completion.
- `getSummary()` — returns aggregated `CostSummary` with breakdowns by model, project, and day.
- `getHistory()` — returns raw cost records for display in the Cost Dashboard.

### GitContext (`git-context.ts`)

Provides git repository awareness for the active working directory:

- `getStatus()` — returns branch name, repo detection, and file-level status (`M`/`A`/`D`/`R`/`?`).
- `getDiff()` — returns diff output for the working directory.

### AutoAttach (`auto-attach.ts`)

Manages project-scoped context files that are automatically attached to prompts:

- `getConfig()` — reads auto-attach configuration for a project path.
- `setConfig()` / `addFile()` / `removeFile()` — CRUD operations on the file list.
- `resolveFiles()` — resolves relative paths to absolute paths for attachment.

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

Multi-store Zustand architecture. Each store manages a focused domain:

| Store | File | Manages |
|-------|------|---------|
| Session store | `stores/sessionStore.ts` | Tabs, messages, tab status, marketplace state, UI state |
| Command palette store | `stores/commandPaletteStore.ts` | Palette visibility, search, command selection |
| Comparison store | `stores/comparisonStore.ts` | Multi-model comparison groups and results |
| Workflow store | `stores/workflowStore.ts` | Workflow definitions, step execution, progress |
| Tab group store | `stores/tabGroupStore.ts` | Tab group CRUD, collapse state, ordering |
| Notification store | `stores/notificationStore.ts` | Toast queue, notification preferences |
| Snippet store | `stores/snippetStore.ts` | User-defined prompt snippets (CRUD) |
| Shortcut store | `stores/shortcutStore.ts` | Keyboard shortcut bindings and customization |
| Export store | `stores/exportStore.ts` | Session export dialog state and options |
| Tab order | `stores/tabOrder.ts` | Persistent tab ordering (localStorage) |

### Theme System (`theme.ts`)

Dual color palette (dark + light) defined as JS objects. `useColors()` hook returns the active palette reactively. All tokens are synced to CSS custom properties via `syncTokensToCss()` so CSS files can reference `var(--clui-*)`.

Theme mode state machine: `system | light | dark` with separate `_systemIsDark` tracking for OS value.

### Key Components

| Component | File | Description |
|-----------|------|-------------|
| TabStrip | `TabStrip.tsx` | Tab bar with new tab, history picker, settings popover |
| TabGroupHeader | `TabGroupHeader.tsx` | Collapsible header for tab groups |
| TabContextMenu | `TabContextMenu.tsx` | Right-click context menu for tabs (group, close, rename) |
| ConversationView | `ConversationView.tsx` | Scrollable message timeline with markdown rendering, tool call cards, permission cards |
| InputBar | `InputBar.tsx` | Prompt input with attachment chips, voice recording, slash command menu |
| CommandPalette | `CommandPalette.tsx` | Fuzzy-searchable command launcher (`Ctrl+K` / `Cmd+K`) |
| CostDashboard | `CostDashboard.tsx` | Token usage and cost visualization by model/project/day |
| DiffViewer | `DiffViewer.tsx` | Inline diff display for Edit tool calls |
| GitPanel | `GitPanel.tsx` | Git status and diff for the working directory |
| ComparisonView | `ComparisonView.tsx` | Side-by-side multi-model response comparison |
| ComparisonLauncher | `ComparisonLauncher.tsx` | UI to initiate a model comparison |
| WorkflowManager | `WorkflowManager.tsx` | Workflow chain management and execution |
| WorkflowEditor | `WorkflowEditor.tsx` | Create and edit workflow step definitions |
| WorkflowProgress | `WorkflowProgress.tsx` | Step-by-step execution progress display |
| SnippetManager | `SnippetManager.tsx` | CRUD interface for prompt snippets |
| ShortcutSettings | `ShortcutSettings.tsx` | Keyboard shortcut customization UI |
| ToastContainer | `ToastContainer.tsx` | Stacked toast notification display |
| Toast | `Toast.tsx` | Individual toast notification |
| ExportDialog | `ExportDialog.tsx` | Session export to Markdown or JSON |
| MarketplacePanel | `MarketplacePanel.tsx` | Plugin browser with search, tag filters, install confirmation |
| PermissionCard | `PermissionCard.tsx` | Allow/Deny prompt for tool calls |
| PermissionDeniedCard | `PermissionDeniedCard.tsx` | Fallback card when tools were denied |
| PermissionEditor | `PermissionEditor.tsx` | Permission rules management UI |
| PermissionWizard | `PermissionWizard.tsx` | First-run permission mode selection |
| HistoryPicker | `HistoryPicker.tsx` | Session history browser |
| SettingsPopover | `SettingsPopover.tsx` | App settings (theme, size, sound, etc.) |
| SlashCommandMenu | `SlashCommandMenu.tsx` | Autocomplete menu for `/` commands |
| StatusBar | `StatusBar.tsx` | Cost/tokens/model display at bottom of conversation |
| RetryBanner | `RetryBanner.tsx` | Retry state display for failed runs |
| AttachmentChips | `AttachmentChips.tsx` | File/image attachment badges below input |
| PopoverLayer | `PopoverLayer.tsx` | Portal layer for popover positioning |

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
