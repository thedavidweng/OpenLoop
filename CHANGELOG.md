# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]


### ♻️ Refactoring

- **model-manager**: Split mod.rs into focused submodules (#53) (#121)
- Extract shared utilities to eliminate code duplication
- Split generation.ts and model.ts store slices below 250 lines (#138)
- Production-readiness hardening across backend and frontend (#150)

### ⚡ Performance

- Add SQL LIMIT to list_generations, wire CLI --limit to DB (#59)
- Add SQL LIMIT to list_generations, wire CLI --limit to DB (#59)
- Use Set-based O(1) membership lookups in history render loop (#137)

### ✨ New Features

- Add CSS native conventions for desktop feel
- Prewarm emoji/CJK font fallback caches
- Add vendor chunk splitting and lazy load SettingsOverlay
- Virtualize history sidebar list with @tanstack/react-virtual
- Add macOS native window enhancements for frosted glass and smooth resize
- Add history created_at index migration
- Add network activity log viewer
- **cli**: Add shell completion generation
- **cli**: Add --version flag (#51)
- **cli**: Add --from-history flag for replaying generations (#54)
- Structured tracing observability (#62)
- Structured tracing observability (#62)
- **cli**: Make spec.rs the single CLI source of truth (#58) (#120)
- Multi-mirror model download with automatic failover (#50) (#125)
- Player & export improvements — AB-loop, drag export, overflow delete (#56) (#126)
- Add Settings log viewer with level filtering (#136)
- Add project concept for grouping generations (#65) (#140)
- Add generation profile management (#71) (#141)
- Accessibility improvements, high contrast mode, i18n audit (#139)
- **shell**: Launch hidden with first-paint reveal and fix the updater pipeline
- **ui**: Adopt the monochrome control language and fill the locale gaps
- **shell**: Adopt official plugins, stream audio via the asset protocol, and fix a macOS 26 launch abort
- Add a first-party engine and model-pack catalog
- **native**: Add shared Swift core and engine foundation for #261
- **native**: Implement SwiftUI creative workspace for #261
- **native**: Add engine-neutral edit region with Repaint and Extend UI

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
- Resolve 4 CLI UX bugs from issue #57 (#76)
- Pin action SHA, remove test.txt, add permissions
- Correct mirror action SHA
- Add force_push and fetch-depth: 0
- Resolve dependency audit vulnerabilities
- Use composite index matching history query sort order
- Address Greptile review on docs validation
- Instrument network log call sites + cap entries + Date isNaN
- Address Greptile review on CLI completions
- **observability**: Address Greptile review and CI advisory ignores
- Box tauri path error in setup closure
- **ci**: Use cargo audit --manifest-path for audit.toml discovery
- **ci**: Run cargo audit from src-tauri for config discovery
- **ci**: Place audit.toml in src-tauri/.cargo for cargo-audit discovery
- **observability**: Fall back to stderr when per-event log open fails
- **observability**: Flush stderr fallback when log file open fails
- Use bound LIMIT parameter and ignore RUSTSEC-2026-0194/0195
- **db**: Collect list_generations rows within each match arm
- Use cargo audit manifest path and simplify limit cast
- **ci**: Run cargo audit from src-tauri for config discovery
- **ci**: Place audit.toml in src-tauri/.cargo for cargo-audit discovery
- Correct migration test comment and ignore RUSTSEC-2026-0194/0195
- **ci**: Use cargo audit --manifest-path for audit.toml discovery
- **ci**: Run cargo audit from src-tauri for config discovery
- **ci**: Place audit.toml in src-tauri/.cargo for cargo-audit discovery
- Address Greptile review and CI failures for error handling PR
- Format checks and add store-helpers unit tests
- **player**: Prevent zero-width AB-loop from freezing playback
- **player**: Test AB-loop seek guard and extract loop helpers
- Harden against zip-slip, path traversal, format injection, and CSP wildcard
- Use component-based traversal check instead of canonicalize
- Harden zip extraction against absolute paths and escapes
- Resolve zip paths lexically without requiring parent dirs
- Handle Prefix path component on all platforms in zip guard
- Reject parent-dir components before lexical zip path resolution
- Remove unused flush_archive_warning helper
- Anchor regex in validate-readme to prevent URL host bypass (CodeQL #2)
- Satisfy knip and cover announced catalog cards
- **native**: Preserve runtime settings, seeds and cancellation semantics
- **native**: Await cancelled generation cleanup before CLI exit
- **native**: Validate packaged CLI signal cancellation
- **native**: Size main window minimum to fit all workspace columns
- **native**: Validate real inference and native release packaging
- **native**: Reproduce surviving variations after parent deletion
- Verify native reproduction and store CLA signatures without branches
- **native**: Address task recovery audio loops and CLI review regressions

### 📝 Documentation

- Sync README badges, fix license refs to Apache-2.0 (#77)
- Check off completed items in v1 readiness plan (#78)
- Add SECURITY.md and RESPONSIBLE_USE.md (#79)
- Add NDJSON event schema specification (#80)
- Remove completed plans and stale docs
- Add mise install step to contributing guide
- Regenerate changelog for native foundation
- Regenerate changelog after cancellation fix
- Refresh generated native changelog
- Regenerate changelog for native workspace UI
- Regenerate changelog for native region edits
- Regenerate changelog for native window minimum fix
- Regenerate changelog for native integration
- Refresh native acceptance regression evidence

### 📦 Dependencies

- Add Vitest coverage reporting and 60% line threshold
- Add clippy, cargo-deny, conventional commits, and bump versions
- Add Codecov config and upload coverage
- Add Test Analytics — JUnit upload to Codecov
- Add Codeberg mirror workflow
- Use node --run instead of pnpm for package scripts
- **mirror**: Serialize Codeberg pushes to avoid ref lock races (#127)
- Add workflow_dispatch issue hygiene for resolved issues (#128)
- Trigger issue hygiene workflow on merge (#129)
- Remove one-shot issue-hygiene workflow and trigger file (#130)
- Skip mirror workflow on dependabot branches
- **deps**: Bump reviewdog/action-actionlint from 1.72.0 to 1.73.0 (#187)
- **deps**: Bump zizmorcore/zizmor-action from 0.6.0 to 0.6.2 (#188)
- Make Dependabot PRs merge-ready (#197)
- **deps**: Bump the codeql-action group with 3 updates (#199)
- **deps**: Bump reviewdog/action-actionlint from 1.73.0 to 1.73.1 (#201)
- Push only main and tags to Codeberg
- Move Node to 24 LTS and bump GitHub Actions (#203)
- Run lightweight jobs on ubuntu-slim
- Keep Docker-based actions on ubuntu-latest
- **deps**: Bump the codeql-action group with 3 updates (#220)
- Pin remaining GitHub Actions to immutable SHAs (#226)
- Fix Dependabot auto-merge to pull_request_target + safe policy
- Fix Dependabot auto-merge (pull_request_target + secure policy)
- **deps**: Normalize Dependabot config (dedupe, cooldown, groups)
- **deps**: Fix Dependabot cooldown (github-actions only supports default-days)
- **deps**: Bump pnpm/action-setup from 6.0.10 to 6.1.0 (#234)
- Unbreak Cargo Deny toolchain override and audit ignores
- **deps**: Bump codecov/codecov-action from 7.0.0 to 7.1.1 (#247)
- **deps**: Bump the codeql-action group with 3 updates (#243)
- **deps**: Bump zizmorcore/zizmor-action from 0.6.3 to 0.6.4 (#244)
- **deps**: Bump reviewdog/action-actionlint from 1.73.4 to 1.75.0 (#245)
- **deps**: Bump dtolnay/rust-toolchain (#246)
- **deps**: Bump the codeql-action group with 3 updates (#259)
- **deps**: Bump reviewdog/action-actionlint from 1.75.0 to 1.77.0 (#260)
- Overlap independent checks in one job
- Overlap cargo-audit without a wait step
- Scan native Swift and retire default Rust analysis

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
- **deps-dev**: Bump @types/react from 19.2.16 to 19.2.17 (#47)
- **deps-dev**: Bump oxlint from 1.68.0 to 1.69.0 (#45)
- **deps-dev**: Bump oxfmt from 0.53.0 to 0.54.0 (#43)
- **deps**: Bump chrono from 0.4.44 to 0.4.45 in /src-tauri (#46)
- **deps**: Bump uuid from 1.23.2 to 1.23.3 in /src-tauri (#44)
- **deps**: Bump rusqlite from 0.40.0 to 0.40.1 in /src-tauri (#48)
- **deps**: Bump zip from 4.6.1 to 8.6.0 in /src-tauri (#42)
- **deps**: Bump codecov/codecov-action from 5 to 7
- **deps**: Bump pnpm/action-setup from 6.0.8 to 6.0.9
- **deps**: Bump pnpm/action-setup from 6.0.8 to 6.0.9 (#82)
- **deps**: Bump actions/checkout from 4.3.1 to 7.0.0
- **deps**: Bump actions/checkout from 4.3.1 to 7.0.0 (#98)
- **deps**: Bump actions/cache from 5 to 6
- **deps**: Bump actions/cache from 5 to 6 (#103)
- **deps**: Bump tauri-apps/tauri-action from action-v0.6.2 to 1.0.0
- **deps**: Bump tauri-apps/tauri-action from action-v0.6.2 to 1.0.0 (#104)
- **deps**: Batch bump npm dev/prod dependencies
- **deps**: Batch bump cargo dependencies
- Add mise.toml for runtime version management
- Add docs validation scripts and fix license/gatekeeper docs
- **deps**: Bump cc from 1.2.65 to 1.2.66 in /src-tauri (#142)
- **deps-dev**: Bump oxfmt from 0.57.0 to 0.58.0 (#143)
- **deps**: Bump i18next from 26.3.2 to 26.3.4 (#145)
- **deps**: Bump @tauri-apps/api from 2.11.0 to 2.11.1 (#146)
- **deps-dev**: Bump vite from 8.1.0 to 8.1.3 (#147)
- **deps-dev**: Bump vitest from 4.1.9 to 4.1.10 (#148)
- **deps-dev**: Bump @vitest/coverage-v8 from 4.1.9 to 4.1.10 (#149)
- **deps-dev**: Bump oxlint from 1.72.0 to 1.73.0 (#144)
- Add knip 6.26 and remove unused routes index (#162)
- **deps**: Bump serde from 1.0.228 to 1.0.229 in /src-tauri (#179)
- **deps**: Bump @tanstack/react-virtual from 3.14.5 to 3.14.7 (#178)
- **deps**: Bump serde_json from 1.0.150 to 1.0.151 in /src-tauri (#177)
- **deps**: Bump tauri-plugin-dialog from 2.7.1 to 2.7.2 in /src-tauri (#176)
- **deps**: Bump react-i18next from 17.0.8 to 17.0.10 (#175)
- **deps**: Bump tokio from 1.52.3 to 1.53.1 in /src-tauri (#174)
- **deps**: Bump lucide-react from 1.23.0 to 1.25.0 (#173)
- **deps**: Bump uuid from 1.23.4 to 1.24.0 in /src-tauri (#172)
- **deps-dev**: Bump vite from 8.1.3 to 8.1.5 (#171)
- **deps**: Bump cc from 1.2.66 to 1.3.0 in /src-tauri (#170)
- **deps-dev**: Bump knip from 6.26.0 to 6.27.0 (#169)
- **deps**: Bump futures-util from 0.3.32 to 0.3.33 in /src-tauri (#168)
- **deps**: Bump @tauri-apps/plugin-dialog from 2.7.1 to 2.7.2 (#167)
- **deps**: Bump clap from 4.6.1 to 4.6.3 in /src-tauri (#166)
- **deps**: Bump anyhow from 1.0.103 to 1.0.104 in /src-tauri (#165)
- **deps**: Bump serde_with from 3.20.0 to 3.21.0 in /src-tauri (#163)
- **deps-dev**: Bump oxlint from 1.73.0 to 1.74.0 (#160)
- **deps**: Bump i18next from 26.3.4 to 26.3.6 (#161)
- **deps-dev**: Bump typescript from 6.0.3 to 7.0.2 (#154)
- **deps-dev**: Bump oxfmt from 0.58.0 to 0.59.0 (#153)
- **deps**: Bump actions/checkout to v7.0.1 and actions/setup-node to v7.0.0
- **tooling**: Adopt lefthook, pin CI actions, and add release guardrails
- **deps**: Bump lucide-react from 1.26.0 to 1.27.0 (#184)
- **deps**: Bump cc from 1.3.0 to 1.4.0 in /src-tauri (#181)
- **deps**: Bump clap_complete from 4.6.7 to 4.6.8 in /src-tauri (#189)
- **deps**: Bump clap from 4.6.3 to 4.6.5 in /src-tauri (#190)
- **deps**: Bump the production-dependencies group across 1 directory with 3 updates (#191)
- **deps**: Bump the dev-dependencies group across 1 directory with 9 updates (#196)
- **deps**: Bump cc from 1.4.0 to 1.4.2 in /src-tauri (#204)
- **deps**: Bump the dev-dependencies group with 4 updates (#205)
- **deps**: Bump clap from 4.6.5 to 4.6.6 in /src-tauri (#206)
- **deps**: Bump clap_complete from 4.6.8 to 4.6.9 in /src-tauri (#207)
- **deps**: Bump rusqlite from 0.40.1 to 0.40.2 in /src-tauri (#209)
- **deps**: Bump uuid from 1.24.0 to 1.24.1 in /src-tauri (#212)
- **deps**: Bump futures-util from 0.3.33 to 0.3.34 in /src-tauri (#214)
- **deps**: Bump the dev-dependencies group with 2 updates (#216)
- **deps**: Bump zustand in the production-dependencies group (#217)
- **deps**: Bump cc from 1.4.2 to 1.4.3 in /src-tauri (#215)
- **deps**: Bump the dev-dependencies group with 8 updates (#218)
- **deps**: Upgrade to pnpm 12 and update all dependencies to latest (#223)
- **deps**: Bump cc from 1.4.3 to 1.4.4 in /src-tauri (#224)
- **deps**: Bump cc from 1.4.4 to 1.4.5 in /src-tauri (#227)
- **deps**: Bump tauri-plugin-opener from 2.5.4 to 2.5.5 in /src-tauri (#229)
- **deps**: Bump tauri-plugin-dialog from 2.7.2 to 2.7.3 in /src-tauri (#232)
- **deps**: Bump tauri-plugin-single-instance in /src-tauri (#233)
- **deps**: Bump tauri-plugin-clipboard-manager in /src-tauri (#230)
- **deps**: Bump tauri-plugin-notification in /src-tauri (#231)
- **deps**: Bump uuid from 1.24.1 to 1.26.0 in /src-tauri
- **deps**: Bump symphonia from 0.6.0 to 0.6.1 in /src-tauri (#213)
- **deps**: Bump tauri-plugin-updater in /src-tauri (#228)
- Ignore RUSTSEC-2026-0285/2024-0370 in cargo-deny
- **deps**: Bump the dev-dependencies group with 8 updates (#235)
- **deps**: Bump uuid from 1.26.0 to 1.26.1 in /src-tauri (#238)
- **deps**: Bump clap from 4.6.6 to 4.6.7 in /src-tauri (#241)
- **deps**: Bump clap_complete from 4.6.9 to 4.6.11 in /src-tauri (#236)
- **deps**: Bump cc from 1.4.5 to 1.4.6 in /src-tauri (#237)
- **deps**: Bump the production-dependencies group with 2 updates (#239)
- **deps**: Bump react, react-dom, and types to 19.3.0 (#249)
- **deps**: Bump lucide-react from 1.45.0 to 1.46.0 (#250)
- **deps**: Bump tauri-plugin-single-instance in /src-tauri (#253)
- **deps**: Bump cc from 1.4.6 to 1.4.7 in /src-tauri (#254)
- **deps**: Bump tauri from 2.11.5 to 2.11.6 in /src-tauri (#252)
- **deps**: Bump react-i18next in the production-dependencies group (#256)
- **deps**: Bump the dev-dependencies group across 1 directory with 9 updates (#280)
- **deps**: Consolidate pending updates and fix dependency audit
- **license**: Adopt AGPL-3.0-only and comment-signed CLA
- **license**: Integrate AGPL and contributor agreement

### 🚨 Breaking Changes

- Retire React Tauri and Rust application stack

### 🧪 Tests

- Add unit tests for i18n-dependent and browser-dependent utility modules
- Add unit tests for Zustand store slices
- Add HistorySidebar component integration tests
- Add pure utility unit tests and restructure testing guide
- Improve frontend coverage 26% → 70% (#81)
- Use beforeEach/afterEach for isTauriRuntime cleanup
- Coverage threshold 60% + DB migration test (#63)
- Coverage threshold 60% + DB migration test (#63)
- Cover error-handling paths for codecov patch
- Cover stderr fallback write path in observability
- Add stop.rs coverage for cancel DB failure message
- **player**: Cover AB-loop no-seek path in PlaybackBar integration
- Assert AppError message field in zip-slip regression test
- Use zip entry path preserved by zip writer for traversal case
- Unit-test zip path guard directly instead of zip writer traversal
- Assert zip-slip details field on AppError
- Cover generation_task and stop error-handling helpers
- Extract warning helpers for codecov patch coverage
- Cover remaining error-handling paths for codecov patch
- Update icon class selectors for lucide-react 1.45 (#248)
## [0.2.1] - 2026-06-03


### Release

- V0.2.1

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

- Add CodeQL security scanning workflow
- **deps**: Bump tauri from 2.11.0 to 2.11.1 in /src-tauri
- Remove atty from Cargo.lock
- Add npm audit auto-block to CI workflows
- Add config.json to .gitignore
- **i18n**: Add P6–P8 translation keys (player, settings, setup, shortcuts)
- Merge dependabot dependency updates
- Finish github actions dependency updates
- Update Cargo.lock version
- **deps**: Bump tar from 0.4.45 to 0.4.46 in /src-tauri (#31)
- **deps**: Bump i18next from 26.2.0 to 26.3.0 (#30)
- **deps-dev**: Bump vitest from 4.1.6 to 4.1.7 (#29)
- **deps**: Bump serde_json from 1.0.149 to 1.0.150 in /src-tauri (#28)
- **deps**: Bump rusqlite from 0.39.0 to 0.40.0 in /src-tauri (#26)
- **deps**: Bump react-i18next from 17.0.6 to 17.0.8 (#25)
- **deps-dev**: Bump @types/react from 19.2.14 to 19.2.15 (#24)
- **deps-dev**: Bump vite from 8.0.13 to 8.0.14
## [0.1.1] - 2026-05-05


### 🐛 Bug Fixes

- Async model deletion, cancel cleanup, danger zone delete-all
## [0.1.0] - 2026-05-05


### V0.1.0

- CLI mode, PATH integration, Homebrew cask

### ✨ New Features

- Redesign generation workspace composer
- Improve generation workflow and store structure

### 🐛 Bug Fixes

- Stream model downloads with retries and refresh setup UI
- **generation**: Stabilize native E2E paths
- Prepare sidecars before release:check in CI
- Pin tauri to 2.11.0 to match @tauri-apps/api version
- Prevent UI freeze on model delete, add cancel/cleanup, add danger zone delete-all

### 📝 Documentation

- Move implementation status from README to a dedicated documentation file
- Fix OpenMusic series table links
- Update OpenLoop feature planning
- Restructure README — CLI section first, add CLI usage guide

### 🔧 Chores

- Checkpoint pnpm migration baseline
- Update dependencies to latest

### 🧪 Tests

- Add formatting and unit test tooling

