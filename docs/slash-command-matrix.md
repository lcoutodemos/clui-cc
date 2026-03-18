# Slash Command Capability Matrix

CLI Version: 2.1.63 | Date: 2026-03-08
Test session: 450d2d0f-4b03-4761-8ecd-8d179998127d

## App-Level Slash Commands

These commands are intercepted by the CLUI app before reaching the CLI. Defined in `src/renderer/components/SlashCommandMenu.tsx`.

| Command | Description | Behavior |
|---------|-------------|----------|
| `/clear` | Clear conversation history | Resets the active tab's message list |
| `/compare` | Compare two models side-by-side | Opens ComparisonLauncher for multi-model comparison |
| `/workflow` | Open workflow manager | Opens WorkflowManager for step-by-step prompt chains |
| `/focus` | Set the current work focus | Inserted as prompt text (agent memory) |
| `/claim` | Claim a work item by key | Inserted as prompt text (agent memory) |
| `/done` | Mark the current work as done | Inserted as prompt text (agent memory) |
| `/release` | Release the current claim | Inserted as prompt text (agent memory) |
| `/memory` | Show active and recent shared work | Displays agent memory snapshot |
| `/export` | Export session to Markdown or JSON | Opens ExportDialog |
| `/cost` | Show token usage and cost | Opens CostDashboard |
| `/model` | Show current model info | Displays session model metadata |
| `/mcp` | Show MCP server status | Displays connected MCP servers |
| `/skills` | Show available skills | Lists installed and available skills |
| `/help` | Show available commands | Lists all slash commands |

Commands marked as `insertOnly` (focus, claim, done, release) are inserted into the input bar as prompt prefixes rather than executed directly.

## CLI Slash Commands (Passthrough)

The following section documents commands that are passed through to the Claude Code CLI and their behavior in stream-json mode.

### Protocol Finding

`--input-format stream-json` is **completely broken** in CLI 2.1.63 (hangs forever, 0 events).
The only working mode is one-shot `claude -p` with stdin closed + `--resume` for multi-turn.

## Command Matrix

| Command | Fresh | With Session | Events | Result Preview | Verdict |
|---------|-------|-------------|--------|---------------|---------|
| `/help` | ✅ | ✅ | system/init, result/success | Unknown skill: help | **works_native** |
| `/model` | ✅ | ✅ | system/init, result/success | Unknown skill: model | **works_native** |
| `/mcp` | ✅ | ✅ | system/init, result/success | Unknown skill: mcp | **works_native** |
| `/status` | ✅ | ✅ | system/init, result/success | Unknown skill: status | **works_native** |
| `/clear` | ✅ | ✅ | system/init, result/success | Unknown skill: clear | **works_native** |
| `/compact` | ✅ | ✅ | system/status, rate_limit_event, system/init, system/compact_boundary, user, result/success |  | **unsupported** |
| `/doctor` | ✅ | ✅ | system/init, result/success | Unknown skill: doctor | **works_native** |
| `/permissions` | ✅ | ✅ | system/init, result/success | Unknown skill: permissions | **works_native** |
| `/cost` | ✅ | ✅ | system/init, assistant, result/success | You are currently using your subscription to power | **passthrough_to_model** |

## Verdict Key

- **works_native**: CLI intercepts the command and returns structured output (no model call)
- **passthrough_to_model**: CLI sends it to the model as a regular prompt (model responds)
- **silent_exit**: CLI handles it internally but produces no result event in stream-json
- **unsupported**: Command not recognized or errors out

## Detailed Results

### `/help`
- Verdict: **works_native**
- Exit code: 0
- Events: system/init → result/success
- Is error: false
- Result text:
```
Unknown skill: help
```

### `/model`
- Verdict: **works_native**
- Exit code: 0
- Events: system/init → result/success
- Is error: false
- Result text:
```
Unknown skill: model
```

### `/mcp`
- Verdict: **works_native**
- Exit code: 0
- Events: system/init → result/success
- Is error: false
- Result text:
```
Unknown skill: mcp
```

### `/status`
- Verdict: **works_native**
- Exit code: 0
- Events: system/init → result/success
- Is error: false
- Result text:
```
Unknown skill: status
```

### `/clear`
- Verdict: **works_native**
- Exit code: 0
- Events: system/init → result/success
- Is error: false
- Result text:
```
Unknown skill: clear
```

### `/compact`
- Verdict: **unsupported**
- Exit code: 0
- Events: system/status → rate_limit_event → system/status → system/init → system/compact_boundary → user → user → result/success
- Is error: false
- Result text:
```
(empty)
```

### `/doctor`
- Verdict: **works_native**
- Exit code: 0
- Events: system/init → result/success
- Is error: false
- Result text:
```
Unknown skill: doctor
```

### `/permissions`
- Verdict: **works_native**
- Exit code: 0
- Events: system/init → result/success
- Is error: false
- Result text:
```
Unknown skill: permissions
```

### `/cost`
- Verdict: **passthrough_to_model**
- Exit code: 0
- Events: system/init → assistant → result/success
- Is error: false
- Result text:
```
You are currently using your subscription to power your Claude Code usage
```
