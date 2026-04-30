# Commercial Generation Workspace Design

## Goal

Make OpenLoop feel like a mature desktop replacement for the official ACE-Step 1.5 Gradio interface. The app should expose the same model controls, but organize them so casual users can generate music without learning backend details while advanced users can expand the full configuration surface.

## Product Direction

OpenLoop remains an OpenKara sibling product: native, quiet, local-first, and clear. The difference is workflow. OpenKara centers playback and a music library; OpenLoop centers a generation workspace and a persistent composer.

The current right-side generation drawer is removed. It competes with the history sidebar and compresses the main stage. The new layout uses one left history rail and one central workspace.

## Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Toolbar                                                     │
├───────────────┬─────────────────────────────────────────────┤
│ History       │ Main generation workspace                   │
│               │                                             │
│               │ Current task / result / status / errors     │
│               │                                             │
│               │ Horizontal composer                         │
├───────────────┴─────────────────────────────────────────────┤
│ Playback bar                                                │
└─────────────────────────────────────────────────────────────┘
```

## Composer Behavior

The composer is the primary creation surface. It should feel closer to a commercial music generation tool than a settings form.

Default visible controls:

- Prompt textarea.
- Lyrics toggle and expandable lyrics editor.
- Task type selector using existing ACE-Step task values.
- Duration, BPM, vocal language, and output format.
- Model readiness summary and generate/cancel controls.

Advanced controls stay available through a disclosure:

- Negative prompt.
- Key/scale and time signature.
- LM model and LM backend.
- Thinking, CoT, format, constrained decoding.
- Inference steps and guidance scale.
- Reference/source audio paths.
- Repaint start/end.
- Cover strength.
- Seed and reproducibility controls.

This does not add backend capability. It reorganizes existing request fields and API coverage.

## Workspace Behavior

The main stage should always answer:

- What is selected or currently being generated?
- Is the local model/backend ready?
- What happened if generation failed?
- Where is the output and what can the user do next?

Idle state should teach the user to start from the composer. Active state should show clear progress copy. Completed state should summarize file format, duration, seed/model where available, and rely on the playback bar for auditioning.

## Release-Level UX Criteria

- No competing left/right sidebars around the main workspace.
- Empty prompt/lyrics validation is visible but calm.
- Generate button has clear disabled and loading states.
- Advanced controls are discoverable but not visually dominant.
- Local-first behavior remains visible through copy and status.
- The interface avoids backend jargon unless the user opens advanced controls.
