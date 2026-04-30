# Commercial Generation Workspace Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Rework OpenLoop into a commercial-grade ACE-Step generation workspace with a central horizontal composer and full advanced parameter access.

**Architecture:** Keep existing Tauri, store, validation, and ACE-Step API mapping. Replace the right-side generation drawer with a central workspace and a composer-style `GenerationPanel` mounted inside the main stage.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind v4 globals, Tauri 2.

---

### Task 1: Move generation entry into the central workspace

**Objective:** Remove the right-side drawer and make the main stage own the generation workflow.

**Files:**

- Modify: `src/app/components/layout/OpenLoopStage.tsx`

**Steps:**

1. Remove the absolute right-side `GenerationPanel` container.
2. Render status/result content in the main stage.
3. Render `GenerationPanel` as a full-width composer near the bottom of the stage.
4. Keep current generation selection and state messaging.

**Verification:**

- Run: `pnpm typecheck`
- Expected: no TypeScript errors.

### Task 2: Rebuild GenerationPanel as a horizontal composer

**Objective:** Convert the form from a stacked side panel into a commercial-style composer.

**Files:**

- Modify: `src/app/components/generation/GenerationPanel.tsx`

**Steps:**

1. Keep the existing store actions and validation behavior.
2. Make prompt the dominant horizontal textarea.
3. Put lyrics in a discoverable expandable area.
4. Surface task type, duration, BPM, language, format, model, and generate actions in the default composer.
5. Move advanced ACE-Step controls into a disclosure section.
6. Keep all existing fields wired to `GenerationFormValues`.

**Verification:**

- Run: `pnpm typecheck`
- Expected: no TypeScript errors.

### Task 3: Add reusable control styling

**Objective:** Ensure composer controls look production-ready rather than unstyled browser inputs.

**Files:**

- Modify: `src/styles/globals.css`

**Steps:**

1. Add `.text-input`, `.select-input`, `.primary-button`, and `.secondary-button`.
2. Add focus, disabled, and hover states.
3. Preserve OpenKara shell tokens.

**Verification:**

- Run: `pnpm build`
- Expected: build succeeds.

### Task 4: Improve copy for commercial workflow

**Objective:** Clarify the basic and advanced control model.

**Files:**

- Modify: `src/locales/en.json`
- Modify: `src/locales/zh-CN.json`

**Steps:**

1. Add labels for composer, lyrics expansion, advanced controls, and task type names.
2. Keep advanced labels accurate to ACE-Step.
3. Avoid exposing backend terminology in default-mode copy.

**Verification:**

- Run: `pnpm typecheck`
- Expected: no missing translation type issues.

### Task 5: Final verification

**Objective:** Confirm the workspace is releasable at the frontend level.

**Commands:**

- `pnpm typecheck`
- `pnpm build`

**Manual checks:**

- Main stage is not squeezed by a right drawer.
- Prompt composer is visible in the central workspace.
- Advanced ACE-Step settings remain accessible.
- Generate/cancel/reset preserve current behavior.
- Model-not-ready state still blocks generation with clear copy.
