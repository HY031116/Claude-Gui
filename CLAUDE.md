# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
@AGENTS.md

## Project Overview

Claude Code GUI — an Electron desktop app that wraps the Claude Code CLI, providing a graphical interface with chat, terminal, file explorer, and settings management. The app spawns `claude` CLI via `node-pty` and communicates through stdin/stdout.

## Commands

```bash
# Development (Vite dev server only)
cd claude-code-gui && npm run dev

# Development (Vite + Electron together)
cd claude-code-gui && npm run electron:dev

# Build Electron main process only
cd claude-code-gui && npm run build:electron

# Build everything (renderer + electron) then run
cd claude-code-gui && npm run electron

# Full build (no electron launch)
cd claude-code-gui && npm run build

# Lint
cd claude-code-gui && npm run lint

# Package for distribution
cd claude-code-gui && npm run dist
```

Dev server runs on port 5185 (strict — will fail if port occupied).

## Architecture

### Two-Process Electron Model

**Main Process** (`electron/`): Node.js services exposed via IPC handlers. Compiles separately with `commonjs` module target to `dist-electron/`.

- `main.ts` — Window creation, IPC handler registration
- `cli-service.ts` — Core: spawns Claude CLI via `node-pty`, manages process lifecycle, builds CLI args from config, handles auth checks
- `preload.ts` — `contextBridge` API: `window.electronAPI` with typed methods for CLI, filesystem, settings, auth, and native config
- `file-service.ts` — Directory listing, file read/write via `fs/promises`
- `settings-service.ts` — GUI-specific settings persisted to Electron `userData/settings.json`
- `cli-config-service.ts` — Reads/writes `~/.claude/settings.json` (shared with VSCode Claude Code extension)

**Renderer Process** (`src/`): React 19 + Zustand SPA. Uses `@` path alias for `src/`.

- `App.tsx` — Shell: sidebar nav (chat/files/tools/settings), session lifecycle
- `stores/useAppStore.ts` — Zustand store: session state, messages, terminal lines, file explorer state, UI state
- `components/ChatPanel.tsx` — Accumulates CLI stdout into assistant messages, renders ANSI via `ansi-to-html`
- `components/TerminalPanel.tsx` — Raw terminal output with direct command input
- `components/SettingsPanel.tsx` — Model/permissions/effort selection, auth config, proxy settings, VSCode config sync toggle
- `components/FileExplorer.tsx` / `ToolCallView.tsx` — Sidebar panels

### IPC Communication Flow

```
Renderer (window.electronAPI)
  → preload.ts (contextBridge)
    → ipcRenderer.invoke('cli:start' | 'cli:send' | 'cli:stop' | ...)
      → main.ts ipcMain.handle
        → CliService / FileService / SettingsService / CliConfigService

Main → Renderer: BrowserWindow.webContents.send('cli:output', event)
```

### Dual Settings System

- **Native config** (`~/.claude/settings.json`): Shared with VSCode. Contains model, permissions, effortLevel, plugins.
- **GUI config** (`userData/settings.json`): GUI-private. Contains apiKey, authMode, apiBaseUrl, httpProxy, extraArgs.

SettingsPanel loads from both and saves to both. When `useNativeConfig` is enabled, model/permissions/effort sync to `~/.claude/settings.json`.

### Auth Modes

- `api-key`: Sets `ANTHROPIC_API_KEY` env var, skips official login check
- `official`: Checks `claude auth status` via `spawnSync`, requires prior `claude auth login`

### CLI Spawning

`CliService.start()` always passes `--bare` to skip interactive wizards. Additional args (`--model`, `--permission-mode`, `--tools`) are built from config. On Windows, uses ConPTY and `claude.exe` at `C:\Users\Administrator\.local\bin\claude.exe`. Messages sent with `\r\n` line endings for Windows PTY compatibility.

## Key Conventions

- UI text is in Chinese (zh-CN)
- Git commits use Chinese descriptions: `feat: "功能更新"`, `fix: "bug修复"`
- Follow first-principles thinking: decompose problems to basic facts before solving, avoid relying on convention alone
- No CSS modules — global CSS variables (`--bg-primary`, `--text-secondary`, `--border-color`, etc.) in `index.css`
- Terminal buffer capped at 500 lines in the store
