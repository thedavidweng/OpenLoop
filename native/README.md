# Native OpenLoop

The #261 native architecture lives in this Swift package. It targets macOS 15+
Apple Silicon, Swift 6.2+. The catalog recommends 24 GB memory for the
pinned inference runtime; the 16 GB acceptance host swaps heavily. The SwiftUI app implements the creative workflow:
Project → Compose → Takes → listen / A-B compare → reproduce or vary → Export,
plus cross-project History. React/Tauri/Rust have been retired from main. Git history preserves the old app;
the native import still supports existing user libraries.

## Build and test

```sh
swift build --package-path native -Xswiftc -warnings-as-errors
swift test --package-path native
swift run --package-path native openloop-cli help
python3 native/scripts/package-app.py --uv native/binaries/uv-aarch64-apple-darwin
python3 native/scripts/smoke-cli.py
```

Use `--data-dir /tmp/openloop-native-test` while evaluating migration/builds.
The GUI accepts the same overrides through `OPENLOOP_DATA_DIR` and `OPENLOOP_UV`
(for example `open -n --env OPENLOOP_DATA_DIR=/tmp/openloop-native-test
native/dist/OpenLoop.app`). The bundle contains `OpenLoop` (GUI), `openloop-cli`
and `uv`; the CLI keeps its `-cli` suffix because a case-insensitive volume would
otherwise let `openloop` replace the GUI executable.
Stop the legacy app before first native launch and back up its database. Native
GUI and CLI share `~/Library/Application Support/com.openmusic.openloop/openloop.sqlite3`.
Legacy state is imported once into `native_objects` in one transaction, without
moving Output Files or destroying the legacy tables. There is no bidirectional
synchronization with the historical Rust application. Native events use explicit
NDJSON **v2**; existing v1 scripts must migrate to the new envelope described in
`docs/specs/native-cli.md`.

## Boundaries

- `OpenLoopCore`: engine-neutral requests, Projects, Takes, Generation Tasks,
  completed Generation Records, multiple Artifacts, shared Settings, installation
  state, SQLite transactions, history deletion/export, and crash recovery.
- `OpenLoopEngines`: the single native catalog, Runtime compatibility, licenses,
  model download manifests, installation, and ACE-Step HTTP/process adapter.
- `OpenLoopAudio`: AVAudioPlayer audition/A/B switching, deterministic audio
  selection, and bounded-buffer AVAudioFile waveform decoding.
- `OpenLoopCLIKit` and `openloop-cli`: headless commands calling the core.
- `OpenLoopAppKit`: SwiftUI scenes, views, menu commands, and `@MainActor
  @Observable` presentation state (`WorkspaceModel`, `PlaybackModel`). No
  Project/History/generation rules live in views; they call Core. Compose shows
  only controls the selected configuration's capabilities support. Expert
  options are curated per Engine (`EngineAdvancedSection`), never generated from
  a schema. `OpenLoopApp` is only the `@main` entry point.

`Engine.generate` is the primary test seam. Engines write results only into the
Core-provided per-Generation directory and return local Artifacts plus the actual
seed and metadata. Core commits each completed Take independently. If a later
Take fails or is cancelled, already completed Takes remain in History; no failed
or cancelled attempt becomes a Generation Record. An OS lease serializes
execution across native GUI/CLI and identifies interrupted tasks on relaunch.

`EngineCatalog.firstParty` is authoritative for Engine, Runtime, Model Pack,
configuration, capability, hardware recommendation and license data. Core never
branches on the active Engine name. ACE advanced settings are versioned and
validated by `AceStepEngine`, not arbitrary form schemas.

## Runtime operation

Prepare the verified uv sidecar with the existing `pnpm prepare:sidecars` script
before packaging. The app bundles it next to GUI/CLI executables; developer CLI
runs can specify `--uv PATH`. No system uv/Python lookup is used for inference.

```sh
swift run --package-path native openloop-cli catalog --json
swift run --package-path native openloop-cli --uv native/binaries/uv-aarch64-apple-darwin \
  --data-dir /tmp/openloop-native-test run --configuration ace-step/lite \
  --prompt 'gentle piano' --duration 10 --accept-license --json
```

`--accept-license` installs the selected runtime/model if needed before submission
and can download several GB. The UI should present the catalog's licenses before
calling install. The pinned backend validates a base DiT and 1.7B language-model
checkpoint even for Lite/XL selections, so Standard downloads about 11.46 GB and
XL about 30.05 GB. The Lite configuration leaves the language model unloaded and disables
format/CoT requests; Planning On requires a configuration with a language model.
Model Python code is synchronized from the pinned runtime, not downloaded as
mutable model assets. Startup explicitly loads models and queries
`/v1/model_inventory`; `/v1/models` is the OpenRouter compatibility list.
Models use the configured HTTPS download base, defaulting to
Hugging Face. Runtime source is pinned to a full commit; uv manages Python and
project dependencies. OpenLoop constrains MLX to 0.31.1: newer MLX changed
stream ownership and fails when this pinned API loads on one thread and generates
on another ([upstream issue](https://github.com/ml-explore/mlx-lm/issues/1181)).
Setup upgrades an existing managed runtime's constraint; startup checks it too. Swift never loads inference weights into the app process.

CLI exit stops its owned runtime; an attached runtime is left running.
Owned runtime startup/shutdown and health/readiness deadlines live behind the
Engine adapter. An attached process is never terminated by another client.
ACE-Step has no server cancellation endpoint: cancellation stops waiting and
publication of late outputs while computation may continue. Backend-impacting
Settings take effect on the next runtime start; stop/reopen the owned runtime
before using new runtime settings. No automatic restart is implied.

## Parity boundary

Automated tests exercise the fake Engine lifecycle, SQLite migration/persistence,
CLI v2 events, ACE-Step submit/poll/download and seed mapping, and deterministic
native waveform/selection behavior. The packager produces an ad-hoc signed app and optional DMG, verified by
`codesign --verify --deep --strict`. This is not Developer ID signing or
notarization; see [release.md](../docs/release.md). App tests drive `WorkspaceModel`
through a scripted Engine (capability gating, setup gating, retry, reproduction,
region edits, deletion). Repaint uses the waveform selection on the loaded Take;
Extend appears only for Engines that claim it, which ACE-Step 1.5 does not. Real-model bootstrap/generation, audio hardware playback/seek/A-B,
Finder/DAW drag, notifications, VoiceOver, and packaged relaunch/coexistence
still require the Apple Silicon smoke matrix before public release. The owner
authorized old-stack retirement after native integration; these remaining
manual publication gates are not marked passed.

Current packaged visual, integration and real-model acceptance results are recorded
in [testing.md](../docs/testing.md#native-macos-acceptance--2026-10-07).
