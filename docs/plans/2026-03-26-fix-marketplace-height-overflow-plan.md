---
title: "Fix Marketplace panel header clipping when chat is expanded"
type: fix
status: active
date: 2026-03-26
---

# Fix Marketplace Panel Header Clipping

## Problem

When the Skills Marketplace panel opens with the chat expanded, the total height
(Marketplace 470px + Card ~580px + Input 56px = ~1106px) exceeds PILL_HEIGHT (720px).
The content is pushed to the bottom via `justify-end`, causing the Marketplace header
("Skills Marketplace" title, close button, result count) to clip above the window top.

## Constraints (from user feedback)

1. Chat must NOT collapse or resize when Marketplace opens
2. Marketplace header must ALWAYS be visible
3. Marketplace must have full height (470px) when chat is collapsed

## Solution

Make Marketplace `maxHeight` dynamic based on available vertical space:

- **Chat collapsed:** `maxHeight: 470` (full, plenty of room)
- **Chat expanded:** `maxHeight: 220` (header + search + tags + card peek)

At 220px the Marketplace shows:
- Header with title/close button (~60px)
- Search bar (~50px)
- Tag filter row (~40px)
- ~70px for scrollable card grid (1 row partially visible)

### Implementation

**File: `src/renderer/App.tsx`**

1. Revert `bodyMaxHeight` compression (chat stays full size)
2. Calculate available space for Marketplace:

```tsx
const bodyMaxHeight = expandedUI ? 520 : 400  // revert to original
const marketplaceMaxHeight = isExpanded ? 220 : 470
```

3. Apply to Marketplace glass-surface:

```tsx
<div className="glass-surface ..." style={{ borderRadius: 24, maxHeight: marketplaceMaxHeight }}>
  <MarketplacePanel />
</div>
```

## Acceptance Criteria

- [ ] Marketplace header always visible (collapsed AND expanded chat)
- [ ] Chat does not resize or collapse when Marketplace opens
- [ ] Marketplace is full 470px when chat is collapsed
- [ ] Marketplace scrolls its content within reduced height when chat is expanded
