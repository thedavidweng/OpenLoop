# Native Implementation Status

Updated October 7, 2026. The active product is the SwiftUI application and
separate Swift CLI in `native/`, sharing OpenLoopCore. React/Tauri/Rust are
retained only as migration references.

Implemented: Projects, Compose, multiple Takes, A/B listening, waveform selection
and looping, Repaint requests, seed reproduction/variation, Artifacts/export,
cross-project History/search/favorites, native Settings and license-gated setup,
ACE-Step runtime/model management, SQLite persistence and one-time legacy import,
crash recovery/cancellation, and NDJSON v2.

Release packaging signs the native bundle, creates an Apple Silicon DMG, verifies
integrity, and runs packaged CLI smoke tests. The GitHub workflow creates a draft
native release. The Alpha is ad-hoc signed; Developer ID signing and notarization
require distribution credentials. The UI is English-only and has no updater.

See [current acceptance evidence and remaining gates](testing.md#native-macos-acceptance--2026-10-07),
[native architecture](../native/README.md), [CLI guide](cli.md), and
[release procedure](release.md). Roadmap: [GitHub issues](https://github.com/thedavidweng/OpenLoop/issues).
