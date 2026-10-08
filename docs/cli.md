# Native OpenLoop CLI Guide

The native app bundles a separate headless executable at
`/Applications/OpenLoop.app/Contents/MacOS/openloop-cli`. It shares the native
GUI library. The old Tauri single-binary CLI and NDJSON v1 are retired.

```sh
CLI=/Applications/OpenLoop.app/Contents/MacOS/openloop-cli
"$CLI" help
"$CLI" catalog --json
"$CLI" setup --accept-license
"$CLI" models install ace-step/standard --accept-license
"$CLI" project create 'Piano sketches'
"$CLI" run --configuration ace-step/lite --prompt 'gentle piano' --duration 10 --seed 42 --json
"$CLI" list --json
"$CLI" ps --json
```

Read the licenses in `catalog` before accepting installation. Runtime and model
installation download several GB; generation is local. Runtime setup uses the
bundled uv, not a system Python installation.

## Commands

| Command | Purpose |
| --- | --- |
| `status`, `catalog`, `list`, `ps` | Inspect setup, catalog, completed Records, or Tasks |
| `project list/create/rename/delete` | Organize Takes; project deletion retains History |
| `settings get`, `settings set FILE.json` | Read or replace validated Settings |
| `setup --accept-license` | Install the pinned runtime |
| `models list/install/delete` | Manage Model Packs; install requires `--accept-license`, delete `--yes` |
| `run --prompt TEXT` | Generate; accepts `--configuration`, `--lyrics`, `--duration`, `--seed`, `--takes`, `--project`, `--format` |
| `run --request FILE.json` | Submit the full GenerationRequest, including advanced settings and edit regions |
| `retry TASK_ID`, `stop TASK_ID` | Retry a failed/cancelled task or cancel execution |
| `reproduce TAKE_ID`, `vary TAKE_ID` | Reuse recorded seed or create a related variation |
| `favorite GENERATION_ID [--off]` | Change favorite state |
| `export GENERATION_ID ARTIFACT_ID DESTINATION` | Copy an Artifact; refuses overwrite |
| `delete GENERATION_ID --yes`, `clear --yes` | Remove Records and owned Artifacts |

Global flags: `--json`, `--data-dir PATH` for an isolated library, and `--uv PATH`
for a developer override. Use `help` for exact command syntax. GUI isolation uses
`OPENLOOP_DATA_DIR` and `OPENLOOP_UV` instead.

## Machine-readable output

`--json` emits NDJSON **v2**, one envelope per line. Progress and results go to
stdout, errors to stderr. Check `v` before reading fields through `data`.

```json
{"v":2,"ts":"2026-10-07T00:00:00Z","kind":"progress","data":{"fraction":0.5,"label":"Generating Take"}}
```

See the [native v2 contract](specs/native-cli.md) and
[schema](schemas/native-cli-v2.schema.json). Ctrl-C returns exit status 130 and
persists cancellation. Completed Takes survive partial failure or cancellation.
ACE-Step lacks server cancellation: attached runtime computation may continue,
although cancelled outputs are not published.

## Migration

Stop the legacy app and back up its library before native launch. The native core
imports legacy state once; it does not synchronize changes back to Tauri.
Legacy `setup model`, `run --model`, positional prompts, and v1 event fields are
not native CLI syntax. Use `settings`, `--configuration`, `--prompt`, and v2.
