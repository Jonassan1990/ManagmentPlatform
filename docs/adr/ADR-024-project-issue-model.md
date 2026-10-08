# ADR-024: Project Issue Model

- Status: Accepted (Phase 1C)
- Date: 2026-10-08

## Context

Delivery needs a first-class **Issue** for problems that have already happened, distinct from Initiative **Risk** (uncertain future events). Portfolio/PI will later surface open blockers; Phase 1C introduces the Project-scoped aggregate only.

## Decision

### Concepts

| Term | Meaning |
|---|---|
| **Risk** | Something uncertain that **may** happen (Initiative SoT) |
| **Issue** | A problem that **has** happened (Project SoT) |
| **Blocker** | An **active** Issue with `isBlocker=true`, **or** a blocking PlanningDependency |

**No Blocker entity/table/service.** Blocker is a derived flag on Issue (and separately on dependencies).

### Aggregate

```text
Project
 └── ProjectIssue
```

No polymorphic subjects (`InitiativeIssue`, `PiIssue`, …) in this phase.

### Lifecycle

```text
OPEN → IN_PROGRESS → RESOLVED → CLOSED
```

Reopen from RESOLVED/CLOSED → OPEN or IN_PROGRESS is allowed. Resolution text is **required** when entering `RESOLVED` (and when using `resolveIssue`).

### Active blocker (derived)

```text
isBlocker == true AND status ∉ { RESOLVED, CLOSED }
```

Do not persist a second `activeBlocker` boolean. Terminal issues never count as active blockers even if `isBlocker` remains true in storage.

### Ownership / actor

- Business owner: optional `ownerResourceId` (PERSON Resource, same org) + `ownerName` snapshot (ADR-021)
- Actor: Principal (audit)
- Issue owner does **not** grant authorization (Phase 0C unchanged)

### Authorization

Reuse `project.view` / `project.edit` (including PROJECT_OWNER relationship for edit). No `issue.*` permissions in 1C.

### Related risk

Optional `relatedRiskId` → Initiative `Risk` on the same Initiative. Explicit link only — no automatic Risk→Issue conversion, no automatic Risk status change.

### Delete semantics

`ProjectIssue.projectId` uses **Cascade**, matching Milestone/WorkItem. Project itself is **Restrict** from Initiative, so normal history keeps Project+Issues. Cascade applies only if a Project row is removed (tests / exceptional teardown).

### Traceability

```text
Issue → Project → Initiative
```

No denormalized `initiativeId` on Issue.

## Consequences

- Project detail shows open issues / active blockers / critical open counts from real data
- Later PI/Portfolio can query Project Issues via WorkAllocation → WorkItem → Project without schema coupling in 1C
- Audit: `project.issue.created` / `.updated` / `.status_changed` / `.resolved`
