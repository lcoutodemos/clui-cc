#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   GITHUB_TOKEN=... scripts/create-windows-issues.sh [owner/repo]
# Example:
#   GITHUB_TOKEN=... scripts/create-windows-issues.sh lcoutodemos/clui-cc

REPO="${1:-lcoutodemos/clui-cc}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

if [ -z "$TOKEN" ]; then
  echo "Missing GITHUB_TOKEN or GH_TOKEN"
  exit 1
fi

create_issue() {
  local title="$1"
  local body="$2"

  payload=$(jq -n --arg title "$title" --arg body "$body" '{title: $title, body: $body}')

  curl -sS -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$REPO/issues" \
    -d "$payload" | jq -r '.html_url // ("ERROR: " + (.message // "unknown"))'
}

create_issue \
  "Windows: Harden overlay/window semantics and add fallback mode" \
  $'## Why this matters\nThe current overlay model was tuned primarily for macOS. On Windows, transparency, click-through, and focus behavior vary with compositor/GPU/policies.\n\n## What to do\n- Define a Windows behavior matrix for transparent/always-on-top/click-through.\n- Add fallback non-transparent mode when required.\n- Auto-detect problematic runtime combinations and switch safely.\n\n## Acceptance criteria\n- Overlay remains usable on Win10/Win11 in default and fallback modes.\n- No invisible window/input-lock regressions after repeated toggles.\n\n## Validation\n- 500-toggle soak test.\n- Multi-monitor + DPI + taskbar auto-hide checks.'

create_issue \
  "Windows: Add configurable global shortcut with conflict recovery" \
  $'## Why this matters\nCtrl+Space often conflicts with IMEs and desktop tools.\n\n## What to do\n- Add configurable global shortcut in settings.\n- Detect registration failure and guide fallback selection.\n- Persist chosen shortcut across restarts.\n\n## Acceptance criteria\n- User can recover from shortcut conflicts in-app.\n- Selected shortcut is restored on next launch.\n\n## Validation\n- Conflict tests with IME/non-US keyboard layouts.'

create_issue \
  "Windows: Stabilize native dependency/PTY reliability" \
  $'## Why this matters\nNative module compatibility is a frequent install/build failure source on Windows.\n\n## What to do\n- Audit native dependency code paths and fallbacks.\n- Validate prebuilt binaries against supported Node/Electron ABI matrix.\n- Improve tooling guidance for Visual Studio Build Tools fallback.\n\n## Acceptance criteria\n- Fresh installs work on clean Win10/Win11 VMs.\n- Rebuild-required scenarios produce actionable, deterministic errors.\n\n## Validation\n- Repeatable VM snapshot install matrix.'

create_issue \
  "Windows: Improve terminal launch compatibility (cmd/PowerShell/WT)" \
  $'## Why this matters\nCurrent cmd launch is baseline; users commonly use PowerShell/Windows Terminal.\n\n## What to do\n- Add terminal provider selection.\n- Harden command quoting for spaces/unicode/special chars.\n- Verify session resume parity across providers.\n\n## Acceptance criteria\n- Open-in-terminal works for complex paths.\n- Resume command works for all supported terminal targets.\n\n## Validation\n- Table-driven command construction tests + manual integration checks.'

create_issue \
  "Windows: Validate Claude session path encoding parity" \
  $'## Why this matters\nSession listing/loading must exactly match Claude CLI project key encoding.\n\n## What to do\n- Confirm encoding with real Windows-generated session folders.\n- Add tests for drive letters, UNC paths, mixed separators, symlinks.\n- Add migration handling if encoding changes.\n\n## Acceptance criteria\n- LIST_SESSIONS/LOAD_SESSION match expected sessions in all tested path variants.\n\n## Validation\n- Golden fixtures + end-to-end session resume checks.'

create_issue \
  "Windows: Make screenshot/attachment flow reliable and explicit" \
  $'## Why this matters\nCurrent screenshot path may not meet user expectations or policy constraints.\n\n## What to do\n- Decide UX (fullscreen capture vs region select).\n- Add explicit failure messages for blocked capture scenarios.\n- Ensure temp-file cleanup on all error/cancel paths.\n\n## Acceptance criteria\n- Screenshot behavior is predictable and documented.\n- No stale temp files after repeated failures.\n\n## Validation\n- Restricted-policy and stress tests.'

create_issue \
  "Windows: Polish tray + app lifecycle behavior" \
  $'## Why this matters\nWindows lifecycle expectations differ from macOS accessory app behavior.\n\n## What to do\n- Provide explicit close-to-tray vs quit behavior setting.\n- Validate startup/restart/explorer-restart behavior.\n- Verify tray icon quality at high DPI scales.\n\n## Acceptance criteria\n- Lifecycle behavior is predictable and user-configurable.\n\n## Validation\n- Manual scenario matrix: close button, task manager kill, explorer restart, login startup.'

create_issue \
  "Windows: Productionize installer/distribution + signing" \
  $'## Why this matters\nGA-level support requires stable installers, signing, and upgrade paths.\n\n## What to do\n- Define explicit Windows targets (NSIS/portable).\n- Configure signing/timestamping and CI secret handling.\n- Publish checksums and artifact metadata.\n\n## Acceptance criteria\n- CI produces installable signed artifacts for tagged releases.\n- Upgrade/uninstall flows are validated.\n\n## Validation\n- Clean VM install/upgrade/uninstall matrix.'

create_issue \
  "Windows: Expand doctor/preflight for Windows prerequisites" \
  $'## Why this matters\nOnboarding still contains macOS-centric assumptions in practice.\n\n## What to do\n- Add Windows-first guidance for PATH, Python, build tools, permissions.\n- Improve diagnostics with actionable PowerShell snippets.\n- Detect unsupported shells/environments with alternatives.\n\n## Acceptance criteria\n- New Windows users can self-remediate using doctor output alone.\n\n## Validation\n- Runbook test by a non-maintainer.'

create_issue \
  "Windows: Add diagnostics/support-bundle observability" \
  $'## Why this matters\nWindows-specific regressions need reproducible diagnostics.\n\n## What to do\n- Add structured logs around shortcuts/window/screenshot/terminal flows.\n- Add one-command support-bundle export.\n- Define readiness metrics for startup and critical action success rates.\n\n## Acceptance criteria\n- Reported bugs include sufficient data for triage without back-and-forth.\n\n## Validation\n- Chaos tests for PATH/CLI failure, denied permissions, forced restarts.'

create_issue \
  "CI: Add Windows build + smoke-test release gates" \
  $'## Why this matters\nWithout CI gates, Windows regressions can reappear silently.\n\n## What to do\n- Add GitHub Actions Windows build job.\n- Add launch/toggle/basic IPC smoke tests.\n- Gate release tags on Windows workflow success.\n\n## Acceptance criteria\n- Platform-sensitive changes are automatically verified on Windows.\n\n## Validation\n- Intentionally broken branch fails the Windows gate.'

create_issue \
  "Docs: Publish Windows GA support policy and runbook" \
  $'## Why this matters\nGA requires clear support boundaries and known limitations.\n\n## What to do\n- Publish supported Windows versions/builds and known incompatibilities.\n- Add Windows quickstart/troubleshooting docs.\n- Define beta-exit checklist with owners.\n\n## Acceptance criteria\n- First-time Windows setup succeeds using docs only.\n\n## Validation\n- External tester follows docs and completes first session successfully.'
