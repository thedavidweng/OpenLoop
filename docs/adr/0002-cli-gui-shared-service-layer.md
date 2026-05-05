# CLI and GUI Share Service Layer via Extracted AppState

## Status

Accepted

## Context

OpenLoop needs a CLI mode for agent integration in video production workflows. The current architecture couples the service layer (`AppState`, `BackendManager`, `Database`, `ModelManager`) to Tauri's `setup` closure in `lib.rs`. This makes it impossible to use the service layer without Tauri.

## Decision

Extract `AppState` initialization into a standalone module (`app_state.rs`) that both the Tauri GUI and the CLI binary can use independently. The CLI binary detects args at startup: if subcommand args are present, it runs CLI mode; otherwise, it launches the Tauri GUI.

CLI and GUI share all state: the same SQLite database, the same ACE-Step backend process (via health check on the configured port), the same settings, and the same generation history.

## Consequences

- **Positive**: Single binary, single source of truth. CLI tasks appear in GUI history. Settings changed via CLI affect GUI. No synchronization needed — they share the same SQLite file.
- **Positive**: Service layer becomes Tauri-independent, improving testability.
- **Negative**: The CLI binary still links Tauri dependencies (for the GUI path). This adds binary size but doesn't affect CLI startup time since Tauri code is only invoked when no CLI args are present.
- **Neutral**: Backend coordination via health check is simple but means the backend process outlives the CLI. This is the desired behavior — the CLI is a client, not a daemon.
