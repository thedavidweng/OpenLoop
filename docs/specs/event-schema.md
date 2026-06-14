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

Emitted during backend startup/shutdown.

```json
{
  "v": 1,
  "ts": "2026-06-14T12:00:00Z",
  "kind": "lifecycle",
  "phase": "starting",
  "port": 8001,
  "ownership": "owned",
  "message": "Backend starting..."
}
```

| Field       | Type           | Description                                                     |
| ----------- | -------------- | --------------------------------------------------------------- |
| `phase`     | string         | `starting`, `healthy`, `stopped`, `failed`                      |
| `port`      | integer \| null | Backend port (null if not yet known)                           |
| `ownership` | string         | `owned` (started by this session) or `attached` (already running) |
| `message`   | string         | Human-readable status message                                   |

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

---

## Result Events

Emitted on successful completion.

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

The `result` envelope merges the `data` object directly. Common fields for `openloop run`:

| Field        | Type    | Description                         |
| ------------ | ------- | ----------------------------------- |
| `event`      | string  | Always `"completed"`                |
| `path`       | string  | Output file path                    |
| `duration_ms`| integer | Generation duration in milliseconds |
| `seed`       | integer | Seed used for generation            |

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

---

## Generation Task Events

During `openloop run`, the generation task runner emits intermediate events through the NDJSON stream. These use a `type` field inside the result payload.

| `type`        | Description                           | Additional fields                     |
| ------------- | ------------------------------------- | ------------------------------------- |
| `submitted`   | Task submitted to backend             | `taskId`                              |
| `queued`      | Waiting in backend queue              | `variationCurrent`, `variationTotal`  |
| `running`     | Generation in progress                | `variationCurrent`, `variationTotal`  |
| `downloading` | Model weights downloading             | `variationCurrent`, `variationTotal`  |
| `completed`   | Generation finished                   | `path`, `duration_ms`, `seed`         |
| `cancelled`   | User cancelled the generation         | —                                     |
| `failed`      | Generation failed                     | `error`                               |

### Example stream

```
{"v":1,"ts":"2026-06-14T12:00:00Z","kind":"result","event":"submitted","taskId":"abc123"}
{"v":1,"ts":"2026-06-14T12:00:01Z","kind":"result","event":"queued","variation":1,"total":1}
{"v":1,"ts":"2026-06-14T12:00:02Z","kind":"result","event":"running","variation":1,"total":1}
{"v":1,"ts":"2026-06-14T12:01:30Z","kind":"result","event":"completed","path":"~/Music/openloop/output.wav","duration_ms":88000,"seed":42}
```

---

## CLI Output Modes

- **Human mode** (default): Progress and lifecycle messages go to stderr as formatted text. Only the final result is printed to stdout.
- **JSON mode** (`--json`): All events are emitted as NDJSON to stdout. Errors go to stderr.

## Notes

- Events are emitted one per line (no pretty-printing) for stream parsing.
- The `v` field enables forward-compatible parsing; consumers should ignore unknown fields.
- Timestamps are always UTC in RFC 3339 format.
