---
title: "Rebase Work onto Updated Main and Split into 2 PRs"
type: refactor
status: active
date: 2026-03-26
---

# Rebase Work onto Updated Main and Split into 2 PRs

## Overview

Reapply our 15 commits (from `backup/all-local-work`) onto the updated `upstream/main` (58d18bb), split into 2 focused PRs for clean review. The terminal launcher feature is excluded (will be contributed to existing PR #19 separately).

## Current State

- `upstream/main` = `58d18bb` (includes window dragging, edit diff preview, security CSP)
- `backup/all-local-work` = `a7018d4` (our 15 commits, based on old main `79adb7a`)
- `origin` = `okletstryitnow/clui-cc` (fork, main synced)
- Upstream changed: App.tsx, ConversationView.tsx, theme.ts, index.ts, preload, types, index.css

## PR Structure

### PR 1: `feat/ui-panel-improvements`

**Scope:** UI refactoring and visual fixes

| Change | Source Commits | Files | Upstream Conflict Risk |
|--------|---------------|-------|----------------------|
| Settings Panel: portal → inline | `fcd0f84` | App.tsx, SettingsPopover.tsx | **MEDIUM** — App.tsx has new drag code, but different section |
| History Panel: portal → inline | `a7018d4` (uncommitted) | App.tsx, HistoryPicker.tsx, TabStrip.tsx, sessionStore.ts | **MEDIUM** — same App.tsx concern |
| Tool-call text contrast fix | `a7018d4` | ConversationView.tsx | **LOW** — upstream added code nearby but didn't touch textMuted lines |
| Right-edge clipping fix | `a7018d4` | ConversationView.tsx | **NONE** — padding change on scroll container |
| Panel/chat mutual exclusion | `a7018d4` | sessionStore.ts, App.tsx | **LOW** — sessionStore unchanged upstream |
| Pill width scale + Full Width | `e6d4627`, `e6d9659` | SettingsPopover.tsx, theme.ts, App.tsx | **MEDIUM** — App.tsx layout section changed upstream |

**Strategy for App.tsx (the only real conflict zone):**

Upstream App.tsx now has:
1. `dragRef`, `windowYRef`, `cardYRef` refs (lines 63-71)
2. Drag mousedown/mousemove/mouseup effect (lines 111-186)
3. `transform: 'translateY(var(--clui-card-y, 0px))'` on content column
4. `width` uses `contentWidth` directly (no `pillScale` multiplication — upstream removed that)

Our App.tsx additions:
1. `SettingsContent` + `HistoryContent` imports
2. `historyOpen`, `settingsOpen` state subscriptions
3. Settings/History `AnimatePresence` blocks (new DOM, between Marketplace and Card)
4. Click-outside useEffects for Settings + History
5. Mutual exclusion useEffect
6. `clui-scale-start` handler
7. `pillScale` layout calculations

**Merge approach:** Start from upstream App.tsx, add our blocks in sequence. No code needs to be replaced — everything is additive. The `pillScale` layout must be adapted to upstream's simpler `contentWidth` (they removed the scale multiplication, we need to reintroduce it or adapt).

### PR 2: `fix/dock-display-binary`

**Scope:** Infrastructure and platform fixes

| Change | Source Commits | Files | Upstream Conflict Risk |
|--------|---------------|-------|----------------------|
| Dock auto-hide bottom margin | `8c9045e` | index.ts (main) | **LOW** — different section than upstream's drag IPC |
| Dynamic BAR_WIDTH for small displays | `14651e3` | index.ts (main) | **LOW** — touches window creation, upstream added drag handlers elsewhere |
| Binary path `~/.local/bin/claude` | (in run-manager.ts) | run-manager.ts | **NONE** — upstream didn't touch this file |
| PermissionDeniedCard terminal param | `14651e3` | PermissionDeniedCard.tsx | **NONE** |
| Gitignore dev artifacts | `7cdc7f7` | .gitignore | **NONE** |

**Strategy:** Mostly clean cherry-picks or copy-paste. Only `index.ts` needs care — our dock/BAR_WIDTH changes go into a file that upstream added CSP and drag IPC to. But different functions, so no line-level conflicts.

### Excluded: Terminal Launcher (→ contribute to PR #19)

| Change | Source Commits | Disposition |
|--------|---------------|------------|
| terminal-launcher.ts | `692f6e7` - `7bdc6fe` | Review PR #19, contribute improvements (Ghostty `open -na` fix, iTerm tmux, `--command=` single-arg) |
| Terminal settings in theme store | `da0fec5`, `a9f1a18` | Include in PR #19 contribution or own PR |
| Terminal IPC wiring | `1336f85` | Part of terminal feature |
| StatusBar terminal param | | Part of terminal feature |

## Implementation Steps

### Step 1: Create PR 1 branch and reapply UI changes

```bash
git checkout main
git checkout -b feat/ui-panel-improvements
```

**Order of operations (build up, test each step):**

1. **theme.ts** — Add `settingsOpen`, `toggleSettings`, `pillScale`, `expandedUI` persistence, `terminalApp` placeholder to store. Add `useColors` if not present. (Additive, no conflict with upstream's diffRemovedBg/diffAddedBg additions)

2. **sessionStore.ts** — Add `historyOpen`, `toggleHistory`, update `toggleMarketplace`/`selectTab`/`toggleExpanded`/`buildYourOwn` for mutual exclusion. (Upstream didn't change this file)

3. **SettingsPopover.tsx** — Complete rewrite: split into `SettingsContent` (panel body) + `SettingsPopover` (trigger button). (Upstream didn't change this file)

4. **HistoryPicker.tsx** — Complete rewrite: split into `HistoryContent` + `HistoryTrigger`, remove createPortal. (Upstream didn't change this file)

5. **TabStrip.tsx** — Update imports: `HistoryPicker` → `HistoryTrigger`. (Upstream didn't change)

6. **ConversationView.tsx** — Apply `textMuted` → `textTertiary` fix (4 locations) + `px-4` → `pl-4 pr-5`. (Upstream added diff preview code but our changes are in different locations — low risk)

7. **App.tsx** — The big one. Start from upstream version (58d18bb), add:
   - Import `SettingsContent`, `HistoryContent`
   - `pillScale` layout calculations (reintroduce scale multiplication)
   - `historyOpen`, `settingsOpen` subscriptions
   - Settings panel AnimatePresence block
   - History panel AnimatePresence block
   - Click-outside useEffects (settings, history)
   - Mutual exclusion useEffect (settings → close history/marketplace/collapse chat)
   - `clui-scale-start` handler
   - Keep ALL upstream additions (drag refs, drag effects, translateY)

8. **Build + verify** — `npm run build` must succeed

### Step 2: Create PR 2 branch and reapply infra fixes

```bash
git checkout main
git checkout -b fix/dock-display-binary
```

1. **run-manager.ts** — Add `~/.local/bin/claude` to binary candidates
2. **index.ts (main)** — Add `getBottomMargin()` function, dynamic BAR_WIDTH calculation, dock `display-metrics-changed` listener
3. **PermissionDeniedCard.tsx** — Add `terminalApp` prop
4. **.gitignore** — Add development artifact patterns
5. **Build + verify**

### Step 3: Push and create PRs

```bash
# PR 1
git push -u origin feat/ui-panel-improvements
gh pr create --repo lcoutodemos/clui-cc --title "feat: inline Settings/History panels, fix tool-call contrast and content clipping" --body "..."

# PR 2
git push -u origin fix/dock-display-binary
gh pr create --repo lcoutodemos/clui-cc --title "fix: Dock auto-hide margin, dynamic BAR_WIDTH, binary path detection" --body "..."
```

### Step 4: Contribute to PR #19 (Terminal Selector)

1. Read PR #19 diff to understand their implementation
2. Open a review comment highlighting our improvements:
   - `open -na` fix (Ghostty ignores `--args` without `-n`)
   - iTerm2 app name is "iTerm" not "iTerm2"
   - `--command=` single-arg for Ghostty (avoids split)
   - tmux integration for iTerm
3. Either post code suggestions or offer to add commits

## Acceptance Criteria

- [ ] PR 1 branch builds cleanly on upstream/main (58d18bb)
- [ ] PR 1 contains ONLY UI panel refactoring + visual fixes
- [ ] PR 2 branch builds cleanly on upstream/main (58d18bb)
- [ ] PR 2 contains ONLY infra/platform fixes
- [ ] No terminal-launcher code in either PR
- [ ] All upstream features preserved (dragging, diff preview, CSP)
- [ ] Settings/History panels work with upstream's new drag functionality
- [ ] `backup/all-local-work` branch preserved as safety net

## Sources

- Upstream main: `58d18bb` (9 commits since our branch point)
- Our work: `backup/all-local-work` at `a7018d4` (15 commits)
- Related PRs: #19 (terminal selector), #21 (UI scaling), #33 (binary detection)
- Fork: `okletstryitnow/clui-cc`
