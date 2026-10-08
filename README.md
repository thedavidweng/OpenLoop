<div align="center">

<img src="./native/Assets/1024x1024.png" alt="OpenLoop app icon" width="128" height="128" />

# OpenLoop

**Generate music locally on your Mac.**

[![CI](https://github.com/thedavidweng/OpenLoop/actions/workflows/ci.yml/badge.svg)](https://github.com/thedavidweng/OpenLoop/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/thedavidweng/OpenLoop?include_prereleases&label=release)](https://github.com/thedavidweng/OpenLoop/releases)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](./LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%2015%2B%20%C2%B7%20Apple%20Silicon-lightgrey)

[Website](https://openloop.blahaj.uk) · [Download](https://github.com/thedavidweng/OpenLoop/releases) · [CLI](docs/cli.md) · [简体中文](./README_CN.md)

<img src="docs/screenshots/workspace-dark.png" alt="OpenLoop workspace with a project, two generated Takes, and the Take inspector" width="900" />

</div>

OpenLoop is a native macOS app for AI music generation. It runs open models such as
[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) entirely on your machine:
no account, no upload, and the generated files stay on your Mac.

> [!NOTE]
> **v0.2.2 Alpha.** The app is ad-hoc signed and not yet notarized. The pinned
> ACE-Step runtime can use more than 16 GB of memory even with the Lite model, so
> Macs with 16 GB or less may swap heavily. 24 GB or more is recommended.

## Features

- **Projects and Takes.** Write a prompt and optional lyrics, then generate one or
  more Takes per idea.
- **Compare and iterate.** Switch between two Takes with A/B playback, reproduce a
  Take from its seed, or create variations.
- **Loop and Repaint.** Select part of a waveform to loop it, or regenerate only
  that region.
- **History.** Search and favorite every generation across Projects.
- **Local model management.** Install the runtime and Model Packs from Settings,
  with download sizes and licenses shown up front.
- **Scriptable CLI.** A headless `openloop-cli` shares the same library and emits
  NDJSON for automation.

<details>
<summary>More screenshots</summary>
<br />

| Light appearance | History |
| --- | --- |
| ![Workspace in light appearance](docs/screenshots/workspace-light.png) | ![History with search and favorites](docs/screenshots/history.png) |

| Models | First-time setup |
| --- | --- |
| ![Model catalog with download sizes and licenses](docs/screenshots/models.png) | ![First-time setup with compatibility checks and license review](docs/screenshots/setup.png) |

</details>

## Install

1. Download the native Alpha DMG from [Releases](https://github.com/thedavidweng/OpenLoop/releases/tag/v0.2.2-alpha.1).
2. Drag OpenLoop to Applications.
3. Open the app and follow the first-time setup to install the engine and a model.

If Gatekeeper blocks the app, see [docs/release.md](docs/release.md). Upgrading from
the earlier Tauri version? Back up your library first; the native app imports it once
and leaves your original audio in place.

## Command line

The CLI ships inside the app bundle:

```sh
CLI=/Applications/OpenLoop.app/Contents/MacOS/openloop-cli
"$CLI" setup --accept-license
"$CLI" models install ace-step/standard --accept-license
"$CLI" run --configuration ace-step/lite --prompt 'gentle piano' --duration 10
"$CLI" list --json
```

See the [CLI guide](docs/cli.md) and the [NDJSON v2 contract](docs/specs/native-cli.md).

## Build from source

Requires Apple Silicon, macOS 15+, Swift 6.2+, and Node.js 24+.

```sh
swift build --package-path native
swift test --package-path native
node scripts/prepare-sidecars.mjs
python3 native/scripts/package-app.py --uv native/binaries/uv-aarch64-apple-darwin
```

The app is written to `native/dist/OpenLoop.app`. See [native/README.md](native/README.md)
for the architecture and [docs/release.md](docs/release.md) for packaging.

## Contributing

Issues and pull requests are welcome. Please open an issue before a large change.
Contributors sign the [CLA](CLA.md) with a PR comment; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

OpenLoop is licensed under the [GNU AGPL-3.0-only](LICENSE). Earlier Apache-2.0
grants remain valid; see [LICENSING.md](LICENSING.md). Models and runtimes keep their
own licenses, and generated audio is not guaranteed to be free of copyright claims.
Review the model terms before you distribute what you make.

## Acknowledgements

Built on [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) and
[MLX](https://github.com/ml-explore/mlx). OpenLoop is part of the OpenMusic series
with [OpenKara](https://github.com/thedavidweng/OpenKara), by
[David Weng](https://github.com/thedavidweng).
