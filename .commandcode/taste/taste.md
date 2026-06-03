# Workflow
- Execute implementation plans autonomously without stopping for confirmation until complete. Confidence: 0.85
- Batch multiple questions together rather than asking one at a time. Confidence: 0.80
- Investigate code and documentation to answer design questions autonomously rather than asking the user; present findings and plans, not questions about details you can resolve yourself. Confidence: 0.65
- Create ADR (Architecture Decision Records) for architectural changes. Confidence: 0.70

# Architecture
- Use precise architectural vocabulary: Module, Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality. Avoid drifting into "component," "service," "API," or "boundary." Confidence: 0.85
- CLI and GUI are two entry points to the same software; unify shared logic into a single implementation rather than maintaining separate code paths for the same functionality. Confidence: 0.85

# UX Design Philosophy
- Design frontend for simplicity and "it just works" experience; hide complexity from beginners, expose advanced options in collapsible panels. Confidence: 0.80
- Target product-level quality comparable to commercial tools, not toy-level implementations. Confidence: 0.75
- Keep UI parameters unchanged after user cancellation (no restore logic needed). Confidence: 0.70
- Reference OpenKara as a design model when implementing similar features (e.g., settings danger zone, model management UX). Confidence: 0.65

# Testing
- Write meaningful, purposeful tests inspired by SQLite's testing approach; never generate bulk/boilerplate tests to chase coverage numbers. Confidence: 0.85

# CI/CD
- Optimize CI with parallel jobs, dependency caching (pnpm cache), and ubuntu-latest for non-platform-specific tasks; reserve macOS runners only for Rust tests requiring sidecars. Confidence: 0.75

# Documentation
- Apply progressive disclosure: keep only essential, stable, non-code-discoverable info in main config (Agents.md); move narrow/low-frequency rules to separate skills loaded on demand; let hooks handle deterministic constraints. Confidence: 0.80

# CLI
- CLI must work fully independently without opening the GUI main window, with all expected functionality available. Confidence: 0.75
- Users should never need to guess backend state or progress; cancellation must cleanly kill all processes with no orphans. Confidence: 0.70

# Quality Standards
- Verify with manual E2E testing before committing; do not commit until everything is verified working. Confidence: 0.75
- Ensure native app feel rather than web-like experience. Confidence: 0.70
