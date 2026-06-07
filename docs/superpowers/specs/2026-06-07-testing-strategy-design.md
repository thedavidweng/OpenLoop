# Testing Strategy Design

**Date:** 2026-06-07
**Status:** Draft

## Problem

OpenLoop has a thin test layer: 7 frontend test files (42 tests) covering validation, one component, store actions, and a few utilities. Many pure utility modules are untested. There are no component integration tests, no coverage metrics, no test reporting in CI, and no structured E2E strategy. The existing CI runs tests but doesn't measure or enforce quality gates.

## Approach

Pragmatic test pyramid: maximize unit test coverage for pure logic, add component integration tests with mocked Tauri API, use structured manual smoke tests for E2E (desktop app constraint), and add coverage/metrics to CI.

## Test Pyramid

### Layer 1: Unit Tests (Base — widest)

**Current:** 7 files, 42 tests, 962 lines
**Target:** 16+ files, 120+ tests

**New test files to add:**

| Module | Functions | Mock needed | Priority |
|--------|-----------|-------------|----------|
| `model-packs.ts` | 9 pure functions | None | High |
| `error-help.ts` | 2 pure functions | None | High |
| `profile-presets.ts` | 2 functions + constant | None | High |
| `errors.ts` | `stringifyUnknownError` + 4 i18n-dependent | i18n stub | High |
| `window-chrome.ts` | 1 function | `navigator` stub | Medium |
| `preview-record.ts` | 2 functions | i18n + crypto + Date | Medium |
| `app-shell.ts` | 1 trivial function | None | Low |
| `store-helpers.ts` | 3 functions | i18n + timers | Medium |
| `diagnostics.ts` | 2 functions | Tauri invoke | Medium |
| `store/slices/ui.ts` | UI state actions | None | Medium |
| `store/slices/settings.ts` | Settings persistence | Tauri invoke | Medium |
| `store/slices/model.ts` | Model management | Tauri invoke | Medium |
| `store/slices/history.ts` | History operations | Tauri invoke | Medium |

**Pattern:** Follow existing conventions — Vitest `describe/it/expect`, factory functions for test data, `vi.mock()` for Tauri API, `vi.useFakeTimers()` for async.

### Layer 2: Component Integration Tests (Middle)

**Current:** 1 component tested (`GenerationPanel`)
**Target:** 5+ components tested with realistic store state

**New component test files:**

| Component | What to test | Mock strategy |
|-----------|-------------|---------------|
| `SetupScreen` | Wizard flow, device check display, model selection | Mock Tauri API + store |
| `SettingsOverlay` | Section rendering, save/cancel, settings persistence | Mock Tauri API + store |
| `HistorySidebar` | List rendering, search filtering, selection, favorites | Mock store + virtual list |
| `PlaybackBar` | Play/pause, progress display, waveform | Mock Audio API + store |
| `SearchBox` | Input handling, debounced search, clear | Mock store |

**Pattern:** `@testing-library/react` + `@testing-library/user-event`, mock store with `vi.mock()`, dynamic imports after mock setup.

### Layer 3: Contract Tests (Rust — already solid)

**Current:** 1 file, 566 lines covering CLI contract, event schema, error codes, cancel flow
**Target:** Maintain current coverage, add tests for new service functions as they're added

No immediate action needed — the Rust contract test layer is already well-structured.

### Layer 4: E2E / Smoke Tests (Top — narrowest)

**Automated E2E:** Not recommended for this project. Tauri v2 E2E via `tauri-driver` is still maturing, requires macOS CI runners, and the maintenance cost outweighs the benefit for a desktop app with ~5 critical flows.

**Manual Smoke Test Guide:** Enhance existing `docs/testing.md` with:
- Structured checklist format (checkbox markdown)
- Categorized by test pyramid layer
- Clear pass/fail criteria
- Regression test triggers (what to re-test after which changes)
- Sign-off template for releases

## CI Enhancements

### Coverage Reporting

Add Vitest coverage via `@vitest/coverage-v8`:
- Generate lcov + text reports
- Upload to GitHub as artifact
- Add coverage summary to PR comments (via `davelosertov/coverage-reporter`)

### Test Metrics

Capture in CI:
- **Test execution time** — Vitest `--reporter=json` output
- **Test count** — total, passed, failed, skipped
- **Coverage percentage** — line, branch, function
- **Automation coverage** — ratio of automated tests to total testable units

### Quality Gates

- Minimum 60% line coverage (ramp to 80% over time)
- No new tests may be skipped without documented reason
- All tests must pass before merge (already enforced)

### Updated CI Pipeline

```
frontend job:
  1. Install dependencies
  2. Audit dependencies
  3. Typecheck
  4. Run tests with coverage  ← enhanced
  5. Upload coverage report   ← new
  6. Check coverage threshold ← new
  7. Vite build

rust-fmt-check job: (unchanged)
rust-test job: (unchanged)
validate job: (unchanged)
```

## Implementation Order

1. **Unit tests** — pure utilities first (zero-mock), then i18n-dependent, then Tauri-dependent
2. **CI coverage** — add `@vitest/coverage-v8`, coverage config, PR reporting
3. **Component tests** — start with SetupScreen (highest user-facing risk)
4. **Smoke test guide** — restructure `docs/testing.md`
5. **Test metrics** — add execution time and count tracking

## Files to Create/Modify

**New test files:**
- `tests/unit/model-packs.test.ts`
- `tests/unit/error-help.test.ts`
- `tests/unit/profile-presets.test.ts`
- `tests/unit/errors.test.ts`
- `tests/unit/window-chrome.test.ts`
- `tests/unit/preview-record.test.ts`
- `tests/unit/app-shell.test.ts`
- `tests/unit/store-helpers.test.ts`
- `tests/unit/store-ui.test.ts`
- `tests/unit/store-settings.test.ts`
- `tests/unit/setup-screen.test.tsx`
- `tests/unit/history-sidebar.test.tsx`

**Modified files:**
- `vite.config.ts` — add coverage config
- `package.json` — add `@vitest/coverage-v8`, test:coverage script
- `.github/workflows/ci.yml` — add coverage reporting and threshold check
- `docs/testing.md` — restructure as structured smoke test guide
