# ADR-0006: Engine and Runtime boundary

**Status:** Accepted for #261.

Engine is a generation family. Runtime is its isolated implementation with
explicit OS, architecture, accelerator, memory, source revision and license data.
Model Packs belong to Engines and list compatible runtimes. Configurations select
a pack/runtime and curated capabilities. OpenLoopEngines owns the single native
catalog; GUI and CLI consume the same descriptors without metadata mirrors.

OpenLoopCore knows only `Engine`: capabilities, generation events/results,
cancellation and shutdown. Creative requests remain engine-neutral. Advanced
settings have an adapter-owned versioned payload; ACE-Step fields never become
common request fields. Python runtimes use bundled uv; a future MLX Swift runtime
can implement the same protocol. No public plugin SDK is promised.

The Engine writes local artifacts into the Core-provided output directory; Core
validates ownership and publishes completed outputs. Process supervision, logs,
readiness and HTTP are adapter responsibilities. Fake Engines exercise ordinary
Core tests; lower-level adapter tests cover the real HTTP protocol.

ACE-Step cancellation discards late results because its API lacks a cancellation
endpoint. It must not kill a shared attached runtime. MiniMax Music 3 is the next
validation family, unbound/non-installable until its adapter and license are
verified. Other model families are not part of this reset.
