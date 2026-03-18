# Contributing to Clui CC

Thanks for your interest in contributing! Clui CC is a desktop overlay for Claude Code, and we welcome bug reports, feature ideas, and pull requests.

## Getting Started

1. Make sure you have the [prerequisites](README.md#prerequisites) installed:
   - **macOS 13+** or **Windows 10+**
   - Node.js 18+
   - Claude Code CLI 2.1+
   - macOS: Xcode Command Line Tools
   - Windows: Visual Studio Build Tools (for native modules)
2. Fork and clone the repo:
   ```bash
   git clone https://github.com/<your-username>/clui-cc-windows.git
   cd clui-cc-windows
   ```
3. Check your environment (optional but recommended):
   ```bash
   npm run doctor        # macOS
   npm run doctor:win    # Windows
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
   > If `npm install` fails, run `npm run doctor` to see which dependency is missing.
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Make your changes in `src/`
7. Verify your changes build and test cleanly:
   ```bash
   npm run build
   npm run test
   ```

## Development Tips

- **Main process** changes (`src/main/`) require a full restart (`Ctrl+C` then `npm run dev`).
- **Renderer** changes (`src/renderer/`) hot-reload automatically.
- Set `CLUI_DEBUG=1` to enable verbose main-process logging to `~/.clui-debug.log`.
- Toggle the overlay with `Alt+Space` (macOS) or `Ctrl+Space` (Windows).

## Code Style

- TypeScript strict mode is enforced.
- Use `useColors()` hook for all color references — never hardcode color values.
- Zustand selectors should be narrow and use custom equality functions for performance.
- Prefer editing existing files over creating new ones.

## Branch Workflow

1. Create a feature branch from `main` (e.g., `FEAT-XXX/short-description`).
2. Keep PRs focused — one concern per PR.
3. Include a brief description of what changed and why.
4. Ensure `npm run build` and `npm run test` pass with zero errors.
5. Push and create a PR. Enable auto-merge if CI is configured:
   ```bash
   git push -u origin FEAT-XXX/short-description
   gh pr create --title "FEAT-XXX: <title>" --body "Closes #N"
   gh pr merge <N> --auto --merge --delete-branch
   ```

## Reporting Bugs

Open an issue with:
- **OS version**: macOS version or Windows version (build number)
- Node.js version (`node --version`)
- Claude Code CLI version (`claude --version`)
- Steps to reproduce
- Expected vs. actual behavior

## Security

If you discover a security vulnerability, please report it privately. See [SECURITY.md](SECURITY.md).
