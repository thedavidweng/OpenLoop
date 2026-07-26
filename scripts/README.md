# Scripts

Repository automation scripts. Each entry lists purpose, input, output, how to
run it, and when to run it.

## `sync-version.mjs`

Propagates the `package.json` version to the Rust and Tauri manifests so a
single source of truth drives every build artifact.

- **Input:** `version` in `package.json`
- **Output:** rewrites `version` in `src-tauri/Cargo.toml`, the `openloop`
  package entry in `src-tauri/Cargo.lock`, and `version` in
  `src-tauri/tauri.conf.json` when they differ
- **Run:** `node scripts/sync-version.mjs` or `pnpm version:sync`
- **When to run:** automatically before `pnpm dev`, `pnpm build`, and
  `pnpm tauri` (each prefixes `pnpm version:sync`); run it directly after a
  version bump
- **Idempotent:** a second run reports `Version already synced` and writes
  nothing

## `prepare-sidecars.mjs`

Downloads and stages the `uv` sidecar binaries that the Python backend needs at
runtime.

- **Input:** none (pins `uv` version via `OPENLOOP_UV_VERSION`, default
  `0.11.7`)
- **Output:** verified `uv` binaries under `src-tauri/binaries/`, with archive
  downloads cached in `src-tauri/binaries/.cache`
- **Run:** `node scripts/prepare-sidecars.mjs` or `pnpm prepare:sidecars`
- **When to run:** before a Tauri build or Rust test that needs the sidecar;
  CI runs it before `cargo check`
- **Failure:** exits non-zero if a download or checksum verification fails

## `check-patch-coverage.mjs`

Computes patch coverage for the current branch, mirroring the Codecov `patch`
status check in `codecov.yml` (target 80%).

- **Input:** the git diff against the merge-base of `--base` (default `main`);
  runs `vitest --coverage` unless `--skip-run` reuses `coverage/lcov.info`
- **Output:** a per-file coverage report on stdout; no files written
- **Run:** `node scripts/check-patch-coverage.mjs [--base <branch>] [--threshold <n>] [--skip-run]`
  or `pnpm coverage:patch`
- **When to run:** before pushing a feature branch; the lefthook `pre-push`
  hook runs it and skips on `main`/`master`
- **Exit codes:** `0` meets threshold, `1` below threshold, `2` no diff lines
  in tracked source files

## `i18n-audit.mjs`

Compares the locale key sets between `en.json` and `zh-CN.json`.

- **Input:** `src/locales/en.json` and `src/locales/zh-CN.json`
- **Output:** a list of keys present in `en.json` but missing in `zh-CN.json`
- **Run:** `node scripts/i18n-audit.mjs` or `pnpm i18n:audit`
- **When to run:** after adding or renaming locale keys
- **Exit codes:** `0` all keys match, `1` missing keys found

## `validate-readme.mjs`

Validates `README.md` and `README_CN.md` for license and status consistency
(Apache-2.0 badges, status line, Tauri v2 CSP reference).

- **Input:** `README.md`, `README_CN.md`, and the CSP ADR
- **Output:** a pass/fail report on stdout
- **Run:** `node scripts/validate-readme.mjs` or `pnpm validate:readme`
- **When to run:** after editing the READMEs or the license/status metadata
- **Exit codes:** `0` all checks pass, `1` one or more checks fail

## `validate-release-notes.mjs`

Checks that DMG release notes document the Gatekeeper bypass (right-click Open,
`xattr -cr`) and a Homebrew alternative.

- **Input:** Markdown files under `docs/release-notes/`
- **Output:** a pass/fail report on stdout
- **Run:** `node scripts/validate-release-notes.mjs` or
  `pnpm validate:release-notes`
- **When to run:** after editing release notes
- **Exit codes:** `0` all checked notes pass, `1` one or more checks fail

## `generate-macos-liquid-glass-icon.mjs`

Compiles the Icon Composer project into macOS 26 Liquid Glass assets.

- **Input:** `src-tauri/icons/OpenLoop.icon/` (already carries its composed
  layers and background fill, so no foreground layer is extracted)
- **Prerequisites:** macOS host with Xcode `actool` (`xcrun actool`)
- **Output:** `src-tauri/icons/Assets.car` and `src-tauri/icons/OpenLoop.icns`
- **Run:** `node scripts/generate-macos-liquid-glass-icon.mjs`
- **When to run:** after changing `OpenLoop.icon/icon.json` or its layer assets
- **Non-macOS hosts:** exits `0` without writing files
- **Missing `actool`:** warns and exits `0` so hosts without full Xcode do not
  fail the build
- **Bundling:** wire `Assets.car` into the app via `tauri.conf.json`
  `bundle.resources` (owned outside this script)

## `screenshot.mjs`

Captures a Playwright screenshot of the running dev app for documentation and
manual UI inspection.

- **Input:** a dev server on `http://localhost:1420` (start `pnpm dev` first)
- **Output:** `docs/screenshots/01-initial.png` plus diagnostic logging of the
  page title, visible buttons, and inputs
- **Run:** `node scripts/screenshot.mjs`
- **When to run:** ad hoc, to refresh documentation screenshots or inspect the
  rendered UI
