# ADR-012: Capacity Unit Model

- Status: Accepted (Phase 5)
- Date: 2026-09-23

## Context

Planning capacity must support utilization and overload detection across teams and resources. Mixing story points with hours in the same formulas produces meaningless utilization ratios and double-counting hazards when estimates come from different agile practices.

## Decision

Canonical capacity and load unit is **hours** (`Decimal`). `ProjectWorkItem.estimateHours` and `WorkAllocation.plannedHours` share that unit. Utilization is `plannedLoadHours / effectiveCapacityHours` with thresholds in `capacity-policy.ts` (overload > 1.0, near ≥ 0.85, under < 0.5). Story points are out of scope for Phase 5 planning math.

Effective resource capacity for an iteration:

`capacityHoursPerWeek × (allocationPercent/100) × weeks × availabilityFactor − reductionHours`, with optional `availableHours` override per iteration.

## Consequences

All capacity views and conflict detectors speak hours. Future point-based team practices would require an explicit conversion policy ADR; they must not silently enter utilization math.
