# OpenLoop Release Checklist

OpenLoop v0.1 currently targets macOS Apple Silicon DMG builds.

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
- failed and cancelled generations do not appear in history;
- single-item delete removes the history row and local audio file;
- clear history removes generated audio files and leaves history empty;
- Reveal in Finder and export copy work for generated files;
- backend logs are created and old logs are pruned automatically.

## Signing and notarization

Public macOS distribution still needs Apple Developer ID signing and notarization before users should trust the DMG without manual override.

Do not mark a public stable release as ready until the release workflow is extended with the required Apple credentials and notarization steps.
