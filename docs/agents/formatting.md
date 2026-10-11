# Formatting and hooks

The `lefthook` pre-commit hook runs `oxfmt` on staged JS, TS, JSON, CSS, HTML and YAML, and re-stages fixes. It formats native Swift through `swift format`. Run `pnpm install` once to run `lefthook install` via the package's `prepare` script.

Repair hook failures instead of bypassing them. Watch `.github/workflows/*.yml`, root configuration files, and touched JSON/CSS/HTML/YAML. `oxfmt` excludes `docs/`, native assets/build outputs, Markdown and TOML; refer to `.oxfmtrc.json`. Use `pnpm format:check` when validating JS/TS formatting without making edits.
