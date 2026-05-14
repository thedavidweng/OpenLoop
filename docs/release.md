# OpenLoop Release Checklist

OpenLoop v0.1.0 targets macOS Apple Silicon DMG builds, distributed via Homebrew Cask and direct download.

## Release readiness

A release candidate must pass:

```bash
pnpm install --frozen-lockfile
pnpm release:check
pnpm release:build
```

`pnpm release:check` runs the frontend typecheck, frontend unit tests, frontend production build, Rust format check, Rust compile check, and Rust tests.

`pnpm release:build` prepares the bundled `uv` sidecar and runs `tauri build`.

## GitHub release workflow

The release workflow lives in `.github/workflows/release.yml`.

It runs on:

- `workflow_dispatch` with a required tag input, for example `v0.1.0-alpha.1`.
- pushed tags matching `v*`.

The workflow:

- installs dependencies with `pnpm install --frozen-lockfile`;
- runs `pnpm release:check`;
- builds the macOS Apple Silicon Tauri DMG;
- creates a draft prerelease with `tauri-apps/tauri-action`;
- uploads the DMG as a workflow artifact.

Keep GitHub releases as drafts until manual QA is complete.

## Manual QA gate

Before publishing a release, install the generated DMG and verify:

- the app launches outside development mode;
- first-run setup completes;
- model bootstrap can reach a ready state;
- generation creates a playable output file;
- failed and cancelled generations are handled correctly (failed recorded for debugging, cancelled not in history);
- single-item delete removes the history row and local audio file;
- clear history removes generated audio files and leaves history empty;
- Reveal in Finder and export copy work for generated files;
- backend logs are created and old logs are pruned automatically (keeps last 20);
- CLI `openloop run` generates headlessly and saves to disk;
- CLI `openloop list --json` outputs valid JSON matching GUI history.

## Gatekeeper and code signing

OpenLoop uses **Ad-hoc code signing** (no Apple Developer ID required). This means macOS Gatekeeper will show a security warning on first launch for DMG installs.

**Bypass options:**
- **Homebrew** (recommended): `brew tap thedavidweng/tap && brew install --cask openloop` — automatically clears quarantine.
- **Manual**: Right-click the app → **Open** on the first launch.
- **Terminal**: `xattr -cr /Applications/OpenLoop.app`

> Apple Developer ID signing and notarization will be added before a stable public release. Until then, Ad-hoc signing is the intentional distribution strategy for the open-source Alpha phase.

## GitHub release workflow prerequisites

Before publishing a release, ensure:
- The `TAURI_SIGNING_PRIVATE_KEY` GitHub Secret is set (for updater signature verification).
- `latest.json` is published alongside the DMG so the in-app updater can detect new versions.
