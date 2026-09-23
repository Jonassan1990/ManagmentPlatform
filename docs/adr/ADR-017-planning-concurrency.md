# ADR-017: Planning Concurrency

- Status: Accepted (Phase 5)
- Date: 2026-09-23

## Context

Multiple planners may move the same card or edit the same PI/iteration/availability row. Last-write-wins without versions silently drops work.

## Decision

Optimistic concurrency via integer `version` on mutable planning entities (`ProgramIncrement`, `PiIteration`, `WorkAllocation`, `ResourceAvailability`, `PlanningDependency`, …). Updates require `expectedVersion` and increment on success; Prisma `P2025` / mismatch → `STALE_VERSION`. Allocation uniqueness `(revisionId, workItemId)` prevents duplicate concurrent creates of the same work item. Baselines are insert-only (no version race on payload).

## Consequences

Simultaneous moves on one allocation: one succeeds, one refreshes. Clients must re-read after stale errors. No distributed lock service for MVP.
