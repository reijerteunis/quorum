# v1 is a local web app; desktop shell is a later wrapper — 2026-08-06
**Decision:** Ship v1 as a local daemon + browser UI launched with one command (`npx`-style). Architect the UI so it can be wrapped in a desktop shell (Tauri) in a later release without rewrite.
**Alternatives considered:** Desktop-first (Tauri/Electron) — nicer long-term (tray, notifications) but higher install friction for an open-source launch and no capability the local daemon lacks.
**Why:** The app's core needs (spawn CLIs, read project folders, long-running processes) are served equally by a local server; zero-install `npx` maximizes open-source adoption.
