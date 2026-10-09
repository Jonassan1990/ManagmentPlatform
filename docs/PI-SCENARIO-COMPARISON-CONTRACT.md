# PI Scenario Comparison Contract (M3C-A)

**Status:** Implemented (query/domain only — no UI)  
**Baseline main (M3B):** `e7c36f8b127f1e766deb50780018f5bb1b14ccaa`  
**Related:** [PROJECT-PLATFORM-M3-SCENARIO-ARCHITECTURE.md](./PROJECT-PLATFORM-M3-SCENARIO-ARCHITECTURE.md) §11, ADR-012/014/016

---

## 1. Purpose

Provide a **read-only**, deterministic comparison of two or three `PlanningRevision` rows on the same Program Increment — typically CURRENT vs scenario(s), or scenario vs scenario — using the existing capacity and conflict engines.

Entry point:

```ts
planning.compareScenarios(principal, {
  piId,
  revisionIds: [/* 2–3 ids */],
  referenceRevisionId?: string, // defaults to revisionIds[0]
  asOf?: Date,
})
```

---

## 2. Authorization

| Rule | Behavior |
|---|---|
| Permission | `PI_VIEW` via `piAuthScope(organizationId, sectionId)` |
| Same PI | All `revisionIds` must exist on `piId` |
| Cross-org | Denied by PI org scope |
| Viewer | Allowed (read-only) |
| Archived scenarios | Comparable when their revision id is passed explicitly (read-only) |
| Mutations | None — service never writes revisions, allocations, or baselines |

---

## 3. Calculation semantics

| Metric | Source |
|---|---|
| Available hours | `CapacityService.computeCapacityViews(piId, revisionId)` team `effectiveCapacityHours` sum |
| Committed hours | Same views’ `plannedLoadHours` sum (= `WorkAllocation.plannedHours` for that revision) |
| Remaining | available − committed |
| Utilization | committed / available (`null` when both zero; infinite load on zero capacity treated as non-finite → `utilizationPercent: null` + overload via team bands) |
| Overloaded teams | Count of team×iteration rows with band `overload` (`capacity-policy` / `isOverloaded`) |
| Conflicts | `PlanningService.deriveConflictsForPi(piId, revisionId)` (existing conflict-engine) |
| Project commitments | Sum of allocation hours grouped by `workItem.project` |
| Resource diffs | Resource×iteration rows from capacity views |
| Work-item diffs | Side-by-side allocation presence / hours / iteration / team / resource |

**Shared inputs:** Resource weekly capacity, membership %, and `ResourceAvailability` are PI/iteration-scoped and identical for every compared revision. Only allocation commitments differ.

**asOf:** Recorded on the result for auditability of the read. Capacity formulas use current membership/availability rows (same as live board); `asOf` does not time-travel historical memberships in M3C-A.

**Baselines:** Not mixed into this contract. Do not pass baseline payloads as revision sides. Dirty-vs-baseline remains `getChangesSince` / Portfolio baseline compare.

---

## 4. Difference contract

- `referenceRevisionId` anchors deltas (`deltaFromReference`, project `deltaFromReferenceHours`, conflict only-on-revision buckets).
- Work-item `change` values: `unchanged` | `added` | `removed` | `hours_changed` | `placement_changed` | `hours_and_placement_changed` (relative to reference).
- No arbitrary “scenario score” field.

Ordering:

1. `revisions` / `totals` follow caller `revisionIds` order.
2. Team / resource / project rows are deterministic map iteration order by composite keys.

---

## 5. Limits

| Limit | Value |
|---|---|
| Min revisions | 2 |
| Max revisions | 3 |
| Recommended scenarios per PI | 10 (soft) |
| Recommended total allocation rows across compared revisions | 5000 (soft; warned in `dataQuality.notes`) |

Queries are batched per revision (capacity + conflicts + allocations in parallel, max 3 revisions). Unrelated PIs are not loaded.

---

## 6. Data-quality warnings

`dataQuality.missingCapacityInputs` and `notes` explain:

- Missing `capacityHoursPerWeek` treated as **0 hours** when no availability override (not a separate “unavailable” KPI state in this contract).
- Shared capacity input assumption.
- Explicit note that baselines are excluded.

---

## 7. Exclusions (later milestones)

- Comparison UI (M3C-B)
- Scenario select / promote / approve / baseline (M3D)
- Portfolio KPI changes (remain CURRENT-only)

---

## 8. Result shape (summary)

See `src/modules/pi-planning/application/scenario-comparison-types.ts`:

- `ScenarioComparisonResult`: revisions, capacityAssumptions, totals, byTeam, byProject, byResource, workItemDiffs, allocationChanges, conflicts, dataQuality, limits
