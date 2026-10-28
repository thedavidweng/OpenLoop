# OpenLoop

Native macOS app for local AI music generation, with Swift runtime and a scriptable CLI.

- Package manager for JS tooling: **pnpm**; repository requires Node >=24.
- Hooks use hk via mise; run `mise install` to install them. The pre-push gate is mandatory: never push with `--no-verify` or set `HK=0`.
- Swift source and CLI live under `native/`; `pnpm release:check` verifies release-specific Swift and documentation gates.
- Read only the relevant policy:
  - [Formatting and hooks](docs/agents/formatting.md).
  - [TypeScript safety](docs/agents/typescript.md) for frontend/tooling edits.
  - [Documentation and releases](docs/agents/delivery.md).
  - [Issue workflow](docs/agents/issue-tracker.md), [triage](docs/agents/triage-labels.md), [domain and ADRs](docs/agents/domain.md).
