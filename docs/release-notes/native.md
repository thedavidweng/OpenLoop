# Native macOS Alpha

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

This Alpha is ad-hoc signed, not Developer ID signed or notarized. A downloaded
DMG can trigger Gatekeeper. Right-click Open if macOS permits, or run
`xattr -cr /Applications/OpenLoop.app` on your downloaded copy.
Homebrew (`brew install --cask openloop`) is an alternative after the cask has
been updated to this native release; older casks may still install Tauri.

Read [the acceptance results](https://github.com/thedavidweng/OpenLoop/blob/main/docs/testing.md)
before publishing this draft. Model rights and generated-content rights remain
subject to their respective terms; OpenLoop does not provide publication clearance.
