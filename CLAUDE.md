# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/claude-code) when working on this project.

## Project Overview

MC Server Dashboard — a Node.js web application for monitoring system resources and managing a Minecraft server. It runs on port 25566 and provides real-time CPU/memory/disk/GPU/network stats, MC service start/stop control via NSSM (Windows) or PM2 (Linux/macOS), and an RCON console for sending commands to the MC server.

## Architecture

- **server.js** — Express backend, platform-agnostic. Handles JWT auth, system info (via `systeminformation`), RCON, and delegates service/process management to platform modules.
- **platform/** — Platform-specific modules auto-selected by `os.platform()`:
  - `windows.js` — Uses NSSM for service control, `sc query` for status, `taskkill` for process kill. Decodes GBK-encoded cmd.exe output.
  - `linux.js` — Uses PM2 (primary) with systemctl fallback for service control, `kill -9` for process kill.
  - `index.js` — Router that loads the correct module.
- **public/index.html** — Single-page frontend with inline CSS/JS. Uses Chart.js (CDN) for real-time graphs. Dark terminal theme, responsive layout.
- **config.json** — Runtime configuration (gitignored). Contains passwords, JWT secret, RCON settings, MC service name.

## Key Patterns

- All API endpoints (except `/api/login`) require JWT Bearer token auth.
- `config.json` is read once at startup — restart the service after changes.
- RCON password resolution: `config.rcon.password` takes priority, falls back to reading `server.properties`.
- On Windows, shell commands output GBK-encoded text — `platform/windows.js` handles decoding via `TextDecoder('gbk')`.
- NSSM commands may return non-zero exit codes even on success (e.g., starting an already-running service returns exit code 1) — the code ignores nssm errors and verifies state via `sc query`.
- System processes are filtered from the process list via a blacklist in each platform module.

## Common Commands

```bash
# Start locally
node server.js

# Restart Windows service (after code/config changes)
nssm restart MCDashboard

# Restart via PM2 (Linux/macOS)
pm2 restart mc-dashboard

# Install dependencies
pnpm install
```

## Configuration

Copy `config.example.json` to `config.json` before first run. The `mcServiceName` field must match:
- Windows: the NSSM service name (e.g., `"MC"`)
- Linux/macOS: the PM2 process name or systemd unit name

## Important Notes

- Never commit `config.json` — it contains secrets. Use `config.example.json` as template.
- The dashboard log file is at `dashboard.log` (also gitignored).
- Windows NSSM service installation script: `install-service.bat` (run as admin).
- Frontend is a single HTML file with no build step — edit `public/index.html` directly.
- Chart.js is loaded from CDN, no local copy.
