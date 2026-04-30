# OpenKara Shell Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild OpenLoop around the OpenKara shell system so both apps share the same product identity while OpenLoop keeps its generation-specific workflow.

**Architecture:** Replace OpenLoop's custom shell with an OpenKara-style shell composed of shared geometry, shared tokens, matching overlay patterns, and a matching native menu event contract. Preserve OpenLoop's current generation/store/backend logic, but remount it inside the new shell and setup surfaces.

**Tech Stack:** Tauri 2, React 19, TypeScript, Zustand, Tailwind v4 globals, Rust menu/event wiring.

---

### Task 1: Adopt OpenKara design tokens and shell globals

**Files:**

- Modify: `src/styles/globals.css`
- Check against: `/Users/david/Development/Vibe/OpenKara/src/styles/globals.css`

**Steps:**

1. Replace OpenLoop's custom gradient/card token system with OpenKara's surface, border, motion, and shell variables.
2. Preserve any OpenLoop-only utility classes still needed by generation/preview/history content.
3. Keep `html`, `body`, and `#root` full-height and overflow-hidden like OpenKara.

**Verification:**

- Run: `pnpm typecheck`
- Expected: PASS

### Task 2: Introduce shell geometry and chrome helpers

**Files:**

- Create: `src/app/lib/window-shell.ts`
- Create: `src/app/lib/window-chrome.ts`
- Create: `src/app/lib/app-shell.ts`
- Check against: `/Users/david/Development/Vibe/OpenKara/src/lib/window-shell.ts`
- Check against: `/Users/david/Development/Vibe/OpenKara/src/lib/window-chrome.ts`
- Check against: `/Users/david/Development/Vibe/OpenKara/src/lib/app-shell.ts`

**Steps:**

1. Port the OpenKara shell geometry helpers with only the dependencies OpenLoop actually needs.
2. Keep the API small: resolve shell mode, chrome variant, and CSS variables.
3. Avoid karaoke-specific runtime dependencies.

**Verification:**

- Run: `pnpm typecheck`
- Expected: PASS

### Task 3: Replace the current OpenLoop shell with OpenKara-style layout components

**Files:**

- Create: `src/app/components/layout/AppLayout.tsx`
- Create: `src/app/components/layout/WindowChrome.tsx`
- Create: `src/app/components/layout/Toolbar.tsx`
- Create: `src/app/components/layout/SidebarRail.tsx`
- Create: `src/app/components/layout/MainContentView.tsx`
- Modify: `src/app/App.tsx`
- Remove or stop using: `src/app/components/layout/AppShell.tsx`

**Steps:**

1. Build a new `AppLayout` that mirrors OpenKara's shell composition.
2. Mount OpenLoop history in the sidebar rail.
3. Mount OpenLoop generation/preview content in the main content area.
4. Use the shell CSS variables and toolbar spacing instead of the old page header.

**Verification:**

- Run: `pnpm typecheck`
- Expected: PASS

### Task 4: Move preview and generation controls into shell-native surfaces

**Files:**

- Modify: `src/app/components/generation/GenerationPanel.tsx`
- Modify: `src/app/components/player/PreviewPanel.tsx`
- Modify: `src/app/components/history/HistorySidebar.tsx`
- Optionally create: `src/app/components/player/PlaybackBar.tsx`

**Steps:**

1. Remove the assumption that each major area is a standalone frosted card.
2. Reframe history, generation, and preview to fit the OpenKara shell roles.
3. Keep existing OpenLoop actions and state wiring intact.

**Verification:**

- Run: `pnpm typecheck`
- Expected: PASS

### Task 5: Replace Settings modal with Settings overlay

**Files:**

- Create: `src/app/components/settings/SettingsOverlay.tsx`
- Create: `src/app/components/settings/SettingsSectionCard.tsx`
- Create: `src/app/components/settings/SettingsDialogHost.tsx`
- Modify or replace: `src/app/components/settings/SettingsModal.tsx`
- Modify: `src/app/lib/store.ts`

**Steps:**

1. Change settings open/close state from local component state to app-level shell state.
2. Replace the modal card with a full overlay patterned after OpenKara.
3. Split settings content into section cards.
4. Keep OpenLoop-specific setting fields and backend controls.

**Verification:**

- Run: `pnpm typecheck`
- Expected: PASS

### Task 6: Rebuild onboarding to match OpenKara setup rhythm

**Files:**

- Modify: `src/app/components/settings/SetupScreen.tsx`
- Check against: `/Users/david/Development/Vibe/OpenKara/src/components/Settings/LibrarySetup.tsx`

**Steps:**

1. Rebuild setup visuals and flow rhythm to match OpenKara's setup language.
2. Replace library steps with OpenLoop-specific introduction, device check, backend/model prep, path configuration, and completion.
3. Preserve OpenLoop's current persistence behavior.

**Verification:**

- Run: `pnpm typecheck`
- Expected: PASS

### Task 7: Add OpenLoop bootstrap banner for model/backend readiness

**Files:**

- Create: `src/app/components/bootstrap/ModelBootstrapBanner.tsx`
- Modify: `src/app/lib/store.ts`
- Modify: `src/app/lib/types.ts`
- Modify: `src/app/components/layout/MainContentView.tsx`

**Steps:**

1. Introduce a shell-level readiness banner patterned after OpenKara.
2. Represent OpenLoop readiness states with minimal new state: pending, downloading/preparing, outdated, failed, ready.
3. Surface model/backend problems in the banner and link the user to settings/setup.

**Verification:**

- Run: `pnpm typecheck`
- Expected: PASS

### Task 8: Add native menu parity in Rust and frontend runtime handling

**Files:**

- Create: `src-tauri/src/app_menu.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/app/runtime/menu-runtime.ts`
- Modify: `src/app/App.tsx`
- Check against: `/Users/david/Development/Vibe/OpenKara/src-tauri/src/app_menu.rs`

**Steps:**

1. Add a Tauri menu with OpenLoop-specific actions using OpenKara's structure.
2. Emit menu action events to the frontend.
3. Handle those actions in the frontend shell.

**Verification:**

- Run: `pnpm rust:check`
- Expected: PASS
- Run: `pnpm typecheck`
- Expected: PASS

### Task 9: Align package dependencies with reused shell components

**Files:**

- Modify: `package.json`

**Steps:**

1. Add only the dependencies required for the reused shell pieces, such as `lucide-react` and any Tauri dialog plugin usage actually introduced.
2. Avoid bringing in OpenKara-only libraries that OpenLoop does not need.

**Verification:**

- Run: `pnpm install`
- Expected: PASS

### Task 10: Final verification

**Files:**

- Verify modified frontend and Rust files

**Steps:**

1. Run `pnpm typecheck`.
2. Run `pnpm build`.
3. Run `pnpm rust:check`.
4. Run `cargo test --manifest-path src-tauri/Cargo.toml`.
5. Run `pnpm tauri dev` and confirm the app starts.

**Verification:**

- Expected: all commands pass, and the app opens with OpenKara-style shell structure.

## Notes

- This plan intentionally does **not** preserve the current OpenLoop shell visuals.
- This plan intentionally avoids adding library-management concepts to OpenLoop.
- The design doc is saved separately in `docs/plans/2026-04-24-openkara-shell-parity-design.md`.
- No git commit is included here because the current session has not been asked to commit.
