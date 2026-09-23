# Phase 5 Implementation

**Status:** Implemented on branch `phase5-pi-planning`  
**Baseline:** Phase 0–4 (Organization + Initiative + Governance/PoC + Pilot/Project)

---

## 1. Goal

Deliver multi-department Program Increment (PI) Planning as a first-class capability:

```text
PI + iterations + participation → allocate work → capacity/utilization →
conflicts (overload, dependency timing) → immutable baseline → changes since
```

Phase 5 does **not** implement Phase 6 executive cockpit polish, Excel import, AI recommendations-as-decisions, binary document storage, production OIDC, or multi-branch what-if scenario UX (scenario table foundation only).

---

## 2. Core model

| Entity | Role |
|---|---|
| `ProgramIncrement` | Org/section-scoped PI with status machine |
| `PiIteration` | Ordered timeboxes within PI dates (no overlap) |
| `PiParticipatingDepartment` / `PiParticipatingTeam` | Explicit multi-dept participation |
| `PlanningRevision` | Scenario foundation; MVP uses `key=CURRENT` |
| `WorkAllocation` | Work item placement on revision+iteration+team (hours) |
| `ResourceAvailability` | Per-iteration override/reduction |
| `PlanningDependency` | Canonical WI↔WI / Project↔Project dependency |
| `PiBaseline` | Immutable JSON snapshot; rebaseline = new `versionNumber` |

Work items remain `ProjectWorkItem` — allocations **reference** them; fields are never copied into PI rows.

---

## 3. Capacity & utilization

Canonical unit = **hours** (Decimal). Story points are not mixed into utilization math.

**Effective capacity (resource on a team, per iteration):**

```text
weeklyHours × (allocationPercent / 100) × weeks(iteration) × availabilityFactor
− reductionHours
```

When `ResourceAvailability.availableHours` is set, it replaces the weekly derivation for that iteration (then reduction still applies).

**Utilization:**

```text
utilization = plannedLoadHours / effectiveCapacityHours
```

Thresholds (`capacity-policy.ts`):

| Band | Rule |
|---|---|
| overload | utilization > 1.0 |
| near | 0.85 ≤ utilization ≤ 1.0 |
| under | utilization < 0.5 |
| ok | otherwise |

### Multi-team handling

`ResourceMembership.allocationPercent` splits a resource’s weekly capacity across teams. Active memberships for one resource must sum ≤ 100 (validated on assign). Team capacity sums member effective hours — a 50/50 shared person contributes half capacity to each team, never 2×.

---

## 4. Allocation & drag/drop persistence

Board drag/drop is **not** a client-only rearrange. Moves persist via server mutations:

- `allocateWork` — backlog → iteration/team (upsert by revision+workItem)
- `moveAllocation` — iteration and/or team change with optimistic `expectedVersion`
- `removeAllocation` — return to backlog

Unique `(revisionId, workItemId)` prevents duplicate placements. Stale concurrent moves → `STALE_VERSION`.

---

## 5. Conflict derivation

Conflicts are **derived on read** (`deriveConflicts` / `deriveConflictsForPi`) — no conflict cache table. Stale “healthy” after an overload is worse than recomputing from the current allocation snapshot.

MVP detectors include:

- `TEAM_OVERLOAD` / `RESOURCE_OVERLOAD`
- `DEPENDENCY_TIMING` (successor iteration before predecessor)
- `MILESTONE_TIMING` (planned date outside PI)
- `OUTSIDE_PROJECT_DATES` / `OUTSIDE_PI_DATES`
- `RESOURCE_ALLOCATION_CONFLICT` (membership percents > 100)

---

## 6. Baseline vs current plan

| Concept | Mutable? | Notes |
|---|---|---|
| CURRENT `PlanningRevision` + allocations | Yes | Live working plan |
| `PiBaseline.payload` | **No** | Point-in-time snapshot; never updated |
| Rebaseline | N/A | Inserts `versionNumber + 1` |

First baseline requires PI `REVIEW` and sets status `BASELINED`. Rebaseline allowed from `BASELINED` / `ACTIVE`.

`getChangesSince` compares live CURRENT snapshot to a baseline payload (`allocation_moved`, hours, participation, dependencies, etc.).

---

## 7. Scenario foundation

`PlanningRevision` supports future Scenario A/B rows (`key`, `isCurrent`). MVP creates only `CURRENT` on PI create. Allocations hang off a revision so later what-if branches can share the same shape without rewriting allocation storage.

---

## 8. Lifecycle & auth

PI status (adjacent):

`DRAFT → PLANNING → REVIEW → BASELINED → ACTIVE → CLOSED`

(+ `REVIEW↔PLANNING`, `BASELINED→REVIEW` for re-planning). `BASELINED` is entered via `createBaseline`, not `transitionStatus`.

Permissions: `pi.view`, `pi.create`, `pi.edit`, `pi.transition`, `pi.allocate`, `pi.manage_capacity`, `pi.manage_dependency`, `pi.review`, `pi.baseline` — role-granted, org-scoped.

---

## 9. Testing & smoke

- Unit: `tests/unit/capacity-policy.test.ts`, `tests/unit/pi-planning-engines.test.ts`
- Integration: `tests/integration/pi-planning.test.ts`
- Smoke: `npx tsx scripts/smoke-phase5.ts` → prints `{ ok: true, sections: … }`

Service-level only — tests do not depend on Next.js pages.

---

## 10. ADRs

- [ADR-012](./adr/ADR-012-capacity-unit-model.md) — hours as capacity unit
- [ADR-013](./adr/ADR-013-multi-team-capacity.md) — membership percent split
- [ADR-014](./adr/ADR-014-planning-allocation.md) — allocation / drag persistence
- [ADR-015](./adr/ADR-015-dependency-ownership.md) — canonical dependencies
- [ADR-016](./adr/ADR-016-pi-baseline-snapshot.md) — immutable baselines
- [ADR-017](./adr/ADR-017-planning-concurrency.md) — optimistic concurrency

---

## 11. Deferred to Phase 6 / later

Executive attention cockpit hardening, audit reporting UX, Excel import, polished DnD UI, multi-baseline compare UX, what-if scenario branches beyond CURRENT foundation.
