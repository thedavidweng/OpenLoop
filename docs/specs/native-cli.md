# Native CLI contract (v2)

The native Swift executable is separate from the SwiftUI app and calls the same
OpenLoopCore. `openloop help` lists commands. The package product is named
`openloop-cli` to avoid the case-insensitive collision with `OpenLoop`; packaging
installs it under the same name as `OpenLoop.app/Contents/MacOS/openloop-cli`.

`--json` emits one UTF-8 JSON object per line. Non-error events go to stdout;
error events go to stderr. Consumers must read both streams:

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

`run --project ID_OR_NAME` assigns new Takes to an existing Project;
`list --project ID_OR_NAME` filters completed History. Names must match exactly
and be unique; use the Project ID when names collide.

The bounded #71 profile slice persists stable generation defaults:

```text
openloop profiles list
openloop profiles create NAME [--configuration ID] [--duration SECONDS] [--format wav|mp3|flac]
openloop profiles delete ID_OR_NAME
openloop run --profile ID_OR_NAME --prompt TEXT
```

Profile IDs or exact unique names are accepted. A profile supplies the saved
configuration, duration and format, and the resulting Generation request/history
records both its profile ID and name. Profile rename, GUI editing and
engine-specific options remain outside this slice and are the next #71 scope.

`run --prompt "New section" --repaint source.wav --start 2 --end 5` repaints a
region of local source audio. The source's decoded duration defines the full
output timeline, so `--duration` is not accepted with `--repaint`. The selected
Engine must support Repaint and reference audio. A completed edit creates a new
Take and leaves the source file untouched. The native adapter uses ACE-Step's
`/release_task` repaint operation; the old proposed `/edit` route is not used.

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
