---
title: "Refactor HistoryPicker from Portal Popover to Inline Panel"
type: refactor
status: completed
date: 2026-03-26
---

# Refactor HistoryPicker from Portal Popover to Inline Panel

## Overview

Apply the same refactoring pattern used for SettingsPopover to HistoryPicker: replace the `createPortal`-based 280px popover with an inline panel rendered above the main card in App.tsx, matching the Marketplace/Settings visual pattern.

## Problem Statement

HistoryPicker renders as a narrow fixed-position popover via `createPortal` + `usePopoverLayer`. This is inconsistent with the Settings and Marketplace panels which render inline, centered, and full-card-width above the main card. The popover also overlaps other UI and has awkward positioning logic.

## Bottlenecks from Settings Refactoring (Lessons Learned)

These are the specific issues that caused rework during the Settings panel refactoring. Each has a mitigation strategy.

### B1: Click-Outside vs Trigger Toggle Race

**Problem:** Clicking the trigger button to close the panel fires: (1) click-outside handler closes it, (2) button onClick reopens it.
**Mitigation:** Use `data-history-panel` and `data-history-trigger` attributes. The click-outside handler in App.tsx must exclude both selectors. Copy the exact pattern from Settings (`settingsOpen` useEffect at `App.tsx:111-125`).

### B2: Async Data Loading Timing

**Problem:** HistoryPicker currently calls `loadSessions()` inside `handleToggle`. When state moves to the store, the component rendering the content is different from the one toggling it.
**Mitigation:** `HistoryContent` component must have a `useEffect` that calls `loadSessions()` on mount. This naturally fires when `historyOpen` becomes true and the component mounts via `AnimatePresence`. No store-level side effects needed.

### B3: Mutual Exclusion Chain

**Problem:** Settings, Marketplace, and History must be mutually exclusive. Currently only Settings hides when Marketplace opens (`settingsOpen && !marketplaceOpen` in App.tsx). Adding a third panel makes the condition messy.
**Mitigation:** Each `toggle*` function closes the other two panels. Specifically:
- `toggleHistory`: close `settingsOpen` + `marketplaceOpen`
- `toggleMarketplace`: close `settingsOpen` + `historyOpen`
- `toggleSettings`: close `marketplaceOpen` + `historyOpen`

### B4: Width Slider Close

**Problem:** Dragging the width slider closes Settings because the panel width is about to change. History panel should also close.
**Mitigation:** The `clui-scale-start` event handler in App.tsx already closes Settings. Add History close to the same handler.

### B5: Portal + Position Cleanup

**Problem:** Leaving dead code (position calculations, portal refs, PopoverLayer import) after migration.
**Mitigation:** Complete removal checklist in acceptance criteria. No `createPortal`, no `usePopoverLayer`, no `updatePos`, no `pos` state.

## Proposed Solution

### Step 1: Add `historyOpen` + `toggleHistory` to `sessionStore`

**File:** `src/renderer/stores/sessionStore.ts`

Add to interface and implementation:
```typescript
// Interface
historyOpen: boolean
toggleHistory: () => void

// Implementation
historyOpen: false,
toggleHistory: () => {
  const s = get()
  if (s.historyOpen) {
    set({ historyOpen: false })
  } else {
    // Mutual exclusion: close marketplace
    // Also close settings via themeStore
    set({ historyOpen: true, marketplaceOpen: false })
    useThemeStore.getState().settingsOpen && useThemeStore.getState().toggleSettings()
  }
},
```

Also update existing functions to close history:
- `toggleMarketplace`: add `historyOpen: false`
- `toggleExpanded` / `selectTab` / `createTab`: add `historyOpen: false`

**File:** `src/renderer/theme.ts`

Update `toggleSettings` to also close history:
```typescript
toggleSettings: () => {
  const next = !get().settingsOpen
  set({ settingsOpen: next })
  if (next) {
    // Close history + marketplace when opening settings
    const ss = useSessionStore.getState()
    if (ss.historyOpen) ss.toggleHistory()  // or direct set
    if (ss.marketplaceOpen) ss.toggleMarketplace()
  }
}
```

> **Circular import risk:** sessionStore importing themeStore (or vice versa) for mutual exclusion. Both already exist as standalone zustand stores. Use `useThemeStore.getState()` inside sessionStore action (lazy access, no import cycle). Confirm themeStore already imports from sessionStore or not — if not, keep the cross-reference one-directional.

### Step 2: Split HistoryPicker into Trigger + Content

**File:** `src/renderer/components/HistoryPicker.tsx`

**Keep:** `formatTimeAgo`, `formatSize` helpers, session list rendering UI
**Remove:** `createPortal`, `usePopoverLayer`, `updatePos`, `pos` state, `triggerRef`/`popoverRef`, click-outside useEffect, position calculation, `open` local state

Export two components:
- `HistoryTrigger` — Clock button, calls `sessionStore.toggleHistory()`
- `HistoryContent` — Panel content (header + session list), loads sessions on mount via useEffect

```typescript
// HistoryTrigger (used in TabStrip)
export function HistoryTrigger() {
  const toggleHistory = useSessionStore((s) => s.toggleHistory)
  const colors = useColors()
  return (
    <button
      data-history-trigger
      onClick={toggleHistory}
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
      style={{ color: colors.textTertiary }}
      title="Resume a previous session"
    >
      <Clock size={13} />
    </button>
  )
}

// HistoryContent (rendered inline in App.tsx)
export function HistoryContent() {
  // Load sessions on mount (component mounts when historyOpen becomes true)
  useEffect(() => { void loadSessions() }, [effectiveProjectPath])
  // ... session list UI, adapted to full-width layout
}
```

**Layout adaptation for HistoryContent:**
- Remove fixed 280px width constraint
- Session items: use horizontal layout (icon + text + metadata inline) instead of stacked
- Add hover styles consistent with Settings/Marketplace rows
- Keep existing `formatTimeAgo` and `formatSize` helpers

### Step 3: Render HistoryContent Inline in App.tsx

**File:** `src/renderer/App.tsx`

Add between Settings panel and main card, following the exact same pattern:

```tsx
import { HistoryContent } from './components/HistoryPicker'

// ... inside content column, after Settings AnimatePresence block:
<AnimatePresence initial={false}>
  {historyOpen && !marketplaceOpen && !settingsOpen && (
    <div
      data-clui-ui
      data-history-panel
      style={{
        width: isExpanded ? cardExpandedWidth : cardCollapsedWidth,
        marginLeft: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 14,
        position: 'relative',
        zIndex: 25,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={TRANSITION}
      >
        <div
          data-clui-ui
          className="glass-surface no-drag"
          style={{ borderRadius: 24, maxHeight: 350, overflowY: 'auto' }}
        >
          <HistoryContent />
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
```

### Step 4: Click-Outside Handler for History

**File:** `src/renderer/App.tsx`

Add useEffect mirroring the Settings pattern:

```tsx
useEffect(() => {
  if (!historyOpen) return
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest?.('[data-history-panel]') || target.closest?.('[data-history-trigger]')) return
    useSessionStore.getState().toggleHistory()  // or direct set
  }
  const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('mousedown', handler)
  }
}, [historyOpen])
```

### Step 5: Update Width Slider Close Handler

**File:** `src/renderer/App.tsx` (existing `clui-scale-start` useEffect)

```tsx
useEffect(() => {
  const onScaleStart = () => {
    if (useThemeStore.getState().settingsOpen) useThemeStore.getState().toggleSettings()
    if (useSessionStore.getState().historyOpen) set historyOpen false  // add this
  }
  window.addEventListener('clui-scale-start', onScaleStart)
  return () => window.removeEventListener('clui-scale-start', onScaleStart)
}, [])
```

### Step 6: Update TabStrip Import

**File:** `src/renderer/components/TabStrip.tsx`

```diff
- import { HistoryPicker } from './HistoryPicker'
+ import { HistoryTrigger } from './HistoryPicker'

  // In JSX:
- <HistoryPicker />
+ <HistoryTrigger />
```

## Acceptance Criteria

- [ ] History panel renders inline above card (same visual pattern as Settings/Marketplace)
- [ ] Panel width matches card width (responsive to `isExpanded` + `pillScale`)
- [ ] `createPortal` completely removed from HistoryPicker.tsx
- [ ] `usePopoverLayer` import removed
- [ ] All position calculation code removed (`updatePos`, `pos` state, `triggerRef`, `popoverRef`)
- [ ] Click-outside-to-close works (via data attributes, not refs)
- [ ] Clicking trigger button toggles cleanly (no race condition — B1)
- [ ] Sessions load automatically when panel opens (B2)
- [ ] Mutual exclusion: only one of Settings/Marketplace/History open at a time (B3)
- [ ] Width slider drag closes History panel (B4)
- [ ] No dead portal/position code remains (B5)
- [ ] AnimatePresence exit animation plays smoothly
- [ ] Session resume still works after selecting an item
