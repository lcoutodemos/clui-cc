# Contributing to Clui CC

Thanks for your interest in contributing! Clui CC is a desktop overlay for Claude Code, and we welcome bug reports, feature ideas, and pull requests.

## Getting Started

1. Make sure you have the [prerequisites](README.md#prerequisites) installed (macOS, Xcode CLT, Node.js 18+, Claude Code CLI 2.1+)
2. Fork and clone the repo:
   ```bash
   git clone https://github.com/<your-username>/clui-cc.git
   cd clui-cc
   ```
3. Check your environment (optional but recommended):
   ```bash
   npm run doctor
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
7. Verify your changes build cleanly:
   ```bash
   npm run build
   ```

## Development Tips

- **Main process** changes (`src/main/`) require a full restart (`Ctrl+C` then `npm run dev`).
- **Renderer** changes (`src/renderer/`) hot-reload automatically.
- Set `CLUI_DEBUG=1` to enable verbose main-process logging to `~/.clui-debug.log`.
- The app creates a transparent, click-through window. Use `⌥ + Space` to toggle visibility (fallback: `Cmd+Shift+K`).

## Code Style

- TypeScript strict mode is enforced.
- Use `useColors()` hook for all color references — never hardcode color values.
- Zustand selectors should be narrow and use custom equality functions for performance.
- Prefer editing existing files over creating new ones.

## Pull Requests

1. Create a feature branch from `main`.
2. Keep PRs focused — one concern per PR.
3. Include a brief description of what changed and why.
4. Ensure `npm run build` passes with zero errors.

## Reporting Bugs

Open an issue with:
- macOS version
- Node.js version (`node --version`)
- Claude Code CLI version (`claude --version`)
- Steps to reproduce
- Expected vs. actual behavior

## Security

If you discover a security vulnerability, please report it privately. See [SECURITY.md](SECURITY.md).
