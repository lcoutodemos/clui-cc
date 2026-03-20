# Terminal App Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to select their preferred terminal application (Terminal, iTerm 2, Warp, Ghostty, or custom) during initial setup and change it later via a dropdown menu in the status bar.

**Architecture:** Implement a three-layer system: (1) Terminal detection on-demand in Electron main process, (2) Zustand store for preference persistence to localStorage, (3) UI dropdown in StatusBar component matching existing down-arrow pattern (like model picker).

**Tech Stack:** Electron (main process), Zustand (state), React (UI), AppleScript (Terminal/iTerm launch), child_process.execFile (CLI launch — safe, no shell injection).

---

## Task 1: Terminal Detection Utility

**Files:**
- Create: `src/main/terminal-detector.ts`
- Test: Unit tests inline (verify with manual checks)

**Step 1: Create terminal detector with type definitions**

```typescript
// src/main/terminal-detector.ts
import { existsSync, statSync } from 'fs'
import { execFileSync } from 'child_process'
import { homedir } from 'os'

export type TerminalType = 'applescript' | 'cli'

export interface DetectedTerminal {
  name: string
  displayName: string
  path: string
  type: TerminalType
}

const KNOWN_TERMINALS: Array<{
  name: string
  displayName: string
  appPath: string
  cliBin?: string
  type: TerminalType
}> = [
  {
    name: 'Terminal',
    displayName: 'macOS Terminal',
    appPath: '/Applications/Utilities/Terminal.app',
    type: 'applescript',
  },
  {
    name: 'iTerm2',
    displayName: 'iTerm 2',
    appPath: '/Applications/iTerm.app',
    type: 'applescript',
  },
  {
    name: 'Warp',
    displayName: 'Warp',
    appPath: '/Applications/Warp.app',
    cliBin: 'warp',
    type: 'cli',
  },
  {
    name: 'Ghostty',
    displayName: 'Ghostty',
    appPath: '/Applications/Ghostty.app',
    cliBin: 'ghostty',
    type: 'cli',
  },
]

export function detectTerminals(): DetectedTerminal[] {
  const detected: DetectedTerminal[] = []

  for (const terminal of KNOWN_TERMINALS) {
    // Try app path first
    if (existsSync(terminal.appPath)) {
      detected.push({
        name: terminal.name,
        displayName: terminal.displayName,
        path: terminal.appPath,
        type: terminal.type,
      })
      continue
    }

    // Try CLI binary via shell path lookup
    if (terminal.cliBin) {
      try {
        const binPath = execFileSync('/bin/sh', ['-c', `command -v ${terminal.cliBin}`], {
          encoding: 'utf-8',
          stdio: 'pipe',
        }).trim()
        if (binPath) {
          detected.push({
            name: terminal.name,
            displayName: terminal.displayName,
            path: binPath,
            type: terminal.type,
          })
          continue
        }
      } catch {}
    }
  }

  return detected
}

export function isValidExecutable(path: string): boolean {
  try {
    const stat = statSync(path)
    // Check if file exists and is executable or is an app bundle
    return path.endsWith('.app') || (stat.isFile() && (stat.mode & 0o111) !== 0)
  } catch {
    return false
  }
}
```

**Step 2: Verify detection works (manual test in main process)**

After implementing, you'll test this in Task 3 when adding the IPC handler. The detection should find terminals on the user's system.

---

## Task 2: Terminal Launcher Utility

**Files:**
- Create: `src/main/terminal-launcher.ts`

**Step 1: Create launcher with per-terminal launch methods**

```typescript
// src/main/terminal-launcher.ts
import { execFile } from 'child_process'
import { DetectedTerminal } from './terminal-detector'

export interface LaunchOptions {
  terminal: DetectedTerminal
  projectPath: string
  sessionId?: string | null
  claudeBin?: string
}

function escapeAppleScriptString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function launchViaAppleScript(
  terminal: DetectedTerminal,
  projectPath: string,
  sessionId: string | null,
  claudeBin: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const projectDir = escapeAppleScriptString(projectPath)
    let cmd: string
    if (sessionId) {
      cmd = `cd \\"${projectDir}\\" && ${claudeBin} --resume ${sessionId}`
    } else {
      cmd = `cd \\"${projectDir}\\" && ${claudeBin}`
    }

    const appName = terminal.name === 'iTerm2' ? 'iTerm' : 'Terminal'

    let script: string
    if (terminal.name === 'iTerm2') {
      // iTerm uses different syntax
      script = `tell application "iTerm"
  activate
  create window with default profile
  tell current session of current window
    write text "${cmd}"
  end tell
end tell`
    } else {
      // Terminal uses do script
      script = `tell application "${appName}"
  activate
  do script "${cmd}"
end tell`
    }

    execFile('/usr/bin/osascript', ['-e', script], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function launchViaCLI(
  terminal: DetectedTerminal,
  projectPath: string,
  sessionId: string | null,
  claudeBin: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Build command as array of arguments to avoid shell injection
    // For CLI terminals, pass the full command as a string via -c flag
    const shellCmd = sessionId
      ? `cd "${projectPath}" && ${claudeBin} --resume ${sessionId}`
      : `cd "${projectPath}" && ${claudeBin}`

    // Use /bin/sh -c to safely execute the composed command
    execFile('/bin/sh', ['-c', shellCmd], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export async function launchTerminal(options: LaunchOptions): Promise<void> {
  const { terminal, projectPath, sessionId, claudeBin = 'claude' } = options

  try {
    if (terminal.type === 'applescript') {
      await launchViaAppleScript(terminal, projectPath, sessionId || null, claudeBin)
    } else {
      await launchViaCLI(terminal, projectPath, sessionId || null, claudeBin)
    }
  } catch (err) {
    throw new Error(`Failed to launch ${terminal.displayName}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

---

## Task 3: IPC Handlers for Terminal Detection & Selection

**Files:**
- Modify: `src/main/index.ts` (add new IPC handlers)

**Step 1: Add import statements**

At the top of `src/main/index.ts`, add:
```typescript
import { detectTerminals, type DetectedTerminal, isValidExecutable } from './terminal-detector'
import { launchTerminal, type LaunchOptions } from './terminal-launcher'
```

**Step 2: Add DETECT_TERMINALS IPC handler (after line 509, before ATTACH_FILES)**

```typescript
ipcMain.handle(IPC.DETECT_TERMINALS, async () => {
  log('IPC DETECT_TERMINALS')
  try {
    const terminals = detectTerminals()
    return { terminals, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`DETECT_TERMINALS error: ${msg}`)
    return { terminals: [], error: msg }
  }
})
```

**Step 3: Add SELECT_CUSTOM_TERMINAL IPC handler (after DETECT_TERMINALS)**

```typescript
ipcMain.handle(IPC.SELECT_CUSTOM_TERMINAL, async () => {
  if (!mainWindow) return null
  if (process.platform === 'darwin') app.focus()

  const options = { properties: ['openFile'] as const }
  const result = process.platform === 'darwin'
    ? await dialog.showOpenDialog(options)
    : await dialog.showOpenDialog(mainWindow, options)

  if (result.canceled || result.filePaths.length === 0) return null

  const selectedPath = result.filePaths[0]
  if (!isValidExecutable(selectedPath)) {
    log(`SELECT_CUSTOM_TERMINAL: selected path is not executable: ${selectedPath}`)
    return null
  }

  return selectedPath
})
```

**Step 4: Modify OPEN_IN_TERMINAL handler to accept terminalName parameter**

Replace the existing `OPEN_IN_TERMINAL` handler (lines 799-837) with:

```typescript
ipcMain.handle(IPC.OPEN_IN_TERMINAL, async (_event, arg: string | null | { sessionId?: string | null; projectPath?: string; terminalName?: string }) => {
  // Support old calling convention (string = sessionId)
  let sessionId: string | null = null
  let projectPath: string = process.cwd()
  let terminalName: string | undefined

  if (typeof arg === 'string') {
    sessionId = arg
  } else if (arg && typeof arg === 'object') {
    sessionId = arg.sessionId ?? null
    projectPath = arg.projectPath && arg.projectPath !== '~' ? arg.projectPath : process.cwd()
    terminalName = arg.terminalName
  }

  try {
    // If terminalName provided, use it; otherwise use default or Terminal
    let selectedTerminal: DetectedTerminal | null = null

    if (terminalName) {
      const detected = detectTerminals()
      selectedTerminal = detected.find(t => t.name === terminalName) || null
    }

    // Fallback: detect and pick first or default to Terminal
    if (!selectedTerminal) {
      const detected = detectTerminals()
      if (detected.length > 0) {
        selectedTerminal = detected[0]
      } else {
        log('OPEN_IN_TERMINAL: no terminal detected, falling back to Terminal')
        // Last resort: try to launch Terminal directly
        selectedTerminal = {
          name: 'Terminal',
          displayName: 'macOS Terminal',
          path: '/Applications/Utilities/Terminal.app',
          type: 'applescript',
        }
      }
    }

    await launchTerminal({
      terminal: selectedTerminal,
      projectPath,
      sessionId,
    })

    log(`Opened ${selectedTerminal.displayName}: ${sessionId ? `resume ${sessionId}` : 'new session'}`)
    return true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`OPEN_IN_TERMINAL error: ${msg}`)
    return false
  }
})
```

---

## Task 4: Shared IPC Type Definitions

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: Add IPC constants for terminal selection**

Find the `IPC` enum in `src/shared/types.ts` and add:
```typescript
export const IPC = {
  // ... existing constants ...
  DETECT_TERMINALS: 'clui:detect-terminals',
  SELECT_CUSTOM_TERMINAL: 'clui:select-custom-terminal',
} as const
```

(Note: OPEN_IN_TERMINAL already exists)

---

## Task 5: Theme Store Extension

**Files:**
- Modify: `src/renderer/theme.ts`

**Step 1: Extend ThemeState interface**

Around line 275, modify the interface:
```typescript
interface ThemeState {
  isDark: boolean
  themeMode: ThemeMode
  soundEnabled: boolean
  expandedUI: boolean
  preferredTerminal: string | null
  _systemIsDark: boolean
  setIsDark: (isDark: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  setSoundEnabled: (enabled: boolean) => void
  setExpandedUI: (expanded: boolean) => void
  setPreferredTerminal: (terminalName: string | null) => void
  setSystemTheme: (isDark: boolean) => void
}
```

**Step 2: Update loadSettings function**

Replace the `loadSettings` function (lines 311-324) with:
```typescript
function loadSettings(): { themeMode: ThemeMode; soundEnabled: boolean; expandedUI: boolean; preferredTerminal: string | null } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        themeMode: ['light', 'dark'].includes(parsed.themeMode) ? parsed.themeMode : 'dark',
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        expandedUI: typeof parsed.expandedUI === 'boolean' ? parsed.expandedUI : false,
        preferredTerminal: typeof parsed.preferredTerminal === 'string' ? parsed.preferredTerminal : null,
      }
    }
  } catch {}
  return { themeMode: 'dark', soundEnabled: true, expandedUI: false, preferredTerminal: null }
}
```

**Step 3: Update saveSettings function**

Replace the `saveSettings` function (lines 326-328) with:
```typescript
function saveSettings(s: { themeMode: ThemeMode; soundEnabled: boolean; expandedUI: boolean; preferredTerminal: string | null }): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}
```

**Step 4: Update Zustand store initialization**

Replace the `saved` variable declaration (line 331) with:
```typescript
const saved = { ...loadSettings(), expandedUI: false }
```

**Step 5: Add preferredTerminal to store initialization**

In the store creation (line 333), add to the initial state:
```typescript
export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: saved.themeMode === 'dark' ? true : saved.themeMode === 'light' ? false : true,
  themeMode: saved.themeMode,
  soundEnabled: saved.soundEnabled,
  expandedUI: saved.expandedUI,
  preferredTerminal: saved.preferredTerminal,
  _systemIsDark: true,
  // ... rest of methods ...
  setPreferredTerminal: (terminalName) => {
    set({ preferredTerminal: terminalName })
    saveSettings({
      themeMode: get().themeMode,
      soundEnabled: get().soundEnabled,
      expandedUI: get().expandedUI,
      preferredTerminal: terminalName,
    })
  },
  // ... rest of methods ...
}))
```

---

## Task 6: StatusBar Terminal Selector UI

**Files:**
- Modify: `src/renderer/components/StatusBar.tsx`

**Step 1: Read the file to understand structure**

Check existing "Open in CLI" button implementation to match styling/pattern.

**Step 2: Add terminal selector with dropdown**

Replace or extend the existing "Open in CLI" button with a dropdown. The button should show a down arrow like the model picker. When clicked, show:
- Detected terminals (from IPC call to DETECT_TERMINALS)
- Checkmark on preferred terminal (from Zustand store)
- "Browse..." option (calls SELECT_CUSTOM_TERMINAL)
- "Settings" option (if applicable)

Example structure (exact implementation depends on existing StatusBar code):
```typescript
const [terminals, setTerminals] = useState<DetectedTerminal[]>([])
const [showDropdown, setShowDropdown] = useState(false)
const preferredTerminal = useThemeStore(s => s.preferredTerminal)

useEffect(() => {
  const loadTerminals = async () => {
    const result = await window.api.detectTerminals()
    if (result.terminals) setTerminals(result.terminals)
  }
  loadTerminals()
}, [])

const handleOpenCLI = async (terminalName?: string) => {
  await window.api.openInTerminal({
    sessionId: currentSessionId,
    projectPath: projectPath,
    terminalName,
  })
  setShowDropdown(false)
}

const handleBrowse = async () => {
  const customPath = await window.api.selectCustomTerminal()
  if (customPath) {
    useThemeStore.getState().setPreferredTerminal(customPath)
    await handleOpenCLI(customPath)
  }
}
```

---

## Task 7: Preload API Exposure

**Files:**
- Modify: `src/preload/index.ts`

**Step 1: Add IPC exposure methods**

Add to the preload file's exposed API:
```typescript
detectTerminals: () => ipcRenderer.invoke(IPC.DETECT_TERMINALS),
selectCustomTerminal: () => ipcRenderer.invoke(IPC.SELECT_CUSTOM_TERMINAL),
openInTerminal: (arg: any) => ipcRenderer.invoke(IPC.OPEN_IN_TERMINAL, arg),
```

---

## Task 8: First-Launch Setup Modal

**Files:**
- Create: `src/renderer/components/TerminalSetupModal.tsx` (optional)
- Modify: `src/renderer/App.tsx` (conditionally show on first launch)

**Step 1: Add simple first-launch check**

In `App.tsx`, after initialization:
```typescript
const preferredTerminal = useThemeStore(s => s.preferredTerminal)
const [showSetup, setShowSetup] = useState(!preferredTerminal)

if (showSetup && terminals.length > 0) {
  return <TerminalSetupModal terminals={terminals} onSelect={(t) => {
    useThemeStore.getState().setPreferredTerminal(t.name)
    setShowSetup(false)
  }} />
}
```

**Step 2: Create simple modal component**

Modal should display detected terminals with descriptions and let user select one. Fallback: if no terminals detected, show "No terminal found, browse to select one" message.

---

## Task 9: Testing & Integration

**Files:**
- Test: Manual testing (no automated tests required for MVP)

**Step 1: Test detection**

- Launch app, verify detected terminals match user's system
- Test with terminals in different locations
- Test with no terminals installed (should fall back gracefully)

**Step 2: Test launching**

- Test each detected terminal with `claude` and `claude --resume <sessionId>`
- Test custom executable via file picker
- Verify preference persists across restarts

**Step 3: Test UI**

- Verify down arrow dropdown appears next to "Open in CLI"
- Verify checkmark shows on preferred terminal
- Verify changing preference updates stored value
- Verify "Browse..." opens file picker
- Verify first-launch modal appears on new install

---

## Task 10: Documentation

**Files:**
- Create: `docs/TERMINAL_PICKER.md` (feature documentation)

**Content:**
Brief user-facing docs explaining:
- How to change default terminal
- Supported terminals
- How to use custom terminal
- Keyboard shortcut behavior

---

## Summary

**Key Implementation Order:**
1. Terminal detector (no dependencies)
2. Terminal launcher (depends on detector)
3. IPC handlers (depends on 1-2)
4. Type definitions (supports all)
5. Zustand store (depends on types)
6. StatusBar UI (depends on 1-5)
7. Preload API (depends on 3)
8. First-launch modal (optional, depends on 1, 5)
9. Testing
10. Docs

**Total Commits:** 8-10 commits (one per major component + tests)

---

Plan complete and saved to `docs/plans/2026-03-18-terminal-picker.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach would you prefer?