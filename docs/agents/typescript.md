# TypeScript contracts

- Do not silence type errors using `as any`, `@ts-ignore` or `@ts-expect-error`; fix the types.
- Preserve typed contracts between JS/TS tooling and the native Swift runtime when touching their boundary.
- Keep the existing project-specific checks and type/build scripts authoritative rather than inventing new abstractions or bespoke code formatters.
