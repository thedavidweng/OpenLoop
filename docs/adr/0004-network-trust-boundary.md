# ADR-0004: Network Trust Boundary

**Status:** Accepted
**Date:** 2026-05-14
**Author:** OpenLoop engineering

## Context

OpenLoop is a local-first application, but it does make selective outbound network
connections for specific, user-visible purposes. We need to define the trust
boundary for these connections:

- Which domains are trusted and why.
- How outbound URLs are sourced (hardcoded vs. configurable).
- What data is permitted to cross the network boundary.

Without a documented trust boundary, future contributors might add arbitrary
network calls, eroding the local-first property and potentially exposing user
data (prompts, lyrics) to external services.

## Decision

OpenLoop's network trust boundary is defined as follows:

### Outbound connections

The application makes outbound connections only in these scenarios:

| Scenario | Destination | URL Source | User Control |
|----------|-------------|------------|--------------|
| Model download | `huggingface.co` or a configured mirror | Settings (`modelDirectory`, HF mirror URL) | Configurable via Settings UI |
| Update check | `api.github.com/repos/openmusic/openloop/releases/latest` | Manifest (`tauri.conf.json` → `plugins.updater.endpoints`) | Can be disabled; open-source users can build without updater |
| Update download | GitHub Releases asset URL (derived from check response) | Runtime (from updater response) | Same as update check |

### What never crosses the boundary

- **User prompts** — never sent to any external service.
- **Lyrics** — never sent to any external service.
- **Generated audio** — never sent to any external service.
- **Telemetry or analytics** — none collected or transmitted.
- **Crash reports** — none collected or transmitted.
- **Personal information** — no account system exists; no PII is stored or sent.

### URL sourcing rules

1. **No hardcoded arbitrary domains in application code.**
   - Model download URLs come from settings (defaulting to Hugging Face).
   - Updater endpoints come from `tauri.conf.json` manifest.
   - The only local-backend URLs are `http://127.0.0.1:*` / `http://localhost:*`,
     which are loopback-only and covered by the CSP `connect-src` directive.

2. **All outbound URLs must be declared in one of:**
   - `tauri.conf.json` (manifest-level configuration).
   - Settings persisted in the local SQLite database.
   - The updater runtime response (which is a signed, verified response from a
     manifest-declared endpoint).

3. **Any new outbound connection requires an ADR update.**
   - Adding a new external domain must be documented here and approved through
     the standard ADR review process.

### Enforcement

- **CSP:** The `connect-src` directive in `tauri.conf.json` restricts WebView
  HTTP requests to `http://127.0.0.1:*` and `http://localhost:*`. External API
  calls from the frontend are blocked by CSP.
- **dangerousDisableAssetCspModification:** Set to `false` to prevent Tauri from
  silently loosening CSP at runtime.
- **Code review:** Any PR introducing `fetch()`, `new WebSocket()`,
  `reqwest`, or similar networking APIs must be reviewed against this ADR.
- **Updater integrity:** Update payloads are signed; the public key is pinned in
  `tauri.conf.json`.

## Consequences

### Positive

- Clear, documented trust boundary protects the local-first promise.
- Prevents accidental data exfiltration via CSP + code review.
- Users can audit all outbound destinations from a single source of truth.
- Update integrity is cryptographically verified.

### Negative

- Adding legitimate external features (e.g., community model registry) requires
  ADR review and CSP updates.
- Developers must route model downloads through settings rather than hardcoding
  URLs.

## Alternatives Considered

1. **Allow all outbound with app-level firewall:** Rejected — too complex for
   v0.1; CSP provides simpler enforcement.
2. **Proxy all outbound through a Rust-side allowlist:** Rejected — adds
   unnecessary indirection; manifest-declared URLs + CSP is sufficient for
   v0.1.
3. **No documented boundary (status quo):** Rejected — risks erosion of
   local-first property as the project grows.

## Related

- ADR-0003: Content Security Policy (CSP that enforces connect-src restrictions)
- `src-tauri/tauri.conf.json` — `app.security.csp` and `app.security.dangerousDisableAssetCspModification`
- `src-tauri/tauri.conf.json` — `plugins.updater.endpoints`
- Settings model — model download URL configuration
