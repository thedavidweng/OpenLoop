# Current Implementation Status

> **Last updated:** 2026-05-05 · This file mirrors the implementation status section from the main README and is updated alongside releases.

## Current Implementation Status (v0.1.0 Alpha)

**Completed and Live:**

- Three-column desktop shell with sidebar, generation form, and playback bar.
- First-run setup wizard with device detection, model selection, and output directory configuration.
- Settings overlay with model selection, backend controls, output path, language toggle, and CLI PATH management.
- SQLite persistence for settings, generation history, and backend events.
- Rust backend manager with ACE-Step process lifecycle, health polling, and log rotation.
- ACE-Step API client with full request/response handling and error normalization.
- Generation pipeline: validate → submit → poll → download → persist → playback.
- Audio playback with play/pause, seek, skip ±10s, volume, mute, speed control (0.5x–2x).
- Waveform display computed in Rust via Symphonia audio decoding.
- Generation history sidebar with search, click-to-load, and delete options.
- File operations: Reveal in Finder, export copy, delete file + record.
- Active task recovery: resume or discard pending generation tasks.
- Prompt enhancement ("wand" button) via ACE-Step `/format_input`.
- Random prompt inspiration (dice button).
- Model bootstrap system with download progress, ready/failed states, and persistent status banner.
- Global keyboard shortcuts (Space, Cmd+B, Cmd+N, Cmd+,, Cmd+Enter, Cmd+Shift+Enter).
- i18n support: English and Simplified Chinese (zh-CN).
- Toast notification system for success/error feedback.
- CLI mode with 16 subcommands (run, setup, list, pull, models, ps, delete, clear, stop, enhance, backend, generation, settings, status, doctor, files).
- NDJSON streaming for agent pipeline integration.
- Comprehensive test suite: frontend unit tests (Vitest) + Rust unit tests.

**Planned after v0.1:**

- Repaint / local audio region regeneration.
- Multi-model profile management.
- More robust model downloader.
- macOS signing and notarization.
- Advanced export and audio conversion options.
