# M2D-A — Delivery Health Signal Evidence (pre-implementation)

Inspection notes before implementing the classifier. Canonical contract:
`PORTFOLIO-DELIVERY-HEALTH-CONTRACT.md`.

## Existing reliable signals

| Signal | Source | Policy reuse | Notes |
|---|---|---|---|
| Terminal project | `Project.status` ∈ {COMPLETED, CANCELLED} | `isProjectClosedStatus` (Phase 1D) | ARCHIVED excluded from portfolio |
| Closure outcome | `ProjectClosure.outcome` | ADR-025 | DELIVERED / PARTIALLY_DELIVERED / CANCELLED; status alone is not historical evidence |
| Active blocker | `ProjectIssue` where `isBlocker && !terminal` | `isActiveBlockerIssue` (Phase 1C) | RESOLVED/CLOSED never active |
| Critical open issue | open + `severity === CRITICAL` | `isTerminalIssueStatus` + `summarizeProjectIssues` | Distinct from blocker flag |
| Missed milestone | `ProjectMilestone.status === MISSED` | M2A delayed definition | Explicit status, not inferred |
| Critical milestone | `ProjectMilestone.criticality === true` | schema field | Combine with MISSED or plannedDate < asOf |
| Overdue project end | `plannedEnd != null && plannedEnd < asOf` | M2A delayed | Only meaningful for ACTIVE/ON_HOLD |
| Critical open dependency | `PlanningDependency` OPEN + CRITICAL | M2A dependency exposure | Attribute when PROJECT endpoint or WORK_ITEM on project |
| Schedule evidence | `plannedEnd` or milestone plannedDate / progress | M2A limitations | Absence ⇒ UNKNOWN, not invented ON_TRACK |

## Not used as health drivers

- PI capacity / conflict engine (portfolio-level; not project-attributable without invention)
- Governance submissions (initiative gate, not delivery health)
- Ownership / Resource FKs (identity, not health)
- Arbitrary numerical scores

## Precedence reconciled with ProjectStatus

1. `CANCELLED` → classification **CANCELLED** (never COMPLETED)
2. `COMPLETED` → **COMPLETED** (preserve closure outcome when present)
3. Active blocker → **BLOCKED**
4. Critical open issue or overdue critical milestone → **AT_RISK**
5. Other missed/overdue milestones, overdue plannedEnd, critical open dependency → **AT_RISK**
6. Sufficient schedule evidence + no adverse signals → **ON_TRACK**
7. Else → **UNKNOWN** (e.g. `INSUFFICIENT_SCHEDULE_DATA`)

`ACTIVE` and `ON_HOLD` share the same non-terminal evaluation path.
`ARCHIVED` is out of portfolio scope (unchanged from M2A).
