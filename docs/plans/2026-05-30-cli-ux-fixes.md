# CLI UX Fixes Plan

> Generated from smoke test on 2026-05-30. All issues discovered during headless CLI acceptance testing.

## P0 — `backend start` kills backend on exit

**Problem:** `BackendManager::Drop` calls `stop()`, so `openloop backend start` starts the backend then immediately kills it when the CLI process exits. Only `run` and `enhance` call `detach()`. This makes `backend start` useless for headless users who want to pre-warm the backend.

**Fix:** Add `backend.detach()` at the end of `execute_start()` in `src-tauri/src/cli/backend.rs`, same pattern as `run.rs:229-231`.

**Files:** `src-tauri/src/cli/backend.rs`

---

## P0 — `backend status` can't discover externally-running backends

**Problem:** A new `AppState` always initializes `BackendManager` with `status: Stopped`. The `status()` method only probes the health endpoint if the current status is already `Healthy`. So `openloop backend status` always reports "stopped" for backends started by a previous CLI invocation or the GUI — even when the backend is actually healthy on the port.

**Fix:** In `BackendManager::status()`, when `self.child` is `None` and `self.status` is `Stopped`, probe the configured port's health endpoint. If healthy, transition to `Healthy { port }` (attached ownership). This requires the port to be available — either pass it into `status()` or store it on `BackendManager`.

**Files:** `src-tauri/src/services/backend_manager.rs`

---

## P1 — Duplicate `completed` event in `--json` output

**Problem:** `openloop run --json` emits two `completed` events:
1. From `CliGenerationSink::emit_generation_event` (line 328-335 in `run.rs`) — path from the backend response
2. From the post-generation loop (line 202-206 in `run.rs`) — path after `--output` rename

Agents parsing NDJSON see two completions and may act on the first (pre-rename) path.

**Fix:** Suppress the `completed` event in `CliGenerationSink` when `--json` is active. Let the post-generation loop be the sole source of the final `completed` event (it has the correct renamed path).

**Files:** `src-tauri/src/cli/run.rs`

---

## P1 — Progress output messy in human mode

**Problem:** `CliGenerationSink` uses `eprint!("\r  Generating variation {v}/{t}…")` to overwrite progress in-place. In non-terminal contexts (piped output, CI logs), `\r` doesn't overwrite — lines accumulate. The "downloading" message also runs into the completion message without a newline.

**Fix:** Detect whether stderr is a TTY (`std::io::stderr().is_terminal()` via `std::io::IsTerminal`). In TTY mode, keep `\r` overwrites. In non-TTY mode, print each progress line with a newline. Add a newline before the completion message.

**Files:** `src-tauri/src/cli/run.rs`

---

## P1 — HTTP client timeout too short for cold-start generations

**Problem:** On 16GB M3, a cold-start generation (model loading + inference + VAE decode) can take ~70s. The `AceClient` HTTP request to `/query_result` timed out once, causing a generation failure even though the backend completed successfully. The retry succeeded because the backend was warm.

**Fix:** Audit the `AceClient` request timeout. Ensure the polling request timeout is at least 120s (or match the backend's generation timeout). Consider using a longer timeout for the initial connection vs. per-poll timeout.

**Files:** `src-tauri/src/services/ace_client.rs`

---

## P2 — `downloadedModels` setting out of sync with manifest

**Problem:** The model manifest (`openloop-ace-manifest.json`) correctly records turbo as installed, but `settings.downloaded_models` in the DB is empty. `openloop doctor` warns "no models downloaded" even though generation works fine. This happens when models are installed outside the `models download` CLI path (e.g., via the GUI or manual copy).

**Fix:** On `doctor` and `models list`, cross-check the manifest against the DB setting. If the manifest has entries that the DB doesn't, offer to sync (or auto-sync silently). Alternatively, always read from the manifest as the source of truth for download status.

**Files:** `src-tauri/src/cli/doctor.rs`, `src-tauri/src/cli/models.rs`, potentially `src-tauri/src/services/model_manager/`

---

## P2 — Human-readable enhance output missing newline before detach

**Problem:** After `openloop enhance` prints the enhanced prompt, the backend detach happens silently. No "Backend detached" or similar message. Users may not know the backend is still running.

**Fix:** Add a one-line note after detach in enhance: "Backend left running for subsequent commands." (only in human mode, not JSON).

**Files:** `src-tauri/src/cli/enhance.rs`

---

## Implementation order

1. P0: `backend start` detach + `backend status` discovery (these are closely related)
2. P1: Duplicate completed event (quick fix, high agent impact)
3. P1: Progress output TTY detection (quick fix)
4. P1: HTTP timeout (needs investigation into AceClient)
5. P2: downloadedModels sync (cross-cutting, lower priority)
6. P2: Enhance detach message (trivial)
