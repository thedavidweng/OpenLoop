# OpenLoop Testing Guide

## Test Pyramid

```
        ┌─────────────┐
        │  E2E / Smoke │  ← Manual (desktop app constraint)
        ├─────────────┤
        │  Component   │  ← @testing-library/react + mocked store
        ├─────────────┤
        │  Unit /      │  ← Vitest, pure logic, fast feedback
        │  Contract    │
        └─────────────┘
```

| Layer | Count | Location | Run |
|-------|-------|----------|-----|
| Unit (frontend) | 232+ | `tests/unit/**/*.test.{ts,tsx}` | `pnpm test:run` |
| Contract (Rust) | 566 lines | `src-tauri/tests/cli_contract.rs` | `cargo test` |
| Component | included above | `tests/unit/*.test.tsx` | `pnpm test:run` |
| Coverage | — | `coverage/` | `pnpm test:coverage` |

## Automated Checks

Run before opening a PR or cutting a release candidate:

```bash
pnpm install --frozen-lockfile
pnpm release:check
```

This runs: typecheck → frontend tests → frontend build → rust fmt → rust check → rust test.

### Coverage

```bash
pnpm test:coverage
```

Generates reports in `coverage/` (lcov, text, json-summary). Minimum threshold: 20% line coverage (ramp target: 60%).

### CI Pipeline

Every push/PR runs:
1. Frontend: install → audit → typecheck → test with coverage → build
2. Rust format check
3. Rust: compile check → audit → test
4. Validate gate: all three must pass

---

## Manual QA Checklist

Check items relevant to the change. Sign off at the bottom.

### Startup and Setup

- [ ] Fresh app launch opens the setup wizard
- [ ] Existing install opens the main app shell
- [ ] Device check shows architecture, memory, and recommended profile
- [ ] Settings can reopen setup after completion

### Backend

- [ ] Backend status can be refreshed from Settings
- [ ] Start backend reports a healthy state or an actionable error
- [ ] Restart backend is available after backend-impacting setting changes
- [ ] Open logs reveals the current log file path

### Generation

- [ ] Empty prompt + lyrics are blocked inline
- [ ] Browser-only preview mode still supports mock generation
- [ ] Tauri runtime sends progress events and finishes with a persisted record
- [ ] Failed generation exposes error details and supports copy-error
- [ ] Cancelled generation returns form to editable state

### History and Files

- [ ] Generated items appear in the history sidebar
- [ ] Search filters by prompt or lyrics text
- [ ] Selecting a history row updates the preview panel
- [ ] Existing audio renders in the built-in audio player
- [ ] Reveal in Finder works for the selected output file
- [ ] Export copy writes to the requested destination
- [ ] Delete file and record removes both the file and the persisted row
- [ ] Clear history asks for confirmation, removes generated audio files, and leaves the sidebar empty
- [ ] Cancelled generations are not saved to history; failed generations are recorded for debugging

### Packaged App Smoke Test

- [ ] `pnpm release:build` creates a `.dmg` under `src-tauri/target/release/bundle/dmg/` on Apple Silicon
- [ ] The installed app launches outside `pnpm tauri dev`
- [ ] The bundled `uv` sidecar is present and executable
- [ ] First-run setup can complete from a fresh app data directory
- [ ] Backend logs rotate automatically (keeps last 20 log files)

### CLI

- [ ] `openloop run` generates music headlessly and saves to disk
- [ ] `openloop setup` interactive wizard works in a terminal
- [ ] `openloop setup model turbo` sets key-value immediately
- [ ] `openloop list --json` outputs valid JSON
- [ ] `openloop models` shows all three variants with download status
- [ ] `openloop ps` shows backend health and active tasks
- [ ] `openloop delete <id>` removes record and file
- [ ] `openloop clear --yes` removes all records and files
- [ ] `openloop stop` cancels an ongoing generation. Use `openloop backend stop` to stop the backend process

### Privacy

- [ ] Prompts, lyrics, and outputs stay local
- [ ] No telemetry is emitted
- [ ] User-facing logs and status surfaces avoid dumping full lyrics by default

---

## Regression Triggers

Re-run specific test categories after these changes:

| Change area | Re-test |
|-------------|---------|
| Form validation logic | `validation.test.ts`, `generation-panel.test.tsx` |
| Store slice changes | `store.test.ts`, `store-slices.test.ts` |
| Model pack/status logic | `model-packs.test.ts`, `model-bootstrap.test.ts` |
| History operations | `history-workflow.test.ts`, `history-sidebar.test.tsx` |
| Error handling | `errors.test.ts`, `error-help.test.ts` |
| Tauri IPC commands | Rust contract tests (`cargo test`) |
| UI component changes | Component test for that component + `generation-panel.test.tsx` |
| i18n / translations | `pnpm i18n:audit` + all tests (i18n mock may mask issues) |
| Release build | Full `pnpm release:check` + packaged app smoke test |

---

## Test Metrics

Captured per CI run:

| Metric | Source | Target |
|--------|--------|--------|
| Test count | Vitest reporter | Track growth |
| Test execution time | Vitest reporter | < 15s frontend |
| Line coverage | `pnpm test:coverage` | ≥ 20% (ramp to 60%) |
| Pass rate | CI | 100% |
| Rust test count | `cargo test` | Track growth |

---

## Release Sign-Off

Before tagging a release:

- [ ] `pnpm release:check` passes locally
- [ ] All CI checks green on the release branch
- [ ] Packaged app smoke test passes (see above)
- [ ] CLI smoke test passes (see above)
- [ ] No regressions in manual QA checklist items relevant to the release
- [ ] Coverage threshold met (`pnpm test:coverage`)

**Tested by:** _________________ **Date:** _________________
**Release:** v___.___.___ **Commit:** _________________

---

## Notes

- `pnpm tauri dev` is intentionally long-running. Automation timeouts after the Rust binary starts are not considered startup failures.
- v0.2 targets macOS Apple Silicon first. Intel support remains experimental.
- The full CLI test suite also validates the shared service layer used by the GUI.
