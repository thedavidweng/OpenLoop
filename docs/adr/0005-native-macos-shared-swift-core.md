# ADR-0005: Native macOS application and shared Swift core

**Status:** Accepted for #261 migration; native UI parity pending.

OpenLoop is macOS/Apple-Silicon-first. Use SwiftUI with narrow AppKit bridges for
the desktop shell and a separate Swift CLI. Both call OpenLoopCore; neither
front end owns product rules. macOS 15 is the deployment target. Platform and
accelerator support is declared by each Engine Runtime, not inferred from the
shell framework. Python/MLX inference remains in isolated child processes.

ADR-0002's shared-service intent survives; its Tauri-linked single-binary
implementation is superseded. The retiring application remains a reference
until a packaged native build demonstrates bootstrap, generation, persistence,
playback/export, recovery and CLI coexistence. Remove its stack at that boundary.
OpenKara screens/stores are not dependencies; visual principles may be shared.
