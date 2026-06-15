# CLI NDJSON Event Schema

OpenLoop's CLI emits newline-delimited JSON (NDJSON) when invoked with `--json`. Each line is a self-contained JSON object. This document defines the schema for all event types currently emitted.

## `openloop run` Events

The `run` command streams generation progress as NDJSON to stdout. Each line uses a bare JSON format with an `event` field (no envelope).

| `event`       | Description                           | Fields                                    |
| ------------- | ------------------------------------- | ----------------------------------------- |
| `submitted`   | Task submitted to backend             | `task_id`                                 |
| `queued`      | Waiting in backend queue              | `variation`, `total`                      |
| `running`     | Generation in progress                | `variation`, `total`                      |
| `downloading` | Model weights downloading             | `variation`, `total`                      |
| `completed`   | Generation finished                   | `output_path`, `duration`, `format`       |
| `cancelled`   | User cancelled the generation         | —                                         |

### Field descriptions

| Field         | Type    | Description                              |
| ------------- | ------- | ---------------------------------------- |
| `task_id`     | string  | Backend task identifier                  |
| `variation`   | integer | Current variation index (1-based)        |
| `total`       | integer | Total number of variations               |
| `output_path` | string  | Path to the generated audio file         |
| `duration`    | number  | Generation duration in seconds           |
| `format`      | string  | Audio format (`wav`, `mp3`, `flac`, `ogg`) |

### Example stream

```
{"event":"submitted","task_id":"abc123"}
{"event":"queued","variation":1,"total":1}
{"event":"running","variation":1,"total":1}
{"event":"completed","output_path":"~/Music/openloop/output.wav","duration":88.0,"format":"wav"}
```

### Notes on `failed` and `completed`

- **`failed`**: The generation task runner emits a `failed` event internally, but `CliGenerationSink` does not handle it in JSON mode — it falls through to the catch-all `_ => {}` branch. Failures surface as a Rust `Err` and produce a non-JSON error message to stderr. This will be addressed in a future update.
- **`completed`**: During multi-step generation, the intermediate `completed` event from the task runner is suppressed. The final `completed` event with the correct (possibly renamed) output path is emitted by the post-generation loop.

---

## `openloop pull` Events

```
{"event":"completed","model":"Lite"}
{"event":"completed","model":"Turbo","total_bytes":4294967296}
```

---

## `openloop status` Output

Returns a single JSON object (not streaming):

```json
{
  "backend": { "state": "healthy", "port": 8001, "ownership": "owned" },
  "model": { "variant": "turbo", "downloaded": true },
  "activeTasks": [],
  "device": { "os": "macos", "arch": "aarch64", "isAppleSilicon": true, "totalMemoryGb": 16 }
}
```

---

## `openloop enhance` Output

Returns the enhancement result as a single JSON object:

```json
{
  "prompt": "warm piano, 90 BPM",
  "lyrics": null,
  "bpm": 90,
  "key_scale": "C major",
  "time_signature": "4/4",
  "duration_seconds": 30.0,
  "vocal_language": "en"
}
```

---

## Other Commands

Commands like `list`, `delete`, `clear`, `ps`, `stop`, `doctor`, `files`, `setup`, `settings`, `models`, and `backend` subcommands emit their own JSON structures when invoked with `--json`. These are documented per-command via `openloop <cmd> --help`.

---

## Defined but Unused Event Infrastructure

`cli::events` defines envelope-based functions (`emit_lifecycle`, `emit_progress`, `emit_result`, `emit_error`) with a shared `{v, ts, kind, ...}` envelope format. These functions have **no call sites** in the current CLI code and are not emitted. They exist as infrastructure for future use.

If adopted, the envelope would look like:

```json
{"v": 1, "ts": "2026-06-14T12:00:00Z", "kind": "lifecycle", "phase": "starting", "port": 8001, "ownership": "owned", "message": "Backend starting..."}
{"v": 1, "ts": "2026-06-14T12:00:05Z", "kind": "progress", "pct": 42, "label": "downloading", "detail": "1.2 GB / 2.8 GB"}
{"v": 1, "ts": "2026-06-14T12:00:10Z", "kind": "error", "code": "BACKEND_NOT_HEALTHY", "message": "...", "recoverable": true, "suggestion": "..."}
```

This section is informational only — consumers should not expect these events until they are wired up.
