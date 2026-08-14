# OpenLoop CLI Guide

`openloop` comes with a built-in CLI — the same binary as the desktop app. When you pass a subcommand, it runs headlessly. No separate install.

## Commands

### `openloop run`

Generate music from a prompt.

```bash
openloop run "lo-fi warm piano, 90 BPM"
openloop run --model pro --duration 30 --output ~/Music/beat.mp3
openloop run "epic cinematic" --json            # machine-readable output
```

| Flag            | Short | Description                                         |
| --------------- | ----- | --------------------------------------------------- |
| `--model`       | `-m`  | Model variant: `lite`, `turbo`, `pro`               |
| `--duration`    | `-d`  | Duration in seconds (10–600)                        |
| `--format`      | `-f`  | Output format: `wav`, `mp3`, `flac`, `ogg`          |
| `--output`      | `-o`  | Output file path                                    |
| `--lyrics`      | `-l`  | Lyrics text with optional `[verse]`/`[chorus]` tags |
| `--bpm`         |       | BPM (30–300)                                        |
| `--key`         |       | Key and scale (e.g. `C major`)                      |
| `--steps`       |       | Inference steps (default: 8)                        |
| `--guidance`    |       | Guidance scale (default: 7.0)                       |
| `--seed`        |       | Random seed for reproducibility                     |
| `--variations`  | `-v`  | Number of variations (1–4)                          |
| `--no-thinking` |       | Disable thinking mode                               |
| `--json`        |       | Stream NDJSON progress events to stdout             |

### `openloop enhance`

Enhance a prompt via the ACE-Step format_input API. Returns the enhanced caption together with extracted BPM, key, time signature, duration, language, and lyrics.

```bash
openloop enhance "warm piano"
openloop enhance "upbeat pop" --duration 120 --json
openloop enhance "ballad" --lyrics "[Verse]\nHello"
```

| Flag         | Short | Description                       |
| ------------ | ----- | --------------------------------- |
| `--duration` | `-d`  | Duration in seconds (10–600)      |
| `--lyrics`   | `-l`  | Include lyrics in the request     |
| `--json`     |       | JSON output of enhancement result |

### `openloop setup`

Configure default generation settings.

```bash
openloop setup                   # interactive wizard (in a terminal)
openloop setup model turbo       # set individual values
openloop setup duration 60
openloop setup --json            # show current settings as JSON
```

**Keys:** `model` (`lite`/`turbo`/`pro`), `thinking` (`on`/`off`), `duration` (10–600), `format` (`wav`/`mp3`/`flac`/`ogg`)

### `openloop list`

Show generation history.

```bash
openloop list                    # last 20 records
openloop list --limit 5          # last 5
openloop list --json             # JSON output
```

### `openloop pull`

Download a model variant before generating.

```bash
openloop pull turbo
openloop pull pro
```

### `openloop models`

List the first-party Engine / Model Pack catalog, and manage installable ACE-Step packs.

```bash
openloop models                           # list engines, slots, and announced packs
openloop models download turbo            # download an ACE-Step variant
openloop models delete turbo              # delete a downloaded variant
openloop models cancel turbo              # cancel an ongoing download
openloop models clear-partial turbo       # remove partial download artifacts
openloop models delete-all                # delete all downloaded models
```

Announced families (for example `minimax-music3/turbo`) appear in the list so a future pack can keep a stable id. They are not downloadable until an Engine adapter is bound.

| Flag     | Description                    |
| -------- | ------------------------------ |
| `--json` | JSON output                    |
| `--yes`  | Skip confirmation (delete-all) |

### `openloop ps`

Show backend process status and active generation tasks.

```bash
openloop ps
openloop ps --json
```

### `openloop delete`

Delete a generation record and its output file.

```bash
openloop delete a1b2c3d4        # full or partial ID from `openloop list`
```

### `openloop clear`

Delete all generation history and output files.

```bash
openloop clear                   # prompts for confirmation
openloop clear --yes             # skip confirmation
```

### `openloop stop`

Cancel an ongoing generation. This does **not** stop the backend process — use `openloop backend stop` for that.

```bash
openloop stop                    # cancel all active generations
openloop stop abc12345           # cancel a specific task by ID
openloop stop --kill-backend     # also stop the backend if owned by this process
```

### `openloop backend`

Manage the local ACE-Step backend process.

```bash
openloop backend status          # show backend health and port
openloop backend start           # start the backend
openloop backend stop            # stop the backend
openloop backend restart         # restart the backend
openloop backend logs            # print the backend logs path
openloop backend logs --open     # reveal logs in Finder (macOS only)
openloop backend clear-cache     # stop backend and remove runtime cache
```

| Flag     | Description |
| -------- | ----------- |
| `--json` | JSON output |

### `openloop generation`

Manage the generation lifecycle — list, cancel, resume, or discard active tasks.

```bash
openloop generation list                 # list active generation tasks
openloop generation list --json
openloop generation cancel               # cancel all active tasks
openloop generation cancel abc12345      # cancel a specific task
openloop generation cancel --kill-backend
openloop generation resume abc12345      # resume an active generation task
openloop generation discard abc12345     # discard an active task from the database
openloop generation discard abc12345 --yes
```

### `openloop status`

Show unified system status: backend health, model info, active tasks, and device info.

```bash
openloop status
openloop status --json
```

### `openloop settings`

View and modify application settings.

```bash
openloop settings                        # show all settings
openloop settings get                    # same as above
openloop settings set modelVariant turbo # set a setting
openloop settings set defaultDurationSeconds 60
openloop settings reset                  # reset runtime settings to defaults
openloop settings paths                  # show default application paths
```

**Settings keys:** `backendPort`, `defaultDurationSeconds`, `defaultAudioFormat`, `defaultThinking`, `modelVariant`, `modelDirectory`, `outputDirectory`, `logDirectory`, `language`, `firstRunCompleted`, `checkForUpdates`

| Flag     | Description                                  |
| -------- | -------------------------------------------- |
| `--json` | JSON output                                  |
| `--yes`  | Skip confirmation for destructive operations |

### `openloop doctor`

Run environment diagnostics: system info, port occupancy, app data dir, model dir, downloaded models, backend logs, database health, and settings summary.

```bash
openloop doctor
openloop doctor --json
```

### `openloop files`

File and output management.

```bash
openloop files reveal <path>       # open Finder at file location
openloop files copy <src> <dst>    # copy a file
openloop files exists <path>       # check if a file exists
openloop files read-audio <id>     # read audio bytes for a generation record
openloop files read-audio <id> --output -   # pipe raw audio to stdout
openloop files waveform <id>       # read waveform peaks
openloop files unlink <id>         # delete record and its file
openloop files unlink <id> --keep-record    # delete file only, keep DB record
```

| Flag     | Description                                 |
| -------- | ------------------------------------------- |
| `--json` | JSON output (supported by most subcommands) |

## Agent Pipelines

`openloop` is designed for AI coding agents to compose with. Paired with **[Remotion](https://github.com/remotion-dev/remotion)** (programmatic React video rendering) or **[HyperFrames](https://github.com/heygen-com/hyperframes)** (HTML-to-video for agents), an agent can build fully automated video workflows.

An agent would typically:

1. Call `openloop run "cinematic strings" --json` and parse the streaming output
2. Take the `output_path` from the completed event
3. Feed it into a Remotion composition or HyperFrames render

```bash
# Agent workflow
openloop run "cinematic strings" --duration 120 --format mp3 --output ./assets/bg.mp3 --json
openloop models --json
openloop ps --json
```

The `--json` flag streams one JSON object per line — agents can parse progress line by line:

```json
{"event":"running","variation":1,"total":1}
{"event":"completed","output_path":"/abs/path/track.wav","duration":30.0,"format":"wav"}
```

On error:

```json
{ "event": "failed", "error": "backend health timeout after 60s" }
```

All commands return exit code `0` on success, `1` on error.

## Shell Completions

Generate completion scripts for bash, zsh, fish, powershell, or elvish:

```bash
openloop completions zsh   # print zsh completion script to stdout
openloop completions bash  # print bash completion script to stdout
```

Source the output (or write it to the directory your shell loads completions from), e.g. for zsh:

```bash
openloop completions zsh > ~/.zsh/completions/_openloop
```

The `completions` command is hidden from top-level help.

## PATH Setup

If you installed via DMG, open OpenLoop → Settings → "Add to PATH" to enable the `openloop` CLI command from any terminal. Homebrew cask installs handle this automatically.
