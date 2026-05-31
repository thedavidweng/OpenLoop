# OpenLoop Complexity Hotspots Optimization Plan

**Document date:** 2026-05-17  
**Source:** Complexity audit of `/Users/david/Development/OpenLoop`  
**Scope:** Reduce real data-size-sensitive complexity in history, search, CLI prefix lookup, and model status aggregation.  
**Patch status:** Plan only. No code changes in this document.

## Executive Summary

The complexity scan produced many TSX hits, but most are fixed-size option lists and should not be optimized. The real risk is concentrated around generation history because history can grow without a hard cap and is loaded, searched, filtered, rendered, and prefix-matched in multiple layers.

This plan keeps the first implementation pass narrow:

1. Make history database access cheap and bounded.
2. Move history search toward the backend instead of filtering every record in React on every keystroke.
3. Replace repeated membership scans in rendered history rows with stable sets.
4. Add a bounded database prefix lookup for CLI commands that currently load all history.
5. Defer model pack aggregation work unless the catalog grows or profiling shows it matters.

## Goals

- Preserve current ordering: favorites first, then newest generated items.
- Preserve current search semantics unless an FTS migration explicitly changes token behavior and tests document it.
- Keep implementation incremental and testable.
- Avoid broad refactors of `GenerationPanel`, settings UI, or fixed-size render lists.
- Add measurements or regression tests where behavior depends on data size.

## Non-Goals

- No UI redesign.
- No store architecture rewrite.
- No speculative caching layer.
- No fallback code that hides inconsistent data or failed migrations.
- No optimization of fixed-size option maps in generation/settings forms.

## Current Hotspots

| Area | Location | Current pattern | Current complexity | Priority |
|------|----------|-----------------|--------------------|----------|
| History DB list/search | `src-tauri/src/services/db.rs` | Full completed-history query, optional `%LIKE%`, favorite/newest ordering | `O(n log n)` list, `O(n * text)` search | P0 |
| Frontend history search | `src/app/components/history/HistorySidebar.tsx` | Client filters all hydrated history on each query | `O(n * text)` per query | P0 |
| History row membership | `HistorySidebar.tsx` | `includes` on favorite/selected arrays inside each row | `O(rows * selected/favorites)` | P1 |
| CLI prefix lookup | `src-tauri/src/cli/delete.rs`, `src-tauri/src/cli/files.rs` | Load all records, then scan for prefix and ambiguity | `O(n)` load + scans | P1 |
| Model pack status aggregation | `src/app/lib/model-packs.ts`, settings/setup UI | Re-filter statuses per pack/variant | Small `O(pack_count * statuses)` | P2 |

## Phase 0 - Baseline and Guardrails

**Goal:** Establish behavior and test coverage before changing data access.

### Tasks

- [ ] Add focused tests around `Database::list_generations(None)` ordering:
  - completed records only
  - non-empty output path only
  - favorite records before non-favorites
  - newest records first inside each favorite group
- [ ] Add focused tests around `Database::list_generations(Some(query))`:
  - prompt match
  - lyrics match
  - empty/whitespace query equals no query
  - favorite/newest ordering still applies
- [ ] Add tests for CLI prefix ambiguity behavior before changing lookup logic:
  - no match
  - one prefix match
  - two prefix matches returns the existing ambiguity message shape
- [ ] Capture a simple local measurement script or test fixture with at least 1,000 generated records.

### Files

- `src-tauri/src/services/db.rs`
- `src-tauri/src/cli/delete.rs`
- `src-tauri/src/cli/files.rs`
- `src-tauri/tests/cli_contract.rs`

### Acceptance

- `cargo test -q --manifest-path src-tauri/Cargo.toml` passes.
- Tests describe current behavior clearly enough that later SQL/index changes cannot accidentally alter ordering or filtering.

## Phase 1 - Indexed and Bounded History Queries

**Goal:** Make the backend the source of truth for bounded history access.

### Tasks

- [ ] Add a migration for history list indexes:
  - index completed generated outputs by `status`, output presence, `is_favorite`, and `created_at`
  - keep the index aligned with the current `WHERE status = 'completed' AND COALESCE(output_path, '') <> '' ORDER BY is_favorite DESC, created_at DESC`
- [ ] Extend `Database::list_generations` to accept a limit.
- [ ] Expose limit through `HistoryService::list_generations` and Tauri `list_generations`.
- [ ] Pick an initial GUI default limit, likely 200 records.
- [ ] Keep CLI `openloop list` behavior explicit:
  - either preserve full listing for CLI, or add `--limit` and document default
  - do not silently truncate CLI output without a visible note

### Files

- `src-tauri/migrations/005_history_indexes.sql` (new)
- `src-tauri/src/services/db.rs`
- `src-tauri/src/services/history.rs`
- `src-tauri/src/commands/history.rs`
- `src/app/lib/api.ts`
- `src-tauri/src/cli/list.rs`

### Complexity Change

- Current list path: roughly `O(n log n)` for sorting the result set.
- Target list path: indexed access with bounded result size, effectively `O(log n + limit)` for common UI use.

### Acceptance

- GUI hydration loads a bounded number of history records.
- Existing favorite/newest ordering remains unchanged.
- Rust tests cover ordering and limit behavior.
- `pnpm test:run` and `cargo test -q --manifest-path src-tauri/Cargo.toml` pass.

## Phase 2 - Backend-Driven History Search

**Goal:** Stop filtering every hydrated history item in React for each search query.

### Tasks

- [ ] Update `setHistoryQuery` flow so search is debounced before backend fetch.
- [ ] Use `api.listGenerations(query, limit)` for non-empty search.
- [ ] Keep local history list as the default view when query is empty.
- [ ] Add loading and empty states only if current UI needs them; do not introduce a large state machine.
- [ ] Decide whether `%LIKE%` remains acceptable for v1:
  - Short-term: keep `%LIKE%` with limit and tests.
  - Later: add FTS5 if history search becomes a measured bottleneck.

### Files

- `src/app/lib/api.ts`
- `src/app/lib/store/slices/ui.ts`
- `src/app/lib/store/slices/history.ts`
- `src/app/components/history/SearchBox.tsx`
- `src/app/components/history/HistorySidebar.tsx`
- `src-tauri/src/services/db.rs`

### Complexity Change

- Current frontend search: `O(n * text)` on each query change.
- Target frontend search: `O(result_limit)` render work; backend handles filtering.

### Acceptance

- Typing in the search box does not scan the full hydrated history in React.
- Empty search restores the default bounded recent-history list.
- Tests cover search query trimming and empty query behavior.
- Manual check: search still finds prompt and lyrics matches.

## Phase 3 - History Row Membership Sets

**Goal:** Remove repeated `includes` scans inside rendered history rows.

### Tasks

- [ ] Derive `favoriteRecordIdSet` with `useMemo`.
- [ ] Derive `selectedHistoryIdSet` with `useMemo`, even though the selected list is currently capped at two, because it makes row logic consistent and cheap.
- [ ] Compute `isFavorite` once per row and reuse it for tooltip, class name, and star fill.
- [ ] Keep arrays in Zustand state; do not change public store shape for this small optimization.

### Files

- `src/app/components/history/HistorySidebar.tsx`

### Complexity Change

- Current row membership: `O(rows * favorite_count)` in the worst case.
- Target row membership: `O(rows + favorite_count)`.

### Acceptance

- Favorite, unfavorite, multi-select, compare-mode selection, and batch actions behave the same.
- `pnpm test:run` passes.

## Phase 4 - CLI Prefix Lookup Without Full History Load

**Goal:** Make CLI ID-prefix commands bounded and database-backed.

### Tasks

- [ ] Add a database method for completed generation ID prefix matches, returning at most two rows.
- [ ] Use it in `openloop delete <id>` to preserve no-match and ambiguous-prefix behavior.
- [ ] Use it in `openloop files unlink <id>` for the same behavior.
- [ ] Keep output wording compatible with existing tests unless the tests intentionally update the contract.

### Files

- `src-tauri/src/services/db.rs`
- `src-tauri/src/services/history.rs`
- `src-tauri/src/cli/delete.rs`
- `src-tauri/src/cli/files.rs`
- `src-tauri/tests/cli_contract.rs`

### Complexity Change

- Current prefix lookup: load all completed records, then scan twice.
- Target prefix lookup: DB returns at most two candidate records; CLI work is bounded.

### Acceptance

- CLI no-match, match, and ambiguity tests pass.
- `openloop delete <prefix>` and `openloop files unlink <prefix>` still share identical ambiguity semantics.

## Phase 5 - Model Status Aggregation Cleanup

**Goal:** Only optimize model pack aggregation if it becomes real work.

### Tasks

- [ ] Leave current implementation unchanged unless model catalog size grows or profiling shows repeated aggregation is measurable.
- [ ] If needed, add a `buildPackStatusMap(modelStatuses)` helper and compute it once per `modelStatuses` in settings/setup components.
- [ ] Do not add global caching; the data set is small and state updates are already explicit.

### Files

- `src/app/lib/model-packs.ts`
- `src/app/components/settings/sections/ModelsSection.tsx`
- `src/app/components/settings/SetupScreen.tsx`

### Complexity Change

- Current: small `O(pack_count * status_count * variants_per_pack)`.
- Target if implemented: `O(status_count + pack_count)`.

### Acceptance

- Model download, delete, cancel, and clear-partial UI states stay unchanged.
- Existing model bootstrap tests pass.

## Deferred Items

- FTS5 search migration for prompt/lyrics.
- Virtualized history list.
- Store-level normalized history index.
- Removing the apparent duplicate generation panel entrypoint:
  - `src/app/components/generation/GenerationPanel.tsx`
  - `src/app/components/generation/GenerationPanel/index.tsx`

These are intentionally deferred because the current highest-impact path is database access and bounded history rendering.

## Verification Plan

Run narrow checks after each phase, then broader checks before merge:

```bash
pnpm test:run
pnpm typecheck
cargo test -q --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Manual checks:

- Generate or seed many history records.
- Confirm app startup remains responsive.
- Confirm history search returns expected prompt/lyrics matches.
- Confirm favorite-first ordering is stable.
- Confirm CLI prefix delete/unlink ambiguity messages remain clear.

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Index does not match SQL predicate | Query planner may still scan | Use `EXPLAIN QUERY PLAN` locally and adjust the index to the actual query |
| Search semantics change under FTS | Users may see different matches | Keep `%LIKE%` first; make FTS a separate, tested migration |
| GUI limit hides older records | Users may think history disappeared | Pair limit with backend search and explicit CLI behavior |
| Prefix lookup accidentally ignores current completed/output filters | CLI may delete unexpected records | Reuse the same completed-output predicate and test it |
| Over-optimizing small fixed arrays | More code, no benefit | Treat scanner output as leads, not proof |

## Suggested Implementation Order

1. Phase 0 tests.
2. Phase 1 DB indexes and bounded list.
3. Phase 3 row membership sets.
4. Phase 4 CLI prefix lookup.
5. Phase 2 backend-driven search.
6. Phase 5 only if profiling justifies it.

