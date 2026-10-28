# Formatting and hooks

The hk pre-commit hook runs `oxfmt` on staged JS, TS, JSON, CSS, HTML and YAML, and re-stages fixes. It formats native Swift through `swift format`. Run `mise install` to install the tools and hooks.

Repair hook failures instead of bypassing them. Watch `.github/workflows/*.yml`, root configuration files, and touched JSON/CSS/HTML/YAML. `oxfmt` excludes `docs/`, native assets/build outputs, Markdown and TOML; refer to `.oxfmtrc.json`. Use `pnpm format:check` when validating JS/TS formatting without making edits.
