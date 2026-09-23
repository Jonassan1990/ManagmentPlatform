# ADR-014: Planning Allocation

- Status: Accepted (Phase 5)
- Date: 2026-09-23

## Context

PI boards need backlog → iteration/team placement and moves across cells. Client-only reordering would diverge from capacity and conflict truth.

## Decision

Allocations are durable `WorkAllocation` rows on the CURRENT `PlanningRevision`, unique per `(revisionId, workItemId)`. Server mutations:

- `allocateWork` — create/upsert placement (planned hours default from work-item estimate)
- `moveAllocation` — change iteration/team/resource with optimistic version
- `removeAllocation` — delete placement (returns to backlog)

Drag/drop UX is a thin client over these mutations. Work items stay on `ProjectWorkItem`; allocation never copies title/estimate into PI storage.

## Consequences

Backlog is “unallocated work items in participating project departments.” Concurrent edits use `STALE_VERSION`. Future scenario revisions can hold alternate allocation sets without changing work-item identity.
