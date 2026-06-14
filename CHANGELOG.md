# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]


### ✨ New Features

- Add CSS native conventions for desktop feel
- Prewarm emoji/CJK font fallback caches
- Add vendor chunk splitting and lazy load SettingsOverlay
- Virtualize history sidebar list with @tanstack/react-virtual
- Add macOS native window enhancements for frosted glass and smooth resize

### 🐛 Bug Fixes

- Remove duplicate pnpm version from CI and add frontend formatting to Dependabot workflow (#37)
- Disable pnpm minimum release age check in CI (#38)
- Disable pnpm minimum release age and clean up CI (#40)
- Restore cursor:pointer on text links, remove dead .user-content class
- Valid HTML semantics for virtual list, remove unused vite param
- Resolve CI typecheck and format errors in test files
- Apply oxfmt formatting to test files
- Resolve CI failures from clippy, cargo-deny, and lockfile
- Resolve all clippy warnings and cargo-deny config
- Revert rustfmt formatting and simplify deny.toml
- Remove advisories section from deny.toml to isolate CI issue
- Add missing licenses (MPL-2.0, bzip2, CC0-1.0, MIT-0) to deny.toml
- Remove deprecated [advisories] section from deny.toml
- Add Apache-2.0 WITH LLVM-exception and CDLA-Permissive-2.0 to deny.toml
- Add [advisories] version 2 with unmaintained=warn for gtk-rs
- Use correct Scope/LintLevel types for deny.toml advisories

### 📦 Dependencies

- Add Vitest coverage reporting and 60% line threshold
- Add clippy, cargo-deny, conventional commits, and bump versions

### 🔧 Chores

- **deps**: Bump cc from 1.2.62 to 1.2.63 in /src-tauri (#34)
- **deps**: Bump zip from 2.4.2 to 4.6.1 in /src-tauri (#35)
- **deps**: Bump actions/checkout from 6.0.2 to 6.0.3 (#32)
- **deps**: Bump uuid from 1.23.1 to 1.23.2 in /src-tauri (#36)
- **deps**: Bump i18next from 26.3.0 to 26.3.1 (#33)
- Migrate from Prettier to Oxfmt + Oxlint (#41)
- Change license from MIT to Apache-2.0
- Add Apache-2.0 LICENSE file
- Attribute copyright to Davy

### 🧪 Tests

- Add unit tests for i18n-dependent and browser-dependent utility modules
- Add unit tests for Zustand store slices
- Add HistorySidebar component integration tests
- Add pure utility unit tests and restructure testing guide
## [0.2.1] - 2026-06-03


### Release

- V0.2.1

### Style

- Format frontend code with Prettier

### ♻️ Refactoring

- Deepen architecture across CLI, services, and frontend

### 🐛 Bug Fixes

- Align docs with v0.2.0, harden CI, and fix Rust unwrap

### 📝 Documentation

- Update ADRs, plans, privacy policy, and release notes

### 🔧 Chores

- Bump deps (react 19.2.7, vite 8.0.16, pnpm 11) and add pnpm-workspace.yaml

### 🧪 Tests

- Add meaningful boundary and behavior tests
## [0.2.0] - 2026-05-31


### Style

- Format all files with prettier and cargo fmt
- Fix Rust formatting

### ♻️ Refactoring

- P3.1 split monolithic store.ts into Zustand slices
- P3 complete — split GenerationPanel, SettingsOverlay, and model_manager
- **settings**: Reduce SettingsOverlay to 125-line orchestrator using sections/

### ✨ New Features

- Add CLI backend vNext controls
- Phase 1 publishing blockers + Phase 2 security basics
- P1.3 model integrity + P1.4 updater infrastructure
- P4 main form UX重构 — 三层折叠、sticky CTA、prompt历史、灵感库
- P5–P8 UX improvements — favorites, undo-delete, loop playback, sticky save, setup ETA
- Complete P1 blockers + P7.3 + P8.1/8.4 per v1 readiness plan
- P7.4/7.5 settings UX + P9.1/9.2 diagnostics & error UI
- P5.1 favorite DB persistence + P4 i18n categories + P6.4 export menu + P9.3 release notes link
- P6.3/P8.3 demo mode + P2.1 CSP hardening + P2.1.4 network trust ADR
- P5.3 failed runs archive + P2.3 privacy/telemetry + P10 i18n/a11y
- P10.2 keyboard shortcuts panel + seek range aria-label
- P5.2/P5.4 History multi-select + batch toolbar
- **settings**: Split SettingsOverlay into sections/ + hooks/
- **rust**: Add export_generations_to_folder and prepare_drag_payload IPC
- **history**: A/B compare, multi-select cap at 2, batch export, drag-out support
- **provisioner**: Auto-provision ACE-Step backend on first launch

### 🐛 Bug Fixes

- Use proper CodeQL workflow with auto language detection
- Update CodeQL workflow with language matrix and v4 actions
- Replace atty with std::io::IsTerminal (Rust 1.70+)
- Address review findings for failed runs retention and favorite sorting
- A11y follow-ups from review (focus ring, backdrop click, button focus)
- **cli**: Improve error messages, delete arg parsing, and ID prefix matching
- **cli**: Improve progress display, model sync, and HTTP timeout

### 📝 Documentation

- Add v1 readiness master plan for May 2026
- Mark completed P5.3 P6.4 P7 P8 P9 and P10 items
- Align CLI docs with actual 16-command implementation
- Add CLI UX fixes plan from smoke test findings
- Update README status to v0.2.0

### 📦 Dependencies

- Auto-format Rust code in Dependabot PRs
- Use dynamic release notes path based on tag

### 🔧 Chores

- **deps**: Bump tauri from 2.11.0 to 2.11.1 in /src-tauri
- Remove atty from Cargo.lock
- Add npm audit auto-block to CI workflows
- Add config.json to .gitignore
- **i18n**: Add P6–P8 translation keys (player, settings, setup, shortcuts)
- Merge dependabot dependency updates
- Finish github actions dependency updates
- Bump version to v0.2.0
- Update Cargo.lock version
- **deps**: Bump tar from 0.4.45 to 0.4.46 in /src-tauri (#31)
- **deps**: Bump i18next from 26.2.0 to 26.3.0 (#30)
- **deps-dev**: Bump vitest from 4.1.6 to 4.1.7 (#29)
- **deps**: Bump serde_json from 1.0.149 to 1.0.150 in /src-tauri (#28)
- **deps**: Bump rusqlite from 0.39.0 to 0.40.0 in /src-tauri (#26)
- **deps**: Bump react-i18next from 17.0.6 to 17.0.8 (#25)
- **deps-dev**: Bump @types/react from 19.2.14 to 19.2.15 (#24)
- **deps-dev**: Bump vite from 8.0.13 to 8.0.14

