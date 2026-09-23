# ADR-013: Multi-Team Capacity

- Status: Accepted (Phase 5)
- Date: 2026-09-23

## Context

Resources often contribute to more than one team in a PI. Counting full weekly capacity on every membership double-counts people and hides overload.

## Decision

`ResourceMembership.allocationPercent` (default 100) is the share of `Resource.capacityHoursPerWeek` attributable to that team. Active memberships for one resource must sum ≤ 100 (validated in `assignMembership` via `assertAllocationPercentsWithinLimit`). Team capacity is the sum of member effective hours for that team’s memberships only.

## Consequences

A 40/60 shared engineer contributes 40% and 60% of weekly hours to each team — org-wide capacity for that person stays ≤ weekly hours × weeks. Conflict engine can also flag percent sums > 100 as `RESOURCE_ALLOCATION_CONFLICT`.
