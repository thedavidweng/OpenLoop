[简体中文](./README_CN.md)

> Native macOS Alpha: SwiftUI app, separate Swift CLI, and shared Swift core. Requires Apple Silicon and macOS 15+.

<div align="center">

<img src="./src-tauri/icons/1024x1024.png" alt="OpenLoop app icon" width="160" height="160" />

# OpenLoop

**Generate music locally on your Mac.**

An open-source desktop AI music generator powered by local inference, built for the OpenMusic series.

[![CI](https://github.com/thedavidweng/OpenLoop/actions/workflows/ci.yml/badge.svg)](https://github.com/thedavidweng/OpenLoop/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/thedavidweng/OpenLoop?include_prereleases&label=release)](https://github.com/thedavidweng/OpenLoop/releases)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](./LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20%28Apple%20Silicon%29-lightgrey)

![Status](https://img.shields.io/badge/Status-v0.2.1%20Alpha-orange)
![OpenMusic](https://img.shields.io/badge/OpenMusic-Series-purple)

</div>

---

## Native workspace

**v0.2.1 Alpha**

Organize music into Projects, generate Takes from prompts and lyrics, compare A/B,
reproduce a seed or create variations, select a waveform region for loop playback
or Repaint, and export Artifacts. History supports search and favorites across
Projects. Settings installs the pinned ACE-Step runtime and Model Packs locally.
MiniMax Music 3 is announced but unavailable. The UI is currently English-only.
The current pinned backend can exceed 16 GB memory even in Lite; limited-memory
Macs may swap heavily. See the measured acceptance results before installing.

These are actual packaged-app screenshots from an isolated test library. Workspace Takes use synthetic WAV test audio. The History capture shows a real
10-second Lite generation with seed 42; screenshots do not assess listening quality. See [acceptance results](docs/testing.md#native-macos-acceptance--2026-10-07).

**Compose, Takes, and inspector — dark appearance**

![Native OpenLoop workspace with two test Takes and A/B comparison](docs/screenshots/native-workspace.jpg)

<details>
<summary>Light appearance, History, model catalog, and first-time setup</summary>

![Native OpenLoop workspace in light appearance](docs/screenshots/native-workspace-light.jpg)

![Native History with a real generated Take, seed 42, and audio transport](docs/screenshots/native-history.jpg)

![Native model catalog with download sizes and unavailable models](docs/screenshots/native-models.jpg)

![Native first-time setup with compatibility checks and license review](docs/screenshots/native-setup.jpg)

</details>

## Installation

The native release workflow builds an Apple Silicon DMG and creates a draft release.
Download the **native** DMG when published in [Releases](https://github.com/thedavidweng/OpenLoop/releases),
then drag OpenLoop to Applications. Older release assets and the Homebrew cask may
still install the retiring Tauri app; verify the asset before upgrading.

This Alpha is ad-hoc signed, not Developer ID signed or notarized. If Gatekeeper
blocks your downloaded copy, use the release instructions in [docs/release.md](docs/release.md).
The native app has no built-in updater.

Before upgrading, stop the legacy app and back up its library. Native imports
legacy state once without moving original audio. Native GUI and CLI share their
library; changes do not synchronize back to the retiring app. Use
`OPENLOOP_DATA_DIR=/tmp/openloop-native-test` to isolate GUI evaluation, and
`--data-dir /tmp/openloop-native-test` for CLI evaluation.

## CLI

The headless executable is separate from the GUI:

```sh
CLI=/Applications/OpenLoop.app/Contents/MacOS/openloop-cli
"$CLI" catalog --json
"$CLI" setup --accept-license
"$CLI" models install ace-step/standard --accept-license
"$CLI" run --configuration ace-step/lite --prompt 'gentle piano' --duration 10 --json
"$CLI" list --json
```

Read the catalog licenses before accepting them. Setup downloads a Python runtime
and dependencies; Model Packs download several GB. Generation runs locally.
Native `--json` emits **NDJSON v2**; legacy v1 scripts must migrate.
[CLI guide](docs/cli.md) · [v2 contract](docs/specs/native-cli.md).

## Build from source

Requires Apple Silicon, macOS 15+, Swift 6.2+ and Node.js 24+ for sidecar preparation.

```sh
swift build --package-path native -Xswiftc -warnings-as-errors
swift test --package-path native -Xswiftc -warnings-as-errors
node scripts/prepare-sidecars.mjs
python3 native/scripts/package-app.py --uv src-tauri/binaries/uv-aarch64-apple-darwin
python3 native/scripts/smoke-cli.py
```

[Native architecture and development](native/README.md) · [Release packaging](docs/release.md).
React/Tauri/Rust remain migration references, not the native release target.

## OpenMusic Series

[OpenKara](https://github.com/thedavidweng/OpenKara) turns local songs into karaoke
with on-device stem separation and synced lyrics. OpenLoop generates new music
locally. Both favor local processing and user ownership.

## Contributing

Open an issue before a large change. See [GitHub issues](https://github.com/thedavidweng/OpenLoop/issues)
for the roadmap and [testing.md](docs/testing.md) for acceptance coverage.

## License

OpenLoop application code uses the [Apache License 2.0](LICENSE).
Third-party runtimes, models and tools retain their own license terms. Generated
content is not guaranteed copyright-free; review the model and content terms
before distribution.

## Acknowledgements

Built on [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5),
[MLX](https://github.com/ml-explore/mlx), and open-source audio tooling.
Part of the OpenMusic series by [David Weng](https://github.com/thedavidweng).
