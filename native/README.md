# Native OpenLoop

The #261 native architecture lives in this Swift package. It targets macOS 15+
Apple Silicon, Swift 6.2+. The desktop target intentionally has an empty SwiftUI
root: UI implementation is a separate handoff. The existing Tauri app remains a
behavioral reference until native product parity is verified, not a second
long-term architecture.

## Build and test

```sh
swift build --package-path native -Xswiftc -warnings-as-errors
swift test --package-path native
swift run --package-path native openloop-cli help
python3 native/scripts/package-app.py --uv src-tauri/binaries/uv-aarch64-apple-darwin
```

Use `--data-dir /tmp/openloop-native-test` while evaluating migration/builds.
Stop the legacy app before first native launch and back up its database. Native
GUI and CLI share `~/Library/Application Support/com.openmusic.openloop/openloop.sqlite3`.
Legacy state is imported once into `native_objects` in one transaction, without
moving Output Files or destroying the legacy tables. There is no bidirectional
synchronization with the retiring Rust application. Native events use explicit
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
- `OpenLoopApp`: SwiftUI entry point and `@MainActor @Observable` presentation
  state. No Project/History/generation rules live in views.

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
swift run --package-path native openloop-cli --uv src-tauri/binaries/uv-aarch64-apple-darwin \
  --data-dir /tmp/openloop-native-test run --configuration ace-step/lite \
  --prompt 'gentle piano' --duration 10 --accept-license --json
```

`--accept-license` installs the selected runtime/model if needed before submission
and can download several GB. The UI should present the catalog's licenses before
calling install. Models use the configured HTTPS download base, defaulting to
Hugging Face. Runtime source is pinned to a full commit; uv manages Python and
project dependencies. Swift never loads inference weights into the app process.

Owned runtime startup/shutdown and health/readiness deadlines live behind the
Engine adapter. An attached process is never terminated by another client.
ACE-Step has no server cancellation endpoint: cancellation stops waiting and
publication of late outputs while computation may continue. Backend-impacting
Settings take effect on the next runtime start; stop/reopen the owned runtime
before using new runtime settings. No automatic restart is implied.

## Parity boundary

Automated tests exercise the fake Engine lifecycle, SQLite migration/persistence,
CLI v2 events, ACE-Step submit/poll/download and seed mapping, and deterministic
native waveform/selection behavior. An unsigned app bundle is buildable. This is
not yet a signed/notarized production release. Real-model bootstrap/generation,
audio hardware routing, Finder/DAW drag, GUI recovery/accessibility, notifications,
and packaged relaunch/coexistence still require the Apple Silicon smoke matrix
after the UI is implemented. Only then retire React/Tauri/Rust, their mirrored
catalog and obsolete build/release dependencies.
