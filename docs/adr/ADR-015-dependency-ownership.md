# ADR-015: Dependency Ownership

- Status: Accepted (Phase 5)
- Date: 2026-09-23

## Context

Dependencies must be a single source of truth across PI boards, project views, and conflict detectors. Forking dependency rows per module causes drift and false “resolved” signals.

## Decision

Canonical entity is `PlanningDependency` (org-scoped): types `BLOCKS` | `DEPENDS_ON` | `RELATED`; subjects WorkItem↔WorkItem or Project↔Project in MVP. Self-links rejected; identical edges unique-constrained. Modules **project/read** the canonical row — they do not copy independent dependency tables. Timing conflicts derive from allocation iteration sequences of the work-item ends within a PI.

## Consequences

Cross-department dependencies are first-class without duplicating ownership. Status/criticality/owner/needed-by live on one row. Later graph UX and external sync attach to the same entity.
