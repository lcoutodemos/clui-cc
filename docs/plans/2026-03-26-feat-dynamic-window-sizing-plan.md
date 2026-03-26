---
title: "Dynamic window sizing based on display workArea"
type: feat
status: active
date: 2026-03-26
---

# Dynamic Window Sizing Based on Display WorkArea

## Problem

The Electron BrowserWindow uses fixed dimensions (BAR_WIDTH=1400, PILL_HEIGHT=720).
This "invisible wall" causes content clipping whenever UI elements exceed these bounds:
- Vertically: Marketplace header clipped when chat is expanded
- Horizontally: Circle buttons clipped at high pill scales
- Fundamentally unfixable with workarounds (caps, compression, panel reduction)

## Solution

Replace fixed window dimensions with the display's available work area.
The window is transparent and click-through — making it display-sized has zero visual impact
but eliminates all clipping permanently.

## Implementation

### Step 1: Main process — dynamic dimensions

**File: `src/main/index.ts`**

Replace constants with display-derived values:

```typescript
// BEFORE:
const BAR_WIDTH = 1400
const PILL_HEIGHT = 720

// AFTER: computed per-display in createWindow() and reposition functions
// Keep as minimum fallbacks only:
const MIN_WIDTH = 1040
const MIN_HEIGHT = 720
```

In `createWindow()`:
```typescript
function createWindow(): void {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width: screenWidth, height: screenHeight } = display.workAreaSize
  const { x: dx, y: dy } = display.workArea

  const winWidth = Math.max(screenWidth, MIN_WIDTH)
  const winHeight = Math.max(screenHeight, MIN_HEIGHT)

  // Window fills entire workArea, positioned at origin
  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: dx,
    y: dy,
    // ... rest unchanged
  })
}
```

### Step 2: Display change handling

**File: `src/main/index.ts`**

Update the existing `display-metrics-changed` handler to resize the window:

```typescript
screen.on('display-metrics-changed', (_e, display, changedMetrics) => {
  if (changedMetrics.includes('workArea') && mainWindow && !mainWindow.isDestroyed()) {
    const { width, height } = display.workAreaSize
    const { x, y } = display.workArea
    mainWindow.setBounds({
      x, y,
      width: Math.max(width, MIN_WIDTH),
      height: Math.max(height, MIN_HEIGHT),
    })
  }
})
```

Also handle display-added/removed for monitor plug/unplug.

### Step 3: Renderer — remove all clipping workarounds

**File: `src/renderer/App.tsx`**

Remove these hacks that were compensating for the fixed window:

1. Remove `contentWidth` cap at 960 → use uncapped value
2. Remove `bodyMaxHeight` marketplace compression → use original value
3. The renderer drag code references `PILL_HEIGHT_CONST = 720` — change to
   `window.innerHeight` for accurate drag bounds

```typescript
// BEFORE:
const contentWidth = Math.min(Math.round(...), 960)
const bodyMaxHeight = marketplaceOpen ? 130 : (expandedUI ? 520 : 400)

// AFTER:
const contentWidth = Math.round((expandedUI ? 700 : spacing.contentWidth) * scale)
const bodyMaxHeight = expandedUI ? 520 : 400
```

### Step 4: Renderer — update drag vertical tracking

**File: `src/renderer/App.tsx`**

The upstream drag code uses `PILL_HEIGHT_CONST = 720`. Replace with actual window height:

```typescript
// BEFORE:
const PILL_HEIGHT_CONST = 720

// AFTER: (window.innerHeight is always current)
const windowHeight = window.innerHeight
```

### Step 5: Window positioning (bottom-aligned content)

The UI uses `flex flex-col justify-end h-full` — content stays at the bottom of the window.
With a display-sized window, the content is at the BOTTOM of the screen (above Dock).
This is the same visual position as before. No layout changes needed.

The `getBottomMargin()` dock calculation is no longer needed for window positioning
(window starts at workArea origin), but the CSS layout still pushes content to the bottom
via `justify-end`. The Dock margin could become a CSS `padding-bottom` on the outer flex
container if needed, but `justify-end` already handles this naturally since the workArea
excludes the Dock area for non-auto-hide Docks.

## What This Eliminates

| Workaround | Status |
|---|---|
| `contentWidth` cap at 960px | REMOVE |
| `bodyMaxHeight` compression for Marketplace | REMOVE |
| `PILL_HEIGHT_CONST` hardcoded in renderer | REPLACE with `window.innerHeight` |
| Circle button expansion distance reduction | REVERT to original spacing |
| Fixed BAR_WIDTH = 1400 | REMOVE |
| Fixed PILL_HEIGHT = 720 | REMOVE |

## Edge Cases

- **Very small display** (e.g., 11" MacBook, 1366x768): MIN_WIDTH/MIN_HEIGHT fallbacks ensure minimum usability
- **Monitor hot-swap**: `display-metrics-changed` + `display-added/removed` handlers resize immediately
- **Multiple monitors**: Window follows cursor to nearest display (existing behavior preserved)
- **Full-screen apps**: workArea respects fullscreen — window stays in available space

## Acceptance Criteria

- [ ] Window fills display workArea (transparent, no visual difference)
- [ ] No content clipping at any scale (75%-150%)
- [ ] Marketplace fully visible with expanded chat
- [ ] Circle buttons fully accessible at 150% scale
- [ ] Monitor unplug → window resizes to new display
- [ ] Monitor plug → window can use new display space
- [ ] Minimum 1040x720 even on tiny displays
- [ ] Drag functionality works with dynamic height
- [ ] All previous workarounds removed (clean code)
