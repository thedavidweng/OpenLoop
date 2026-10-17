# OpenLoop 0.2.2 — Signed native macOS release

OpenLoop now uses a native SwiftUI workspace and a separate Swift CLI backed by
one shared Swift core. Requires Apple Silicon and macOS 15 or later.

- Organize ideas into Projects, create Takes, compare A/B, reproduce a recorded
  seed, or make a new variation.
- Listen with the native waveform/player, select a region to loop or Repaint,
  and export audio and other Artifacts.
- Browse completed Takes across Projects in History, search and filter favorites.
- Set up ACE-Step runtime and Model Packs locally. MiniMax Music 3 remains
  announced and unavailable for installation.
- Run `OpenLoop.app/Contents/MacOS/openloop-cli help` for the headless interface.
  `--json` uses NDJSON **v2**; migrate legacy v1 consumers before upgrading.

Stop the legacy app and back up its library before the first native launch.
The native core imports legacy state once without moving original audio files.
The historical Tauri app does not synchronize back from the native library.
The native UI is currently English-only and has no built-in updater.
The pinned backend can exceed 16 GB memory in Lite and cause heavy swapping;
review the measured acceptance results before installing on a low-memory Mac.

## Gatekeeper

Release artifacts are signed with Developer ID Application and notarized by Apple.
The app and DMG include stapled notarization tickets. Open the DMG and drag
OpenLoop to Applications; no quarantine removal is needed.
Homebrew (`brew install --cask openloop`) is an alternative once the cask points
to this release; check its version before installing.

## Validation and known limits

Native compilation with warnings treated as errors, all 40 Swift tests,
documentation/CLA checks, bundle integrity and packaged CLI smoke pass.
Real Lite inference has completed on the owner's Apple Silicon Mac.

Auditory quality, real Repaint output, Finder/DAW
drag, notifications, VoiceOver, macOS 15 behavior, clean-machine/quarantined
installation and legacy/native coexistence have not been fully verified.
The release workflow verifies Developer ID signatures, Apple notarization
acceptance, stapled tickets, and Gatekeeper assessment before uploading artifacts.

Read [the acceptance results](https://github.com/thedavidweng/OpenLoop/blob/main/docs/testing.md)
for the measured results and remaining checks. Model rights and generated-content rights remain
subject to their respective terms; OpenLoop does not provide publication clearance.
