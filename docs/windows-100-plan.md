# Windows 100% Readiness Plan (Clui CC)

This document breaks down the remaining work to move from the current **Windows beta compatibility pass** to **production-grade Windows support**.

## Scope and success definition

"100% on Windows" here means:

- The app installs/runs cleanly on Windows 10/11 without manual patching.
- Core workflows (toggle overlay, prompt execution, permissions, sessions, attachments, marketplace) are reliable.
- Behavior is validated across multi-monitor, DPI scaling, and common policy/security environments.
- CI produces signed/reproducible Windows artifacts with repeatable smoke tests.

---

## Issue 1 — Overlay/window semantics hardening on Windows

**Why this matters**
- The app currently relies on transparent, always-on-top behavior originally tuned for macOS panels.
- Windows has different compositor and focus behavior; the final UX can vary by GPU/driver and desktop config.

**What to do**
- Define a Windows-specific window policy matrix for `transparent`, `alwaysOnTop`, focus, click-through, and `skipTaskbar`.
- Add fallback mode when transparency/click-through fails (opaque shell with identical functionality).
- Add runtime diagnostics to detect problematic combinations and auto-select safe mode.

**Acceptance criteria**
- Overlay is usable on Win10 and Win11 in default and fallback modes.
- No input-lock or invisible-window scenarios after repeated show/hide cycles.

**Validation**
- 500-toggle soak test + manual focus test across Chrome/VSCode/Terminal foreground apps.
- Multi-monitor and taskbar auto-hide scenarios pass.

---

## Issue 2 — Global shortcut conflict and recovery strategy

**Why this matters**
- `Ctrl+Space` can conflict with IMEs, PowerToys, and language input switchers.

**What to do**
- Implement user-configurable global hotkey in settings.
- Add startup detection for registration failure and present guided fallback selection.
- Persist chosen shortcut and auto-retry on restart.

**Acceptance criteria**
- If default shortcut fails, user can recover in-app without editing files.
- Chosen shortcut is restored across launches.

**Validation**
- Conflict simulation with common apps/utilities and non-US keyboard layouts.

---

## Issue 3 — PTY/native dependency reliability on Windows

**Why this matters**
- Native dependencies (especially `node-pty`) are the highest install/build risk on Windows.

**What to do**
- Audit all code paths requiring native binaries and define fallback behavior.
- Ensure prebuilt binary compatibility with supported Node/Electron ABI matrix.
- Add explicit guidance + preflight checks for Visual Studio Build Tools when rebuild is required.

**Acceptance criteria**
- Fresh install works on a clean machine with standard prerequisites.
- If native rebuild is needed, errors are actionable and deterministic.

**Validation**
- Test on clean VM snapshots for Win10 and Win11.

---

## Issue 4 — Terminal launching and shell compatibility

**Why this matters**
- `cmd.exe` launch works for baseline but many users rely on PowerShell/Windows Terminal profiles.

**What to do**
- Add terminal provider selection (cmd / PowerShell / Windows Terminal if available).
- Ensure `projectPath` quoting handles spaces, unicode, and special chars.
- Ensure resume command works identically across shell choices.

**Acceptance criteria**
- Open-in-terminal works with paths containing spaces and non-ASCII chars.
- Session resume command succeeds for all supported terminal providers.

**Validation**
- Table-driven tests for command construction + manual integration checks.

---

## Issue 5 — Session file path encoding parity with Claude CLI on Windows

**Why this matters**
- Session listing/loading depends on matching Claude’s project path encoding.

**What to do**
- Confirm encoding algorithm against real Windows Claude session directories.
- Add unit tests for path cases: drive letters, UNC paths, mixed separators, symlinked dirs.
- Add migration handling if encoding logic changes.

**Acceptance criteria**
- `LIST_SESSIONS` and `LOAD_SESSION` find all expected sessions for tested path variants.

**Validation**
- Golden fixture tests + end-to-end checks with real generated sessions.

---

## Issue 6 — Screenshot and attachment flow reliability

**Why this matters**
- Current Windows screenshot path is non-interactive and may not match user expectations vs snipping UX.

**What to do**
- Decide product behavior: full-screen capture vs user region-select workflow.
- Add robust error messaging when capture is blocked by policy/permissions.
- Verify temp-file lifecycle and cleanup on cancellation/error.

**Acceptance criteria**
- Screenshot action is predictable and documented.
- No stale temp files or silent failures.

**Validation**
- Permission-restricted environment checks and repeated capture stress test.

---

## Issue 7 — Tray icon/menu and process lifecycle polish

**Why this matters**
- Tray behavior differs significantly from macOS dock/accessory model.

**What to do**
- Review minimize/close semantics to match Windows user expectations.
- Add explicit “Quit” vs “Close to tray” behavior setting.
- Validate icon rendering quality at multiple DPI scales.

**Acceptance criteria**
- Lifecycle behavior is unambiguous and consistent across restart/login cycles.

**Validation**
- Manual scenarios: close button, task manager kill, startup with Windows, explorer restart.

---

## Issue 8 — Installer/distribution pipeline for Windows artifacts

**Why this matters**
- Production support requires stable installers and signed binaries.

**What to do**
- Configure `electron-builder` Windows targets (`nsis` and/or portable) explicitly.
- Add code-signing plan (cert storage, CI secrets, timestamping, SmartScreen mitigation).
- Publish checksums + artifact metadata for reproducibility.

**Acceptance criteria**
- CI produces installable Windows artifacts from tagged releases.
- Installer upgrade path from previous version is verified.

**Validation**
- Install/upgrade/uninstall matrix in clean VMs.

---

## Issue 9 — Doctor/preflight UX for Windows-specific prerequisites

**Why this matters**
- Existing doctor checks are partly portable but still biased toward macOS messaging.

**What to do**
- Add explicit Windows guidance for Python/toolchain/permissions/common PATH issues.
- Include actionable PowerShell snippets in diagnostics output.
- Surface unsupported shells/environments with clear alternatives.

**Acceptance criteria**
- New Windows users can resolve setup issues by following doctor output only.

**Validation**
- Runbook trial by a tester with no project context.

---

## Issue 10 — Reliability/observability baseline for Windows

**Why this matters**
- “Works once” is insufficient; we need crash/freeze diagnostics for Windows-specific failures.

**What to do**
- Add structured logs around window visibility, shortcut registration, screenshot flow, and terminal launch.
- Include a support bundle command to collect diagnostics safely.
- Define SLO-style targets for startup success and feature completion rates.

**Acceptance criteria**
- Reproducible bug reports include all required diagnostics in one export.

**Validation**
- Chaos testing: kill/restart flows, unavailable CLI, invalid PATH, denied permissions.

---

## Issue 11 — Automated Windows CI and smoke-test gates

**Why this matters**
- Without Windows CI, regressions will reappear silently.

**What to do**
- Add GitHub Actions Windows job for build + smoke tests.
- Add Playwright or Electron-level smoke checks for launch/toggle/basic IPC.
- Gate release tagging on Windows job success.

**Acceptance criteria**
- PRs touching main-process/platform code run Windows checks automatically.

**Validation**
- Intentional regression branch should fail Windows gate.

---

## Issue 12 — Documentation and support policy for Windows GA

**Why this matters**
- Product confidence depends on clear guarantees and known limitations.

**What to do**
- Publish a Windows support policy (supported OS builds, known incompatibilities).
- Add Windows-specific quickstart and troubleshooting page.
- Define "beta" exit checklist and owner for each criterion.

**Acceptance criteria**
- Docs allow a first-time Windows user to install and run with no tribal knowledge.

**Validation**
- External tester follows docs only; completes first successful session.

---

## GitHub issues template payloads

Use these titles when creating issues:

1. `Windows: Harden overlay/window semantics and add fallback mode`
2. `Windows: Add configurable global shortcut with conflict recovery`
3. `Windows: Stabilize native dependency/PTY reliability`
4. `Windows: Improve terminal launch compatibility (cmd/PowerShell/WT)`
5. `Windows: Validate Claude session path encoding parity`
6. `Windows: Make screenshot/attachment flow reliable and explicit`
7. `Windows: Polish tray + app lifecycle behavior`
8. `Windows: Productionize installer/distribution + signing`
9. `Windows: Expand doctor/preflight for Windows prerequisites`
10. `Windows: Add diagnostics/support-bundle observability`
11. `CI: Add Windows build + smoke-test release gates`
12. `Docs: Publish Windows GA support policy and runbook`

For each issue body, copy the matching section above (`Why this matters`, `What to do`, `Acceptance criteria`, `Validation`).
