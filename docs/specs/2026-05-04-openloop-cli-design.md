# OpenLoop CLI Design Spec

## Overview

Add a CLI mode to OpenLoop so agents and headless users can generate music without the GUI. The CLI and GUI are two entry points to the same service layer — they share the SQLite database, the ACE-Step backend process, settings, and generation history.

Primary use case: agent integration in video production workflows (Remotion/Hyperframes). The agent calls `openloop run "prompt"`, gets back a file path, uses it in the video pipeline.

## Architecture

### One Binary, Mode Detection

The existing `openloop` binary detects mode from args:

```
openloop              → launch GUI (Tauri)
openloop run "..."    → CLI mode
openloop setup        → CLI mode
openloop help         → CLI mode
```

No separate binary name. The user thinks of OpenLoop as one product. Like Codex — one binary, args determine mode.

### Extract Service Layer from Tauri

Current `lib.rs` creates `AppState` inside Tauri's `setup` closure. This couples the service layer to Tauri.

**Refactoring:**

1. Create `src-tauri/src/app_state.rs` — standalone `AppState::init(app_data_dir, sidecar_dir) -> AppState` function
2. Move `AppState` struct and initialization out of `lib.rs`
3. Tauri `setup` calls `AppState::init()` then wraps in `app.manage()`
4. CLI binary calls `AppState::init()` directly — no Tauri dependency
5. `commands/` stays as the Tauri adapter layer

After refactoring:

```
openloop_lib
├── app_state.rs       ← AppState struct + init()
├── services/          ← shared by both CLI and GUI
├── models/            ← shared by both CLI and GUI
├── audio/             ← shared (decode/encode/waveform)
├── commands/          ← Tauri IPC commands (GUI only)
├── lib.rs             ← Tauri run() + module declarations
```

The CLI binary (`src-tauri/src/main.rs`) becomes:

```rust
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        openloop_lib::cli::run(args);
    } else {
        openloop_lib::run(); // Tauri GUI
    }
}
```

### Shared State

CLI and GUI share:

- **SQLite database** (same `app_data_dir/openloop.db`)
- **ACE-Step backend** (health check on configured port — reuse if running, start if not)
- **Settings** (same `settings` table)
- **Generation history** (same `generations` table)
- **Model files** (same model directory)
- **Backend logs** (same log directory)

CLI queued task → GUI sees it in active tasks. GUI queued task → CLI `ps` shows it.

### Backend Coordination

Both CLI and GUI check backend health before operations:

1. `GET /health` on configured port
2. If healthy → reuse existing backend
3. If not healthy → start backend, wait for health

Neither CLI nor GUI should kill a backend they didn't start. The backend process persists after the CLI exits.

## Audio Format Change

### Current Behavior

- ACE-Step backend generates audio
- For `wav`, `mp3`, `flac`: OpenLoop writes raw bytes from ACE-Step directly
- For `ogg`: OpenLoop decodes FLAC from ACE-Step, re-encodes to OGG using `vorbis_rs`

### New Behavior

- ACE-Step handles all format conversion natively via `torchaudio.save()`
- OpenLoop passes `audio_format` to ACE-Step, receives audio in requested format
- OpenLoop writes bytes directly for ALL formats — no conversion logic
- Remove `vorbis_rs` dependency, `audio/encode.rs`, and OGG decode→re-encode path in `file_store.rs`

### Affected Files

| File                                        | Change                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `src-tauri/Cargo.toml`                      | Remove `vorbis_rs` dependency                                            |
| `src-tauri/src/audio/encode.rs`             | Delete file                                                              |
| `src-tauri/src/audio/mod.rs`                | Remove `pub mod encode`                                                  |
| `src-tauri/src/services/file_store.rs`      | Remove OGG branch, simplify `write_audio` to always write bytes directly |
| `src-tauri/src/services/generation_task.rs` | No change (already passes format to ACE-Step)                            |
| `src-tauri/src/services/ace_client.rs`      | No change (already sends `audio_format` in payload)                      |

### `write_audio` After Change

```rust
pub fn write_audio(
    &self,
    bytes: Vec<u8>,
    audio_format: &str,
    settings: &AppSettings,
) -> AppResult<String> {
    let directory = self.resolve_output_directory(settings)?;
    let filename = format!(
        "openloop-{}-{}.{}",
        Utc::now().format("%Y%m%d-%H%M%S"),
        Uuid::new_v4(),
        audio_format
    );
    let output_path = directory.join(filename);
    fs::write(&output_path, bytes)
        .map_err(|error| AppError::output_write_failed(error.to_string()))?;
    Ok(output_path.display().to_string())
}
```

### Supported Formats

`wav`, `mp3`, `flac`, `ogg` — all handled by ACE-Step natively. No conversion in OpenLoop.

Default: `wav` (ACE-Step's default).

## CLI Commands

### `openloop run`

Generate music. The primary command for agent workflows.

**Synopsis:**

```
openloop run [FLAGS] <prompt>
```

**Positional:**

- `prompt` — text description of the music to generate

**Flags:**

| Flag            | Short | Default    | Description                     |
| --------------- | ----- | ---------- | ------------------------------- |
| `--model`       | `-m`  | from setup | Model variant (lite/turbo/pro)  |
| `--duration`    | `-d`  | from setup | Duration in seconds (10-600)    |
| `--format`      | `-f`  | from setup | Audio format (wav/mp3/flac/ogg) |
| `--output`      | `-o`  | CWD        | Output file path                |
| `--lyrics`      | `-l`  | empty      | Lyrics text                     |
| `--bpm`         |       | auto       | BPM (30-300)                    |
| `--key`         |       | auto       | Key and scale (e.g., "C major") |
| `--steps`       |       | 8          | Inference steps                 |
| `--guidance`    |       | 7.0        | Guidance scale                  |
| `--seed`        |       | random     | Random seed                     |
| `--variations`  | `-v`  | 1          | Number of variations (1-4)      |
| `--no-thinking` |       | false      | Disable thinking mode           |
| `--json`        |       | false      | NDJSON streaming output         |
| `--help`        | `-h`  |            | Show help                       |

**Behavior:**

1. Auto-bootstrap: if backend not running, start it. If model not downloaded, download it.
2. Build `GenerationRequest` from flags + setup defaults.
3. Queue if another generation is running.
4. Submit to ACE-Step backend.
5. Stream progress via NDJSON (with `--json`) or show spinner (without).
6. Write output file to `--output` path or CWD.
7. Save `GenerationRecord` to SQLite (shared with GUI).
8. Print final result.

**Output path logic (ffmpeg-style):**

- `--output ./track.mp3` → format inferred as mp3
- `--output ./track.flac` → format inferred as flac
- `--output ./track` → format from `--format` flag or setup default
- `--output ./dir/` (ends with `/`) → auto-generate filename in that directory
- `--output ./track.mp3 --format flac` → `--format` wins, file renamed to `./track.flac`
- No `--output` → `openloop-{timestamp}-{uuid}.{format}` in CWD
- Multiple variations with `--output ./track.wav` → `./track-1.wav`, `./track-2.wav`, etc.

**NDJSON events (with `--json`):**

```json
{"event":"bootstrapping","action":"starting_backend"}
{"event":"bootstrapping","action":"downloading_model","model":"turbo"}
{"event":"submitted","task_id":"..."}
{"event":"queued","position":1}
{"event":"running","variation":1,"total":1}
{"event":"completed","output_path":"/abs/path/track.wav","duration":30.0,"format":"wav"}
```

On error:

```json
{ "event": "failed", "error": "backend health timeout after 60s" }
```

**Human output (without `--json`):**

```
♫ Generating music...
  Model: turbo | Duration: 30s | Format: wav
  [████████████████████░░░░] 80% — generating...
✓ Generated: ./openloop-20260504-143022-a1b2c3d4.wav (30.0s)
```

**Exit codes:**

- `0` — success
- `1` — error (validation, backend, generation failure)

**Error output (with `--json`):**

```json
{
  "error": "model 'ultra' not available. Use 'openloop models' to list options."
}
```

**Error output (human):**

```
✗ Error: model 'ultra' not available. Use 'openloop models' to list options.
```

**Examples:**

```bash
# Simple generation
openloop run "upbeat electronic track for a product video"

# Agent workflow with explicit output
openloop run "sad piano ballad" --duration 60 --format mp3 --output ./assets/music/sad.mp3

# With lyrics
openloop run "pop song" --lyrics "[verse]\nHello world\n[chorus]\nLet's go"

# JSON mode for agent parsing
openloop run "epic cinematic" --duration 120 --json

# Override model
openloop run "jazz trio" --model pro
```

---

### `openloop setup`

Configure default settings. Interactive wizard for humans, key-value for agents.

**Synopsis:**

```
openloop setup [KEY] [VALUE] [FLAGS]
```

**Interactive mode (no args):**

```
$ openloop setup

┌─────────────────────────────────────────┐
│         ♫ OpenLoop Setup                │
│  Configure model and generation defaults│
│  Press Ctrl+C to exit                   │
└─────────────────────────────────────────┘

◆ Model Variant
  Select the model to use for generation.
  Current: Turbo (16GB)

  1. Lite (8GB)     — faster, lower quality
  2. Turbo (16GB)   — recommended ← currently active
  3. Pro (24GB)     — highest quality

  Choice [1-3] (2):

◆ Thinking Mode
  Enable reasoning for better prompt understanding.
  Current: enabled

  1. Enabled   ← currently active
  2. Disabled

  Choice [1-2] (1):

◆ Default Duration
  Default duration in seconds for generated audio.
  Current: 30

  Duration [10-600] (30):

◆ Audio Format
  Default output format for generated audio.
  Current: wav

  1. wav  — uncompressed, largest file ← currently active
  2. mp3  — compressed, smallest file
  3. flac — lossless compression
  4. ogg  — lossy compression

  Choice [1-4] (1):

✓ Setup complete. Settings saved.
```

Uses arrow keys for radio selection, Enter to confirm, current values shown as defaults.

**Non-interactive mode (key-value):**

```bash
openloop setup model turbo      # applies immediately, prints confirmation
openloop setup thinking on
openloop setup duration 60
openloop setup format mp3
```

**Non-interactive mode (flags):**

```bash
openloop setup --model turbo --thinking on --duration 60 --format mp3
```

**Show current values (no args, non-TTY or piped):**

```bash
$ openloop setup
model    = turbo
thinking = on
duration = 30
format   = wav
```

**Keys:**

| Key        | Values                      | Description                 |
| ---------- | --------------------------- | --------------------------- |
| `model`    | `lite`, `turbo`, `pro`      | Model variant               |
| `thinking` | `on`, `off`                 | Thinking mode               |
| `duration` | `10-600`                    | Default duration in seconds |
| `format`   | `wav`, `mp3`, `flac`, `ogg` | Default audio format        |

**Flags:**

| Flag         | Description                |
| ------------ | -------------------------- |
| `--model`    | Set model variant          |
| `--thinking` | Set thinking mode (on/off) |
| `--duration` | Set default duration       |
| `--format`   | Set default format         |
| `--json`     | JSON output                |
| `--help`     | Show help                  |

**JSON output (with `--json`):**

```json
{ "model": "turbo", "thinking": "on", "duration": "30", "format": "wav" }
```

**Exit codes:**

- `0` — success
- `1` — error (invalid key, invalid value)

---

### `openloop list`

Show generation history.

**Synopsis:**

```
openloop list [FLAGS]
```

**Flags:**

| Flag      | Description                     |
| --------- | ------------------------------- |
| `--json`  | JSON array output               |
| `--limit` | Number of records (default: 20) |
| `--help`  | Show help                       |

**Human output:**

```
ID           Prompt                    Duration  Format  Created
a1b2c3d4     epic cinematic track      120s      mp3     2026-05-04 14:30
e5f6g7h8     sad piano ballad          60s       wav     2026-05-04 13:15
i9j0k1l2     upbeat electronic         30s       flac    2026-05-04 12:00
```

IDs are shown as 8-char prefixes. `openloop delete` accepts these prefixes.

**JSON output (with `--json`):**

```json
[
  {
    "id": "a1b2c3d4",
    "prompt": "epic cinematic track",
    "duration_seconds": 120.0,
    "audio_format": "mp3",
    "output_path": "/Users/david/Music/OpenLoop/openloop-20260504-143022-a1b2c3d4.mp3",
    "created_at": "2026-05-04T14:30:22Z"
  }
]
```

---

### `openloop pull`

Download a model variant.

**Synopsis:**

```
openloop pull <model> [FLAGS]
```

**Positional:**

- `model` — model variant: `lite`, `turbo`, or `pro`

**Flags:**

| Flag     | Description            |
| -------- | ---------------------- |
| `--json` | NDJSON progress output |
| `--help` | Show help              |

**Behavior:**

1. Check if model is already downloaded. If so, print message and exit.
2. Download model files from Hugging Face.
3. Save model status to settings.

**NDJSON events (with `--json`):**

```json
{"event":"downloading","file":"acestep-v15-turbo/model.safetensors","progress":0.3}
{"event":"downloading","file":"acestep-5Hz-lm-0.6B/model.safetensors","progress":0.7}
{"event":"completed","model":"turbo"}
```

**Human output:**

```
♫ Downloading model: Turbo (16GB)
  [████████████████████░░░░] 80% — acestep-5Hz-lm-0.6B/model.safetensors
✓ Model downloaded: Turbo
```

---

### `openloop models`

List available and downloaded models.

**Synopsis:**

```
openloop models [FLAGS]
```

**Flags:**

| Flag     | Description       |
| -------- | ----------------- |
| `--json` | JSON array output |
| `--help` | Show help         |

**Human output:**

```
Variant   Size    Status      Description
Lite      8GB     downloaded  turbo DiT + 0.6B LM
Turbo     16GB    ● active    turbo DiT + 0.6B LM (recommended)
Pro       24GB    —           XL turbo DiT + 1.7B LM
```

**JSON output (with `--json`):**

```json
[
  { "variant": "lite", "size_gb": 8, "status": "downloaded", "active": false },
  { "variant": "turbo", "size_gb": 16, "status": "downloaded", "active": true },
  {
    "variant": "pro",
    "size_gb": 24,
    "status": "not_downloaded",
    "active": false
  }
]
```

---

### `openloop ps`

Show backend status and active generation tasks.

**Synopsis:**

```
openloop ps [FLAGS]
```

**Flags:**

| Flag     | Description        |
| -------- | ------------------ |
| `--json` | JSON object output |
| `--help` | Show help          |

**Human output:**

```
Backend: healthy (port 8001)
Model:   turbo
Active tasks: 0
```

**With active task:**

```
Backend: healthy (port 8001)
Model:   turbo
Active tasks: 1
  a1b2c3d4  "epic cinematic"  running (30s elapsed)
```

**JSON output (with `--json`):**

```json
{
  "backend": "healthy",
  "port": 8001,
  "model": "turbo",
  "active_tasks": [
    {
      "id": "a1b2c3d4",
      "prompt": "epic cinematic",
      "status": "running",
      "elapsed_seconds": 30
    }
  ]
}
```

---

### `openloop delete`

Delete one generation record and its output file.

**Synopsis:**

```
openloop delete <id> [FLAGS]
```

**Positional:**

- `id` — generation record ID or prefix (from `openloop list`). Supports partial matching: `a1b2` matches `a1b2c3d4-e5f6-...`.

**Flags:**

| Flag     | Description |
| -------- | ----------- |
| `--json` | JSON output |
| `--help` | Show help   |

**Behavior:**

1. Find record by ID.
2. Delete output file if it exists.
3. Delete database record.
4. Print confirmation.

**Human output:**

```
✓ Deleted: a1b2c3d4 (epic cinematic track)
```

**JSON output (with `--json`):**

```json
{ "deleted": "a1b2c3d4" }
```

---

### `openloop clear`

Clear all generation history.

**Synopsis:**

```
openloop clear [FLAGS]
```

**Flags:**

| Flag     | Description       |
| -------- | ----------------- |
| `--json` | JSON output       |
| `--yes`  | Skip confirmation |
| `--help` | Show help         |

**Behavior:**

1. Count records.
2. In human mode (no `--json`): if `--yes` not set, prompt: "Delete 15 records and their output files? [y/N]"
3. In JSON mode: auto-confirm (no interactive prompt).
4. Delete all output files.
5. Clear database.
6. Print confirmation.

**Human output:**

```
Delete 15 records and their output files? [y/N] y
✓ Cleared 15 records and output files.
```

**JSON output (with `--json`):**

```json
{ "cleared": 15 }
```

---

### `openloop stop`

Stop the ACE-Step backend process.

**Synopsis:**

```
openloop stop [FLAGS]
```

**Flags:**

| Flag     | Description |
| -------- | ----------- |
| `--json` | JSON output |
| `--help` | Show help   |

**Behavior:**

1. If backend is running, stop it.
2. If backend is not running, print message and exit.

**Human output:**

```
✓ Backend stopped.
```

or

```
Backend is not running.
```

---

## Help System

### `openloop --help` / `openloop help`

```
♫ OpenLoop — AI music generation

Usage:
  openloop <command> [flags]

Commands:
  run       Generate music
  setup     Configure defaults
  list      Show generation history
  pull      Download a model
  models    List available models
  ps        Show backend status
  delete    Delete a generation record
  clear     Clear all history
  stop      Stop the backend

Global flags:
  --json    Machine-readable JSON output
  --help    Show help for a command

Examples:
  openloop run "upbeat electronic track"
  openloop run "sad piano" --duration 60 --format mp3 --output ./sad.mp3
  openloop setup
  openloop setup model turbo
  openloop list --json
  openloop pull turbo
```

### `openloop <command> --help`

Each command shows its own flags and examples. Example:

```
openloop run — Generate music

Usage:
  openloop run [flags] <prompt>

Flags:
  -m, --model       Model variant (lite/turbo/pro)
  -d, --duration    Duration in seconds (10-600)
  -f, --format      Audio format (wav/mp3/flac/ogg)
  -o, --output      Output file path
  -l, --lyrics      Lyrics text
  --bpm             BPM (30-300)
  --key             Key and scale (e.g., "C major")
  --steps           Inference steps
  --guidance        Guidance scale
  --seed            Random seed
  -v, --variations  Number of variations (1-4)
  --no-thinking     Disable thinking mode
  --json            NDJSON streaming output
  -h, --help        Show help

Examples:
  openloop run "upbeat electronic track"
  openloop run "sad piano" --duration 60 --format mp3 --output ./sad.mp3
  openloop run "pop song" --lyrics "[verse]\nHello\n[chorus]\nWorld"
  openloop run "epic cinematic" --json
```

## Error Handling

### Human Mode

Colored error text to stderr:

```
✗ Error: model 'ultra' not available. Use 'openloop models' to list options.
```

### JSON Mode (`--json`)

Valid JSON to stdout:

```json
{
  "error": "model 'ultra' not available. Use 'openloop models' to list options."
}
```

### Exit Codes

- `0` — success
- `1` — error

## Implementation Phases

### Phase 1: Extract Service Layer

Refactor `AppState` out of Tauri's setup closure. Create `app_state.rs`. No behavior change — just moving code.

**Files to modify:**

- `src-tauri/src/lib.rs` — move `AppState` struct and `current_executable_dir` to `app_state.rs`, call `AppState::init()` in setup
- `src-tauri/src/app_state.rs` — new file, contains `AppState` struct and `init()`
- `src-tauri/src/commands/*.rs` — update imports if needed (should be minimal since commands use `tauri::State<AppState>`)

### Phase 2: Remove OGG Conversion

Simplify audio handling. Let ACE-Step handle all format conversion.

**Files to modify:**

- `src-tauri/Cargo.toml` — remove `vorbis_rs`
- `src-tauri/src/audio/encode.rs` — delete
- `src-tauri/src/audio/mod.rs` — remove `pub mod encode`
- `src-tauri/src/services/file_store.rs` — remove OGG branch, simplify `write_audio`
- `src/app/lib/types.ts` — keep `AudioFormat = "wav" | "mp3" | "flac" | "ogg"` (ACE-Step supports all)
- `src/app/components/settings/` — verify format selector still works (no change needed if it reads from the same type)

### Phase 3: CLI Binary

Add CLI entry point and argument parsing.

**Files to create:**

- `src-tauri/src/cli/mod.rs` — CLI dispatcher
- `src-tauri/src/cli/run.rs` — `openloop run` implementation
- `src-tauri/src/cli/setup.rs` — `openloop setup` implementation
- `src-tauri/src/cli/list.rs` — `openloop list` implementation
- `src-tauri/src/cli/pull.rs` — `openloop pull` implementation
- `src-tauri/src/cli/models.rs` — `openloop models` implementation
- `src-tauri/src/cli/ps.rs` — `openloop ps` implementation
- `src-tauri/src/cli/delete.rs` — `openloop delete` implementation
- `src-tauri/src/cli/clear.rs` — `openloop clear` implementation
- `src-tauri/src/cli/stop.rs` — `openloop stop` implementation
- `src-tauri/src/cli/help.rs` — help text

**Files to modify:**

- `src-tauri/Cargo.toml` — add `clap` dependency
- `src-tauri/src/main.rs` — mode detection (args present → CLI, no args → GUI)
- `src-tauri/src/lib.rs` — add `pub mod cli`

### Phase 4: Interactive Setup Wizard

Terminal UI for `openloop setup`.

**Dependencies to add:**

- `dialoguer` or `inquire` — terminal UI (radio selects, input prompts)

### Phase 5: JSON Output and NDJSON Streaming

Add `--json` flag handling to all commands.

**Shared utilities:**

- JSON output helpers (emit event, emit error)
- NDJSON stream writer for `run` command
- Tauri event → NDJSON bridge for `run` command

### Phase 6: Documentation and Cleanup

- Update CONTEXT.md
- Update PRD if needed
- Update implementation-status.md
- Remove `output_directory` from Settings GUI if CLI uses CWD by default (or keep for GUI — it's still useful there)

## Dependencies

### New Rust Dependencies

| Crate                    | Purpose                           |
| ------------------------ | --------------------------------- |
| `clap`                   | CLI argument parsing              |
| `dialoguer` or `inquire` | Interactive terminal UI for setup |

### Removed Dependencies

| Crate       | Reason                           |
| ----------- | -------------------------------- |
| `vorbis_rs` | OGG conversion moved to ACE-Step |

## Context Map Changes

No new contexts. CLI and GUI share the same context. The CLI is an entry point, not a separate bounded context.
