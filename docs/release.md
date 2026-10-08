# Native OpenLoop Release

The release artifact is a SwiftUI app and a separate Swift CLI sharing
OpenLoopCore, packaged as an Apple Silicon DMG for macOS 15 or later.
React/Tauri/Rust are retired from main. Native Swift is the only application build.

## Build and verify

Use Xcode with Swift 6.2 or later and Node.js 24 or later. Rust, pnpm and the
legacy frontend build are not required for native release packaging.

```sh
swift build --package-path native -Xswiftc -warnings-as-errors
swift test --package-path native -Xswiftc -warnings-as-errors
node scripts/prepare-sidecars.mjs
python3 native/scripts/package-app.py \
  --uv native/binaries/uv-aarch64-apple-darwin \
  --output native/dist/OpenLoop.app \
  --dmg native/dist/OpenLoop_0.2.1_aarch64.dmg
python3 native/scripts/smoke-cli.py
node scripts/validate-readme.mjs
node scripts/validate-release-notes.mjs
```

`pnpm release:check` runs the native code/document gates, and
`pnpm release:build` builds a local `native/dist/OpenLoop.dmg` and packaged smoke.
The explicit commands above let you name a versioned candidate.

Use the current `package.json` version in the DMG filename. Packaging refuses to
replace an existing app or disk image; choose a new output path for each local
candidate. The packager signs `openloop-cli` and `uv` first, then seals the app's
resources, and runs `codesign --verify --deep --strict`. The CLI smoke verifies
signatures, bundled uv execution, resources, shared state, NDJSON v2 and SIGINT
cancellation. It uses a local HTTP fixture, not real model inference.

Mount the DMG read-only, copy OpenLoop.app to a fresh location, and repeat the
CLI smoke with `--bundle /path/to/OpenLoop.app` before testing the GUI. The DMG
contains the app and an Applications shortcut. Test with an isolated
`OPENLOOP_DATA_DIR`; see [testing.md](testing.md).

## GitHub workflow

`.github/workflows/release.yml` runs on pushed `v*` tags or a manually supplied
release tag. It checks out that tag, verifies its version against package.json,
runs native compile/tests and documentation validation, prepares the verified
uv sidecar, builds and verifies the native app/DMG, and runs the packaged smoke.
It uploads the DMG as a workflow artifact and creates a **draft** GitHub release
with [native release notes](release-notes/native.md). Tags with a suffix are
prereleases. Review the notes and hardware acceptance before publishing.

The workflow uses `GITHUB_TOKEN` to create the draft and upload its asset. It
needs no Tauri updater signing secret. The native app does not implement the
legacy Tauri updater or produce `latest.json`; existing Tauri installs must
upgrade manually to the native app. Homebrew's cask and CLI binary link must
point to the native release asset and `Contents/MacOS/openloop-cli` when that
release is published. This repository does not update the external tap.

## Signing and Gatekeeper

The Alpha distribution uses **ad-hoc signing**, explicitly `--sign -`. This is
a valid integrity signature, not a Developer ID signature or notarization.
Gatekeeper may block a quarantined download. Right-click Open if macOS permits,
or remove quarantine from your own downloaded copy:

```sh
xattr -cr /Applications/OpenLoop.app
```

Homebrew installation remains an alternative once the cask targets the native
release; verify the published asset before using `brew install --cask openloop`.

For Developer ID distribution, pass `--sign 'Developer ID Application: …'`.
The packager uses a secure timestamp and hardened runtime for that identity.
Notarization and stapling are separate release steps and require an actual
Developer ID certificate and Apple notarization credentials. Do not claim
notarization based on a passing local signature check. See Apple's
[distribution signing guide](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac/).

## Publication gate

Review the current [acceptance results](testing.md#native-macos-acceptance--2026-10-07).
Require real runtime/model installation, a completed playable Take, GUI/CLI
persistence, failure/cancellation behavior, export, confirmed deletion, packaged
relaunch, and the remaining audio/accessibility/distribution checks. Keep the
release as a draft while any required check is unverified.
