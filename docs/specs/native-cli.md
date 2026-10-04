# Native CLI contract (v2)

The native Swift executable is separate from the SwiftUI app and calls the same
OpenLoopCore. `openloop help` lists commands. The package product is named
`openloop-cli` to avoid the case-insensitive collision with `OpenLoop`; packaging
installs it as `OpenLoop.app/Contents/MacOS/openloop`.

`--json` emits one UTF-8 JSON object per stdout line:

```json
{"v":2,"ts":"2026-10-04T00:00:00Z","kind":"progress","data":{"fraction":0.5,"label":"Generating Take"}}
```

The envelope is specified in `docs/schemas/native-cli-v2.schema.json`.

Kinds: `lifecycle`, `progress`, `result`, `error`. Errors go to stderr with a
nonzero exit status. Progress fraction is 0–1 or null. Result data for generation
streams includes the submitted/running/final Generation Task, and a separate
`{generation,take}` result for each completed Take. Task state may be `queued`,
`running`, `completed`, `failed` or `cancelled`. The Generation Record includes
its actual seed (nullable when the engine does not return one), full common
request, provenance, and all Artifacts. Dates within Codable domain records use
Foundation's seconds-since-2001 encoding; the envelope timestamp is ISO 8601 UTC.

Version 2 deliberately replaces v1's mixture of envelopes and bare task events.
Consumers must check `v` and migrate field access through `data`. No v1 fields
are silently given new meanings. Human mode prints results as readable formatted
JSON and status text to stderr, so stdout can still be redirected.

`run --request FILE.json` accepts the Codable GenerationRequest contract. Simple
creative intent can also use `--prompt`, `--lyrics`, `--duration`, `--seed`,
`--takes`, `--configuration`, `--project`, and `--format`. Unknown flags and
invalid numeric input fail rather than substituting defaults. Advanced settings
are available in a versioned `engineOptions` object in the request file.

`settings set FILE.json` replaces a complete Settings value after validation.
Runtime changes affect the next start. `--data-dir PATH` isolates all state for
experiments; GUI and CLI normally use the same app-support directory. `--uv PATH`
is a developer override for the bundled executable, not a system-Python fallback.

`delete`, `clear`, and model deletion require `--yes`; export refuses to overwrite
a destination. Project deletion keeps completed Takes in cross-project History.
`stop TASK_ID` and Ctrl-C cancel the current Generation Task. Interrupted tasks
become retryable failures on relaunch. Partial success retains already completed
Takes if a later variation fails/cancels. Runtime setup/model downloads can be
performed explicitly or via `run --accept-license` after inspecting `catalog`.
