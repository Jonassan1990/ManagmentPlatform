# ADR-025 — Project Closure

**Status:** Accepted  
**Phase:** 1D — Project Closure & Delivery Completion  
**Date:** 2026-10-08

## Context

Projects support execution (milestones, work items, issues) but lacked an explicit, controlled completion process. Status alone (`COMPLETED` / `CANCELLED`) is insufficient historical evidence: we must know who closed the project, when, the outcome, and what unresolved concerns remained.

## Decision

### Closure model

Introduce **`ProjectClosure`** (0..1 per Project):

| Field | Role |
|---|---|
| `projectId` (unique) | One closure record |
| `closedAt` / `closedByPrincipalId` | Actor + time |
| `outcome` | `DELIVERED` \| `PARTIALLY_DELIVERED` \| `CANCELLED` |
| `summary` / `lessonsLearned` / `finalDeliveryNote` | Optional narrative |
| `readinessSnapshot` | Hard blockers / warnings / counts at close time |

Existing `ProjectStatus` values are reused:

- `DELIVERED` / `PARTIALLY_DELIVERED` → `ProjectStatus.COMPLETED`
- `CANCELLED` → `ProjectStatus.CANCELLED`

Ordinary `updateProject` must not set `COMPLETED` / `CANCELLED`; only `closeProject` does.

### Outcomes

| Outcome | Meaning |
|---|---|
| `DELIVERED` | Delivery objectives met; no active blockers; no open CRITICAL issues |
| `PARTIALLY_DELIVERED` | Accepted incomplete delivery; active blockers still hard-block |
| `CANCELLED` | Project stopped without delivery; open work is warning-only |

### Readiness policy

Reuses Phase 1C `isActiveBlockerIssue` (`isBlocker &&` non-terminal status).

**Hard blockers**

- Already closed / archived
- `DELIVERED` / `PARTIALLY_DELIVERED`: any active blocker Issue
- `DELIVERED` only: open CRITICAL Issues that are not already active blockers

**Warnings** (require `acknowledgeWarnings`)

- Incomplete milestones / work items
- Remaining open Issues not already hard-blocked

Unresolved work is **never** silently rewritten on close.

### Authorization

New permission: `project.close`.

- Granted to management role packs that already hold delivery authority (Org Admin, Portfolio/Section/Department Manager, Project Manager).
- **Not** granted via Project Owner ownership (ownership still grants `project.view` / `project.edit` only).
- Viewers and Issue owners do not gain close rights.
- Rationale: closure is more sensitive than ordinary editing; Phase 1D prefers conservative authority.

### Post-close rules

Closed projects are historical / read-only for delivery mutations:

- Project field / budget updates
- Milestone / work item create & update
- Issue create / update / status / resolve

PI baselines and historical allocations are untouched. Closed projects are excluded from **new** planning candidates (`COMPLETED` added to `notIn` alongside `CANCELLED` / `ARCHIVED`).

### Idempotency

Repeated `closeProject` → `CONFLICT` (“already closed”). No second `ProjectClosure` row.

### Audit

Append-only `project.closed` with outcome, timestamp, readiness snapshot, summary reference, initiative id.

### Governance

No new Governance gate. Decision / Approval / ReviewSnapshot / PoC / Pilot unchanged.

## Consequences

- Explicit closure UI with readiness + confirmation.
- Migration `20261008220000_phase1d_project_closure` is additive.
- Existing Projects remain valid without a closure row.
