# OpenLoop Testing Guide

## Automated checks

Run these before opening a PR or cutting a release candidate.

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

## Manual QA checklist

### Startup and setup

- Fresh app launch opens the setup wizard.
- Existing install opens the main app shell.
- Device check shows architecture, memory, and recommended profile.
- Settings can reopen setup after completion.

### Backend

- Backend status can be refreshed from Settings.
- Start backend reports a healthy state or an actionable error.
- Restart backend is available after backend-impacting setting changes.
- Open logs reveals the current log file path.

### Generation

- Empty prompt + lyrics are blocked inline.
- Browser-only preview mode still supports mock generation.
- Tauri runtime sends progress events and finishes with a persisted record.
- Failed generation exposes error details and supports copy-error.
- Cancelled generation returns form to editable state.

### History and files

- Generated items appear in the history sidebar.
- Search filters by prompt or lyrics text.
- Selecting a history row updates the preview panel.
- Existing audio renders in the built-in audio player.
- Reveal in Finder works for the selected output file.
- Export copy writes to the requested destination.
- Delete file and record removes both the file and the persisted row.
- Clear history asks for confirmation, removes generated audio files, and leaves the sidebar empty.
- Cancelled generations are not saved to history; failed generations are recorded for debugging.

### Packaged app smoke test

- `pnpm release:build` creates a `.dmg` under `src-tauri/target/release/bundle/dmg/` on Apple Silicon.
- The installed app launches outside `pnpm tauri dev`.
- The bundled `uv` sidecar is present and executable.
- First-run setup can complete from a fresh app data directory.
- Backend logs rotate automatically (keeps last 20 log files).

### CLI

- `openloop run` generates music headlessly and saves to disk.
- `openloop setup` interactive wizard works in a terminal.
- `openloop setup model turbo` sets key-value immediately.
- `openloop list --json` outputs valid JSON.
- `openloop models` shows all three variants with download status.
- `openloop ps` shows backend health and active tasks.
- `openloop delete <id>` removes record and file.
- `openloop clear --yes` removes all records and files.
- `openloop stop` terminates the backend process.

### Privacy

- Prompts, lyrics, and outputs stay local.
- No telemetry is emitted.
- User-facing logs and status surfaces avoid dumping full lyrics by default.

## Notes

- `pnpm tauri dev` is intentionally long-running. Automation timeouts after the
  Rust binary starts are not considered startup failures.
- v0.1 targets macOS Apple Silicon first. Intel support remains experimental.
- The full CLI test suite also validates the shared service layer used by the GUI.
