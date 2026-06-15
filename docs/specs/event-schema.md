# CLI NDJSON Event Schema

OpenLoop's CLI emits newline-delimited JSON (NDJSON) when invoked with `--json`. Each line is a self-contained JSON object. This document defines the schema for all event types.

## Envelope

Every event shares a common envelope:

```json
{
  "v": 1,
  "ts": "2026-06-14T12:00:00Z",
  "kind": "<event-kind>",
  ...
}
```

| Field  | Type    | Description                                      |
| ------ | ------- | ------------------------------------------------ |
| `v`    | integer | Schema version (currently `1`)                   |
| `ts`   | string  | ISO 8601 UTC timestamp                           |
| `kind` | string  | Event kind: `lifecycle`, `progress`, `result`, `error` |

Additional fields depend on `kind`.

---

## Lifecycle Events

Emitted by `backend status/start/stop/restart --json`. The lifecycle envelope fields are merged into the backend status JSON object (single NDJSON line).

```json
{
  "v": 1,
  "ts": "2026-06-14T12:00:00Z",
  "kind": "lifecycle",
  "phase": "healthy",
  "port": 8001,
  "ownership": "owned",
  "message": "Backend started (port 8001)"
}
```

| Field       | Type           | Description                                                     |
| ----------- | -------------- | --------------------------------------------------------------- |
| `phase`     | string         | `starting`, `healthy`, `stopped`, `failed`                      |
| `port`      | integer \| null | Backend port (null if not yet known)                           |
| `ownership` | string         | `owned` (started by this session), `attached` (already running), or `stopped` (not running) |
| `message`   | string         | Human-readable status message                                   |
| `error`     | string         | Present when `phase` is `failed`; structured backend failure detail |
| `backendCode` | object       | Present on `backend status --json`; backend code installation status |

`backendCode` is one of:

```json
{ "installed": false }
```

or:

```json
{
  "installed": true,
  "commit": "d5d958e",
  "tag": null,
  "installedAt": "2026-06-14T12:00:00Z"
}
```

---

## Progress Events

Emitted during long-running operations (model download, generation).

```json
{
  "v": 1,
  "ts": "2026-06-14T12:00:05Z",
  "kind": "progress",
  "pct": 42,
  "label": "downloading",
  "detail": "1.2 GB / 2.8 GB"
}
```

| Field    | Type           | Description                        |
| -------- | -------------- | ---------------------------------- |
| `pct`    | integer \| null | Percentage 0–100 (null if unknown) |
| `label`  | string         | Operation label                    |
| `detail` | string \| null  | Optional detail text               |

> **Note:** The `progress` envelope format is defined in `events::emit_progress` but not yet wired to CLI commands. Current progress events during `openloop run` use bare JSON lines (see [Generation Task Events](#generation-task-events)).

---

## Result Events

Emitted on successful completion. The `result` envelope format is defined in `events::emit_result` but not yet wired to CLI commands.

```json
{
  "v": 1,
  "ts": "2026-06-14T12:01:30Z",
  "kind": "result",
  "event": "completed",
  "path": "~/Music/openloop/generation-abc123.wav",
  "duration_ms": 45200,
  "seed": 12345
}
```

| Field        | Type    | Description                         |
| ------------ | ------- | ----------------------------------- |
| `event`      | string  | Always `"completed"`                |
| `path`       | string  | Output file path                    |
| `duration_ms`| integer | Generation duration in milliseconds |
| `seed`       | integer | Seed used for generation            |

> **Note:** This envelope format is not yet emitted by any CLI command. Current completion events use bare JSON lines (see [Generation Task Events](#generation-task-events)). Wiring this envelope is a planned breaking shape change from the current bare payload: `output_path` becomes `path`, `duration` changes from float seconds to integer `duration_ms`, `format` is omitted, and `seed` is added.

---

## Error Events

Emitted on failure (to stderr).

```json
{
  "v": 1,
  "ts": "2026-06-14T12:00:10Z",
  "kind": "error",
  "code": "BACKEND_NOT_HEALTHY",
  "message": "Backend failed to start within 120s",
  "recoverable": true,
  "suggestion": "Run openloop doctor to diagnose"
}
```

| Field        | Type    | Description                              |
| ------------ | ------- | ---------------------------------------- |
| `code`       | string  | Machine-readable error code              |
| `message`    | string  | Human-readable error description         |
| `recoverable`| boolean | Whether retrying may succeed             |
| `suggestion` | string \| null | Suggested remediation action        |

> **Note:** The `error` envelope format is defined in `events::emit_error` but not yet wired to CLI commands. Errors are currently reported via the CLI error handler as human-readable stderr output.

---

## Generation Task Events

During `openloop run`, the generation task runner emits intermediate events as bare JSON lines (no envelope). These use an `event` field.

| `event`       | Description                           | Additional fields                     |
| ------------- | ------------------------------------- | ------------------------------------- |
| `submitted`   | Task submitted to backend             | `task_id`                             |
| `queued`      | Waiting in backend queue              | `variation`, `total`                  |
| `running`     | Generation in progress                | `variation`, `total`                  |
| `downloading` | Model weights downloading             | `variation`, `total`                  |
| `completed`   | Generation finished                   | `output_path`, `duration`, `format`   |
| `cancelled`   | User cancelled the generation         | —                                     |

> **Note:** The `failed` event is emitted internally by the generation task runner but not currently surfaced in JSON mode. Errors propagate as `AppResult::Err` and are reported via the CLI error handler. This will be addressed in a future update.

### Example stream

```
{"event":"submitted","task_id":"abc123"}
{"event":"queued","variation":1,"total":1}
{"event":"running","variation":1,"total":1}
{"event":"completed","output_path":"~/Music/openloop/output.wav","duration":88.0,"format":"wav"}
```

---

## CLI Output Modes

- **Human mode** (default): Progress and lifecycle messages go to stderr as formatted text. Only the final result is printed to stdout.
- **JSON mode** (`--json`): All events are emitted as NDJSON to stdout. Errors go to stderr.

## Notes

- Events are emitted one per line (no pretty-printing) for stream parsing.
- The `v` field enables forward-compatible parsing; consumers should ignore unknown fields.
- Timestamps are always UTC in RFC 3339 format.
- Lifecycle events are emitted by `backend status/start/stop/restart --json` as a single NDJSON line with envelope fields merged into the status object. Progress, result, and error envelope formats are defined in `events::*` but not yet wired to CLI commands.
