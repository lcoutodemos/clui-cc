# Agent Guide — Clui CC

> This file is optimized for AI coding agents (Claude Code, Cursor, Copilot, etc.).
> For human-readable docs see [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

## What This Project Is

Clui CC is an **Electron desktop overlay** (macOS + Windows) that wraps the Claude Code CLI (`claude -p --output-format stream-json`) in a floating pill UI. It is NOT a web app, NOT a VS Code extension, and does NOT call the Anthropic API directly — it spawns CLI subprocesses.

## Quick Reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev mode (hot-reload) | `npm run dev` |
| Type-check / build | `npm run build` |
| Run tests | `npm run test` |
| Tests in watch mode | `npm run test:watch` |
| Toggle overlay | `Alt+Space` (macOS) / `Ctrl+Space` (Windows) |
| Debug logging | `CLUI_DEBUG=1 npm run dev` (writes to `~/.clui-debug.log`) |

**Main process changes require full restart.** Renderer changes hot-reload.

## Architecture (3-Layer)

```
Renderer (React 19 + Zustand 5 + Tailwind CSS 4 + Framer Motion)
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
| **Main** | `src/main/` | Process lifecycle, tab state machine, permission server, marketplace, cost tracking, git context, auto-attach |

### Key Files by Concern

| Concern | File(s) |
|---------|---------|
| Tab lifecycle & state machine | `src/main/claude/control-plane.ts` |
| Spawning Claude CLI processes | `src/main/claude/run-manager.ts` |
| Raw NDJSON → canonical events | `src/main/claude/event-normalizer.ts` |
| Permission hook server | `src/main/hooks/permission-server.ts` |
| All TypeScript types & IPC channels | `src/shared/types.ts` |
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
- **`CostRecord`** — per-run cost/token data
- **`CostSummary`** — aggregated cost breakdown by model, project, day
- **`GitStatus`** — repository branch + file status
- **`GitFileStatus`** — individual file change status (`M`/`A`/`D`/`R`/`?`)
- **`TabGroup`** — tab group with name, color, collapse state
- **`AutoAttachConfig`** — project-scoped context files for auto-attachment
- **`ExportOptions`** / **`SessionExportData`** — session export configuration and output
- **`ShortcutBinding`** / **`ShortcutMap`** — keyboard shortcut customization
- **`AgentAssignment`** / **`AgentMemorySnapshot`** — multi-agent work coordination

Additional types in dedicated shared modules:

- **`PaletteCommand`** — `src/shared/command-palette.ts`
- **`ShortcutActionId`** / **`ShortcutConflict`** — `src/shared/keyboard-shortcuts.ts`

Renderer-only types (in store files):

- **`ComparisonGroup`** — `src/renderer/stores/comparisonStore.ts`
- **`Workflow`** / **`WorkflowStep`** / **`WorkflowExecution`** — `src/renderer/stores/workflowStore.ts`
- **`Snippet`** — `src/renderer/stores/snippetStore.ts`
- **`Toast`** — `src/renderer/stores/notificationStore.ts`

## Conventions & Rules

### Must Follow

1. **TypeScript strict mode** — zero errors required (`npm run build` must pass)
2. **Tests must pass** — `npm run test` must pass with zero failures
3. **Use `IPC.*` constants** for all IPC channel names — never hardcode strings
4. **Use `useColors()` hook** for all color references in renderer — never hardcode colors
5. **Narrow Zustand selectors** with custom equality functions for performance
6. **All new IPC channels** must be added to `src/shared/types.ts` AND wired in both `src/preload/index.ts` and `src/main/index.ts`
7. **Tab state transitions** go through `ControlPlane` only — never mutate tab state directly
8. **Always persist the Claude session ID** — whenever a session is created or resumed, save the session ID to a durable location (e.g., a file in `~/.claude/` or app config) so it can be recovered if the app or process crashes. Never rely solely on in-memory state for session tracking. If the session crashes, it must be resumable via `claude --resume <session-id>` without manual lookup.

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
| Testing | Vitest | 4 |
| PTY (legacy) | node-pty | 1.1 |

## Network Surface

| Endpoint | Purpose | Required |
|----------|---------|----------|
| `raw.githubusercontent.com/anthropics/*` | Marketplace catalog (cached 5 min) | No |
| `api.github.com/repos/anthropics/*/tarball/*` | Skill auto-install | No |
| `127.0.0.1:19836` | Permission hook server (local only) | Yes |

No telemetry. No analytics. No auto-update.

## Development Workflow — Mandatory for All Issues

Every issue (bug fix, feature, refactor) MUST follow this workflow strictly.

This applies to any coding agent, in any client, using any LLM.

- If an agent picks up an issue to implement, it MUST create and use a new branch based on the current `main` branch.
- Agents MUST NOT implement issue work directly on `main`.

### 1. Create a Worktree (Mandatory for Parallel Work)

Multiple agents may work on the same repo simultaneously. To avoid conflicts, each agent MUST use a **git worktree** — never switch branches in the main working directory.

```bash
# From the main repo directory:
git worktree add ../clui-cc-FEAT-XXX FEAT-XXX/short-description 2>/dev/null || \
  (git branch FEAT-XXX/short-description main && git worktree add ../clui-cc-FEAT-XXX FEAT-XXX/short-description)

# Work inside the worktree:
cd ../clui-cc-FEAT-XXX
npm install   # worktrees share .git but not node_modules
```

**Rules:**
- Worktree directory name: `../clui-cc-<ISSUE-PREFIX>` (e.g. `../clui-cc-FEAT-006`)
- Branch name MUST start with the issue prefix (e.g. `FEAT-006/command-palette`)
- NEVER run `git checkout` to switch branches in the main repo — it breaks other agents' work
- After PR is merged, clean up: `git worktree remove ../clui-cc-FEAT-XXX`
- Each worktree needs its own `npm install` since `node_modules` is not shared

### 2. TDD — Tests First, Then Code
1. **Write failing tests first** that cover the expected behavior, edge cases, and error paths.
2. **Run tests** — confirm they fail (red).
3. **Write the minimum code** to make all tests pass (green).
4. **Refactor** if needed — tests must stay green.

Never skip TDD. Never write implementation before tests. If you're unsure what to test, define acceptance criteria from the issue before writing any code.

```bash
npm run test          # run all tests
npm run test:watch    # watch mode during development
```

### 3. Commit, Push, Create PR, and Enable Auto-Merge
```bash
git add <specific files>
git commit -m "FEAT-XXX: <descriptive message>"
git push -u origin FEAT-XXX/short-description
gh pr create --title "FEAT-XXX: <title>" --body "Closes #<issue-number>..."
gh pr merge <N> --auto --merge --delete-branch
```

- Commit message MUST start with the issue prefix: `FEAT-XXX: ...`, `WIN-XXX: ...`, etc.
- PR MUST reference the issue it closes: `Closes #N`
- One PR per issue. Do not bundle unrelated changes.
- **Always enable auto-merge** (`--auto`) — PR merges automatically when CI passes.

### 4. PR Merge Strategy — Auto-Merge After CI
After pushing and creating the PR, **always enable auto-merge**:

```bash
gh pr create --title "FEAT-XXX: <title>" --body "Closes #N ..."
gh pr merge <N> --auto --merge --delete-branch
```

This tells GitHub to merge automatically once required CI checks pass (`build-and-test` on Node 20 + 22). Do NOT merge manually unless CI is broken and you need to bypass.

If a PR fails CI:
1. Check the failure: `gh pr checks <N>`
2. Fix the issue, commit, push
3. Auto-merge remains armed — it will trigger once checks go green

Do not leave PRs hanging. The cycle is: push → PR → enable auto-merge → fix CI if needed.

### 5. PR Checklist
- [ ] All new code has tests written BEFORE the implementation
- [ ] `npm run build` passes with zero errors
- [ ] `npm run test` passes with zero failures
- [ ] No hardcoded platform assumptions (test on both macOS and Windows)
- [ ] PR description explains what changed and why

## Common Pitfalls

1. **Forgetting to restart dev server** after main-process changes — renderer hot-reloads but main does not
2. **Adding raw color values** instead of using `useColors()` — breaks theming
3. **Mutating tab state from renderer** instead of going through ControlPlane events
4. **Hardcoding IPC strings** instead of using `IPC.*` constants
5. **Not handling the `session_dead` event** — if a Claude process crashes, the tab must transition to `dead` status
6. **Writing implementation before tests** — all development is TDD, tests first
