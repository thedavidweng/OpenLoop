# Stale Docs Cleanup Report

## Section A — Issue tracker

Selected: **GitHub Issues**
Evidence: `git remote` → `github.com/thedavidweng/OpenLoop`, `gh` available
Workflow: `gh issue create`

## Deleted

| File | Reason |
| --- | --- |
| `docs/archive/plans/Development_Plan.md` | Completed plan — all phases marked done, v0.1.0 shipped |
| `docs/archive/plans/2026-04-24-openkara-shell-parity-design.md` | Archive debris |
| `docs/archive/plans/2026-04-24-openkara-shell-parity-implementation.md` | Archive debris |
| `docs/archive/plans/2026-04-25-commercial-generation-workspace-design.md` | Archive debris |
| `docs/archive/plans/2026-04-25-commercial-generation-workspace-implementation.md` | Archive debris |
| `docs/plans/2026-04-28-acestep-feature-benefits.md` | "Status: Completed on 2026-04-29" |
| `docs/plans/2026-04-28-ui-review.md` | "Status: Completed on 2026-04-29" |
| `docs/plans/2026-05-13-cli-backend-vnext.md` | All milestones [x], implementation done |
| `docs/plans/2026-05-14-v1-readiness-master-plan.md` | Massive completed master plan (713 lines) |
| `docs/plans/2026-05-17-complexity-hotspots-optimization.md` | "Plan only" — work covered by issue #59 |
| `docs/plans/2026-05-30-cli-ux-fixes.md` | Plan, issue #57 CLOSED |
| `docs/2026-06-09-cli-clap-refactoring.md` | Untracked handoff doc; clap files already exist in tree |
| `docs/2026-06-10-issue-plans-and-evals.md` | Untracked 700-line plan; all 29 items have matching GitHub issues |

## Rewritten

| File | Change |
| --- | --- |
| `docs/implementation-status.md` | Removed "Planned after v0.2" list; replaced with link to GitHub issues |
| `docs/superpowers/specs/2026-06-07-testing-strategy-design.md` | Removed "Status: Draft"; trimmed stale problem statement |
| `docs/specs/2026-05-04-openloop-cli-design.md` | Removed completed Phase 6 checklist items (update implementation-status.md, update PRD, update CONTEXT.md) |
| `README.md` | "Planned" section: replaced feature list with issue tracker link. "Known Limitations": replaced forward-looking Repaint language with issue link |

## Kept

| File | Reason |
| --- | --- |
| `docs/adr/0001–0004` | Durable architectural decision records |
| `docs/agents/domain.md` | Agent navigation guide (current, stable) |
| `docs/agents/issue-tracker.md` | GitHub workflow reference |
| `docs/agents/triage-labels.md` | Label mapping contract |
| `docs/cli.md` | Human CLI usage guide |
| `docs/OpenLoop_PRD.md` | Product requirements (marked "Implemented") |
| `docs/privacy.md` | Privacy policy (bilingual, current) |
| `docs/release.md` | Release checklist and Gatekeeper guide |
| `docs/release-notes/v0.1.0.md, v0.2.0.md, v0.2.1.md` | Human-readable release history |
| `docs/specs/event-schema.md` | Frozen NDJSON event contract |
| `docs/specs/2026-05-04-openloop-cli-design.md` | CLI design spec (rewritten to remove stale checklists) |
| `docs/testing.md` | QA procedures, manual checklist, regression triggers |

## Remaining decisions

- `docs/implementation-status.md` duplicates README content. Consider deleting and keeping README as single source of truth.
- `docs/OpenLoop_PRD.md` says "主要实现对象: Codex / Coding Agent / Human Developer" — agent-facing language in a human doc. Low priority to fix.
