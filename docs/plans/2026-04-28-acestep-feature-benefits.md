# OpenLoop ACE-Step Feature Backlog

**Status**: Active backlog after implementation comparison on 2026-04-29.

This file keeps only feature work that is still not fully implemented. Completed items from the original plan are covered by the current app implementation and should not remain as active tasks.

## Already Implemented

- Full parameter restore from history: `loadGenerationSettings` now restores advanced ACE-Step fields.
- Lyrics structure tags: `[Verse]`, `[Pre-Chorus]`, `[Chorus]`, `[Bridge]`, `[Outro]`, and `[Instrumental]` chips are available in `GenerationPanel`.
- Playback volume and speed controls are implemented and persisted with local storage.
- Generation retry is available after failed generation.
- Reference/source audio file pickers are available for advanced fields.
- Instrumental mode exists and disables lyrics and vocal language input.

## P1

### Task 1: AI Enhance for Prompt Expansion

Add an ACE-Step-backed prompt enhancement action that turns short user intent into a richer generation prompt.

Expected behavior:
- User enters a short prompt such as `upbeat pop`.
- User clicks Enhance.
- OpenLoop calls the local ACE-Step `format_input` or equivalent endpoint when available.
- The returned enhanced prompt is inserted into the prompt field without sending data to a cloud service.

Likely files:
- `src/app/components/generation/GenerationPanel.tsx`
- `src/app/lib/api.ts`
- `src-tauri/src/services/ace_client.rs`
- New Tauri command if the backend endpoint needs a dedicated IPC surface.

Verification:
- With the local backend running, a short prompt can be expanded and edited before generation.
- Failure uses localized `AppError` messaging.

### Task 2: Variations Execution

The UI has a `variations` selector, but generation still submits a single task. Wire the selector into actual sequential variant generation.

Expected behavior:
- User selects 2-4 variations.
- OpenLoop submits each variation with a distinct seed.
- Variations run sequentially unless the backend supports safe batch execution.
- History receives one completed record per generated variant.
- UI shows current variation progress.

Likely files:
- `src/app/lib/store.ts`
- `src/app/lib/types.ts`
- `src-tauri/src/commands/generation.rs`
- `src-tauri/src/services/ace_client.rs`

Verification:
- Setting variations to 3 produces 3 records with distinct seeds.
- Cancelling stops the remaining queued variations.

## P2

### Task 3: Local Prompt Inspiration Library

Replace the current hardcoded dice prompt with a local prompt example library.

Expected behavior:
- Prompt dice button selects a random entry from local JSON.
- No network request is made.
- Examples cover common music categories such as pop, cinematic, EDM, acoustic, ambient, and trailer.

Likely files:
- `src/app/components/generation/GenerationPanel.tsx`
- New `src/app/data/prompt_examples.json`

### Task 4: Interrupted Generation Recovery

Persist active generation metadata so the app can recover or abandon unfinished tasks after a force quit.

Expected behavior:
- Active task id and request parameters are stored locally.
- On startup, OpenLoop detects unfinished local tasks.
- User can resume polling when possible or discard the stale task.

Likely files:
- `src-tauri/migrations/`
- `src-tauri/src/services/db.rs`
- `src-tauri/src/commands/generation.rs`
- `src/app/lib/store.ts`

### Task 5: Waveform Visualization for Repaint

Render generated audio waveforms and reuse that surface later for Repaint range selection.

Expected behavior:
- Playback bar or a detail panel displays a waveform for the selected output.
- Later Repaint work can use the waveform to pick start/end ranges.

Likely files:
- `src/app/components/player/PlaybackBar.tsx`
- Optional new waveform component.

### Task 6: Playback Keyboard Shortcut

`Space` is defined in the shortcut registry but is not yet wired to the hidden audio element in `PlaybackBar`.

Expected behavior:
- Pressing Space toggles playback when focus is not inside an input/select/textarea.
- It does not interfere with text entry.

Likely files:
- `src/app/lib/app-shortcuts.ts`
- `src/app/components/layout/AppLayout.tsx`
- `src/app/components/player/PlaybackBar.tsx`
