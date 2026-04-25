<h1 align="center">OpenLoop</h1>

<p align="center">
  Generate music locally on your Mac.
</p>

<p align="center">
  An open-source desktop AI music generator powered by local inference, built for the OpenMusic series.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Platform-macOS%20Apple%20Silicon-blue" alt="Platform: macOS Apple Silicon">
  <img src="https://img.shields.io/badge/Status-Alpha%20in%20development-orange" alt="Status: Alpha in development">
  <img src="https://img.shields.io/badge/OpenMusic-Series-purple" alt="OpenMusic Series">
</p>

---

## Overview

OpenLoop is an open-source macOS desktop app for generating music locally from text prompts, lyrics, duration, BPM, and other musical controls.

It is part of the **OpenMusic** series, alongside [OpenKara](https://github.com/thedavidweng/OpenKara). OpenKara turns your existing music library into a karaoke system. OpenLoop focuses on the other side of the workflow: creating new AI-generated musical ideas directly on your Mac.

OpenLoop is designed for users who want AI music generation without accounts, subscriptions, cloud uploads, or opaque creative pipelines.

> Development status: OpenLoop is currently in alpha development. The desktop shell, setup flow, SQLite persistence, backend manager, ACE-Step client, generation command path, playback, and file actions are already wired; packaging and final QA are the main remaining release tasks.

---

## OpenMusic Series

| Project | Purpose | Status |
|---|---|---|
| [OpenKara](https://github.com/thedavidweng/OpenKara) | Turn local songs into karaoke tracks with on-device AI stem separation and synced lyrics | Active |
| OpenLoop | Generate new music locally from prompts, lyrics, and musical parameters | Alpha in development |

The shared philosophy is simple: music tools should be local-first, ownership-friendly, transparent, and useful with the media and hardware you already have.

---

## Why I Built This

AI music tools are powerful, but many of them share the same problems:

1. They require subscriptions.
2. They send prompts, lyrics, and creative drafts to cloud services.
3. They hide model behavior behind closed platforms.
4. They make export, ownership, and reproducibility harder than they should be.

OpenLoop is built around a different assumption: creative tools should run where the creator works.

local AI music generation is becoming practical. OpenLoop wraps that capability in a desktop app so users can generate, preview, export, and revisit musical ideas without touching Python, terminal commands, or Gradio interfaces.

---

## Features

### Planned for v0.1 Alpha

- **Text-to-Music Generation** — Generate music from prompts such as `lo-fi warm piano, 90 BPM, no vocal`.
- **Lyrics Input** — Add lyrics with optional structure tags like `[verse]`, `[chorus]`, and `[bridge]`.
- **Local AI Backend** — Run ACE-Step locally through a managed backend process.
- **Apple Silicon Acceleration** — Use MLX on Apple Silicon with CPU/GPU execution and unified memory.
- **Duration Control** — Generate clips from short loops to longer song drafts.
- **BPM, Key, and Time Signature Controls** — Provide musical constraints for generation.
- **Seed Reproduction** — Reuse a seed to reproduce or iterate on previous results.
- **Built-in Preview Player** — Play generated audio inside the app.
- **Local Generation History** — Store prompt, lyrics, model settings, seed, and output path in a local SQLite database.
- **Export** — Save generated audio to a local output folder.
- **Local-First Privacy** — No account system, no telemetry, no prompt upload by default.

### Planned after v0.1

- Repaint / local audio region regeneration
- Better waveform display
- Multi-model profile management
- More robust model downloader
- Homebrew Cask distribution
- macOS signing and notarization
- Advanced export and audio conversion options

---

## Quick Start

### Install from Release

Prebuilt releases will be published on GitHub once the v0.1 Alpha is ready.

Target release format:

| Platform | Format | Status |
|---|---|---|
| macOS Apple Silicon | `.dmg` | Planned |
| macOS Intel | `.dmg` | Experimental / unsupported |
| Windows | N/A | Out of scope |
| Linux | N/A | Out of scope |

Until the first release is available, build from source.

---

## Build from Source

### Prerequisites

- macOS 14+ recommended
- Apple Silicon Mac recommended
- Node.js 20+
- pnpm 10+
- Rust stable toolchain
- Tauri 2 platform dependencies
- Python 3.11–3.12 for the local ACE-Step backend
- `uv` for Python environment management

### Clone and run

```bash
git clone https://github.com/thedavidweng/OpenLoop.git
cd OpenLoop
pnpm install
pnpm tauri dev
```

### Development checks

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm rust:fmt
pnpm rust:check
cargo test --manifest-path src-tauri/Cargo.toml
```

Detailed manual QA notes live in [`docs/testing.md`](docs/testing.md).

### Current implementation status

- Three-column desktop shell is live.
- First-run setup and device profile detection are implemented.
- Settings, backend controls, history, and preview panels are connected.
- SQLite stores settings and generation history locally.
- The Rust backend manager, ACE-Step client, and generation command path are in place.
- Audio preview, Reveal in Finder, export copy, and delete-file actions are available.
- Final packaging and release polish remain in progress.

### Backend setup

OpenLoop is designed to manage the local ACE-Step backend automatically, but during early development you may need to prepare the backend manually.

```bash
# Example development flow; exact scripts may change during Alpha.
uv sync
uv run acestep-api
```

The app expects the backend to expose a local HTTP API on `127.0.0.1`, with task creation, task polling, and audio download endpoints.

---

## System Requirements

| Requirement | v0.1 Target |
|---|---|
| Operating system | macOS 14+ recommended; macOS 12–13 best effort |
| CPU/GPU | Apple Silicon recommended |
| Memory | 8 GB minimum target; 16 GB+ recommended |
| Storage | Several GB for models and generated audio |
| Network | Required for first model/backend setup; offline afterward unless the user chooses otherwise |

Intel Mac support is experimental and outside the v0.1 acceptance target.

---

## AI Models

OpenLoop uses [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) as the local music generation backend.

The app targets a profile-based model setup:

| Profile | Target Device | Default Strategy |
|---|---|---|
| Low Memory | 8 GB Apple Silicon | Conservative settings, lower memory pressure |
| Standard | 16 GB+ Apple Silicon | Recommended default for v0.1 |
| Quality | 24 GB+ Apple Silicon | Higher-quality settings and larger model options |

Model files are downloaded or selected during first setup and stored locally. The application code is MIT licensed; model weights and third-party components follow their upstream licenses.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Desktop framework | [Tauri 2](https://v2.tauri.app/) | Rust backend + system WebView desktop shell |
| Frontend | React + TypeScript + Vite | App UI, generation form, player, history panel |
| Backend orchestration | Rust | Process management, API proxy, file operations, SQLite |
| AI backend | [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) | Local music generation |
| Apple Silicon inference | [MLX](https://github.com/ml-explore/mlx) | Apple Silicon CPU/GPU execution and unified memory |
| Python environment | `uv` | Reproducible local backend environment |
| Database | SQLite | Settings, generation history, backend events |
| Packaging | Tauri bundler | macOS `.dmg` release |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        OpenLoop UI                          │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ History        │  │ Generation     │  │ Preview       │ │
│  │ Sidebar        │  │ Form           │  │ Player        │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tauri Rust Backend                      │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │ Backend        │  │ ACE-Step API   │  │ SQLite +     │ │
│  │ Manager        │  │ Client         │  │ File Store   │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Local ACE-Step API Server                   │
│       Model loading · Task queue · Audio generation          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Local Output Files                     │
│        WAV / MP3 / FLAC / OGG + generation metadata         │
└─────────────────────────────────────────────────────────────┘
```

OpenLoop uses a local API server model instead of making the UI talk directly to Python. The Rust backend owns process lifecycle, health checks, request validation, file paths, local history, and user-facing error mapping.

---

## Data and Privacy

OpenLoop is local-first by design.

- Prompts stay on your Mac.
- Lyrics stay on your Mac.
- Generated audio stays on your Mac.
- History is stored in a local SQLite database.
- No account system is planned for v0.1.
- No telemetry is planned for v0.1.
- The app should only use the network for model/backend setup or user-initiated external links.

Logs should avoid storing full lyrics or complete sensitive prompts. Backend errors should be summarized into user-readable messages.

---

## Responsible Use

OpenLoop does not provide legal clearance for generated music.

Users are responsible for checking whether generated output is appropriate for publication, monetization, or commercial use. Avoid entering protected lyrics, melodies, voices, or prompts that explicitly imitate protected artists or copyrighted works. When publishing generated music, follow applicable laws and platform rules around AI-generated content disclosure.

---

## Project Structure

Planned repository layout:

```text
openloop/
  README.md
  LICENSE
  package.json
  src/
    app/
      components/
        generation/
        history/
        player/
        settings/
      lib/
        api.ts
        types.ts
        validation.ts
        store.ts
  src-tauri/
    src/
      commands/
      services/
      models/
    migrations/
    capabilities/
  docs/
    OpenLoop_PRD_Formal.md
    OpenLoop_Codex_Development_Plan.md
    architecture.md
    testing.md
```

---

## Roadmap

### v0.1 Alpha

- Tauri + React desktop shell
- First-launch setup flow
- Local backend health check
- Text-to-music generation
- Lyrics input
- Duration, BPM, language, format, and seed controls
- Built-in audio preview
- Local generation history
- Export to user output folder
- Basic error handling and logs

### v0.2 Beta

- Repaint / local region regeneration
- Better waveform visualization
- Improved model management
- Better low-memory profile handling
- More complete export options
- Homebrew Cask evaluation

### v1.0

- Stable signed macOS release
- Notarized `.dmg`
- Reliable first-launch setup
- Complete privacy and license documentation
- Reproducible release workflow

---

## Known Limitations

- v0.1 targets Apple Silicon first.
- Intel Mac support is experimental.
- First setup may require a large model download.
- Generation speed depends heavily on memory, model profile, duration, and inference settings.
- Repaint is planned after the first Alpha.
- The app does not guarantee copyright-free output.
- The current UI favors local workflow coverage and technical completeness over final visual polish.

---

## Contributing

Contributions are welcome once the initial Alpha structure is in place.

Recommended contribution areas:

- macOS packaging
- Tauri backend process management
- ACE-Step API integration
- generation history UX
- model setup diagnostics
- low-memory performance testing
- documentation

Before opening a large PR, please open an issue describing the proposed change.

---

## License

OpenLoop application code is released under the [MIT License](LICENSE).

Third-party models, libraries, and tools retain their own licenses. In particular, ACE-Step, MLX, FFmpeg, Tauri, and other dependencies should be reviewed according to their upstream license terms before redistribution.

---

## Acknowledgements

OpenLoop builds on work from the open-source music and local AI ecosystem, including:

- [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5)
- [MLX](https://github.com/ml-explore/mlx)
- [Tauri](https://v2.tauri.app/)
- The broader open-source audio tooling community

OpenLoop is part of the OpenMusic series by [David Weng](https://github.com/thedavidweng).
