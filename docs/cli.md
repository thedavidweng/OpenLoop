# OpenLoop CLI Guide

`openloop` comes with a built-in CLI — the same binary as the desktop app. When you pass a subcommand, it runs headlessly. No separate install.

## Commands

### `openloop run`

Generate music from a prompt.

```bash
openloop run "lo-fi warm piano, 90 BPM"
openloop run --model pro --duration 30 --output ~/Music/beat.mp3
openloop run "epic cinematic" --ndjson        # machine-readable output
```

| Flag | Short | Description |
|------|-------|-------------|
| `--model` | `-m` | Model variant: `lite`, `turbo`, `pro` |
| `--duration` | `-d` | Duration in seconds (10–600) |
| `--format` | `-f` | Output format: `wav`, `mp3`, `flac`, `ogg` |
| `--output` | `-o` | Output file path |
| `--lyrics` | `-l` | Lyrics text with optional `[verse]`/`[chorus]` tags |
| `--bpm` | | BPM (30–300) |
| `--key` | | Key and scale (e.g. `C major`) |
| `--seed` | | Random seed for reproducibility |
| `--variations` | `-v` | Number of variations (1–4) |
| `--no-thinking` | | Disable thinking mode |
| `--ndjson` | | Stream NDJSON progress events to stdout |

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

List available models and their download status.

```bash
openloop models
openloop models --json
```

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

Stop the ACE-Step backend process.

```bash
openloop stop
```

## Agent Pipelines

`openloop` is designed for AI coding agents to compose with. Paired with **[Remotion](https://github.com/remotion-dev/remotion)** (programmatic React video rendering) or **[HyperFrames](https://github.com/heygen-com/hyperframes)** (HTML-to-video for agents), an agent can build fully automated video workflows.

An agent would typically:

1. Call `openloop run "cinematic strings" --ndjson` and parse the streaming output
2. Take the `output_path` from the completed event
3. Feed it into a Remotion composition or HyperFrames render

```bash
# Agent workflow
openloop run "cinematic strings" --duration 120 --format mp3 --output ./assets/bg.mp3 --ndjson
openloop models --json
openloop ps --json
```

The `--ndjson` flag streams one JSON object per line — agents can parse progress line by line:

```json
{"event":"running","variation":1,"total":1}
{"event":"completed","output_path":"/abs/path/track.wav","duration":30.0,"format":"wav"}
```

On error:

```json
{"event":"failed","error":"backend health timeout after 60s"}
```

All commands return exit code `0` on success, `1` on error.

## PATH Setup

If you installed via DMG, open OpenLoop → Settings → "Add to PATH" to enable the `openloop` CLI command from any terminal. Homebrew cask installs handle this automatically.
