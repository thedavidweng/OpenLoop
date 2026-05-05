# Workflow
- Execute implementation plans autonomously without stopping for confirmation until complete. Confidence: 0.85
- Batch multiple questions together rather than asking one at a time. Confidence: 0.80
- Create ADR (Architecture Decision Records) for architectural changes. Confidence: 0.70

# UX Design Philosophy
- Design frontend for simplicity and "it just works" experience; hide complexity from beginners, expose advanced options in collapsible panels. Confidence: 0.80
- Target product-level quality comparable to commercial tools, not toy-level implementations. Confidence: 0.75
- Keep UI parameters unchanged after user cancellation (no restore logic needed). Confidence: 0.70
- Reference OpenKara as a design model when implementing similar features (e.g., settings danger zone, model management UX). Confidence: 0.65

# Quality Standards
- Verify with manual E2E testing before committing; do not commit until everything is verified working. Confidence: 0.75
- Ensure native app feel rather than web-like experience. Confidence: 0.70
