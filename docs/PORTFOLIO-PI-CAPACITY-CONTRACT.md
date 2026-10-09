# Portfolio PI & Capacity Query Contract (M2E-A)

**Status:** Implemented (query layer only — no UI)  
**Module:** `src/modules/portfolio/`  
**Service:** `PortfolioPiCapacityQueryService`  
**Actions:** `listPortfolioProgramIncrementsAction`, `getPortfolioPiCapacityAction`  
**Capacity engine:** existing `capacity-policy` + `CapacityService.computeCapacityViews` + `PlanningService.deriveConflictsForPi`

This is a **read-only** Portfolio capability. It does not redesign PI Planning, create Portfolio tables, or introduce a second capacity formula.

---

## Purpose

Provide accurate, explainable Program Increment (PI) and resource-capacity information for management:

1. Active / upcoming / completed PIs (status + date semantics)
2. PI-level available, committed, remaining hours + utilization
3. Department- and team-level capacity roll-ups
4. Resource-level capacity (bounded, scoped)
5. Overloaded / underutilized teams (capacity-policy bands)
6. Project commitments from `WorkAllocation` → `WorkItem` → `Project`
7. Allocation conflicts via the existing conflict engine
8. Current `PlanningRevision` vs approved `PiBaseline` (never silently mixed)

---

## Query APIs

### `listProgramIncrements`

| Input | Notes |
|---|---|
| `organizationId` | Required |
| `departmentId` | Optional Phase 0C narrow |
| `sectionId` | Optional; further narrows to section departments |
| `piId` | Optional single-PI filter |
| `lifecycle` | Optional `ACTIVE` \| `UPCOMING` \| `COMPLETED` \| `OTHER` |
| `asOf` | Default now; drives lifecycle dates |
| `page` / `pageSize` | Bounded (default 25, max 100) |

Returns paginated rows with `status`, derived `lifecycle`, current-revision flag, baseline count / latest version, and safe `href` (`/pi/{piId}`).

### `getPiCapacityOverview`

| Input | Notes |
|---|---|
| `organizationId` | Required |
| `piId` | Optional — without it → `no_pi_selected` |
| `departmentId` / `sectionId` | Scope filters |
| `asOf` | Explicit evaluation timestamp (ISO in response) |
| `includeResources` | Default true; bounded pagination |
| `includeProjectCommitments` | Default true |
| `includeConflicts` | Default true |
| `resourcePage` / `resourcePageSize` | Default 25 / max 100 |

---

## Discriminated capacity states

| State | Meaning |
|---|---|
| `no_pi_selected` | Caller did not provide `piId` |
| `unavailable` | Cannot calculate reliably (no CURRENT revision, no in-scope participating teams, no iterations, etc.) |
| `ready` | Live metrics computed from CURRENT revision + capacity-policy |

**Zero hours are valid** when calculation succeeds with empty load or zero effective capacity. Do not conflate `0` with `unavailable`.

Period boundaries are the PI / iteration `startDate`–`endDate` used by `weeksBetween` in capacity-policy. Response always includes explicit `asOf`.

---

## Lifecycle buckets

| Bucket | Rule (`asOf`) |
|---|---|
| `ACTIVE` | `status === ACTIVE` |
| `COMPLETED` | `status === CLOSED` |
| `UPCOMING` | not ACTIVE/CLOSED and `startDate > asOf` |
| `OTHER` | everything else (e.g. past-dated DRAFT/PLANNING) |

Status wins over dates for ACTIVE and CLOSED.

---

## Capacity source of truth (preserved)

| Input | Role |
|---|---|
| `Resource.capacityHoursPerWeek` | Weekly hours base |
| `ResourceMembership.allocationPercent` | Multi-team split — **not** project commitment |
| `ResourceAvailability.availableHours` / `reductionHours` | Iteration override / reduction |
| `WorkAllocation.plannedHours` | Committed project load on CURRENT revision |
| `capacity-policy.effectiveResourceCapacity` | Effective available hours |
| `capacity-policy.utilization` / `utilizationBand` | Utilization + bands |

**Canonical unit = hours.** Story points are never mixed into these metrics.

### Formulas (delegated — not reimplemented)

```
available = Σ effectiveResourceCapacity(members, iteration window, availability)
committed = Σ WorkAllocation.plannedHours (team/iteration or resource/iteration)
remaining = available − committed
utilization = committed / available   (null when available ≤ 0 and committed = 0;
              +∞ when available ≤ 0 and committed > 0)
```

Bands (from `CAPACITY_THRESHOLDS`):

| Band | Condition |
|---|---|
| `none` | utilization is null |
| `under` | utilization < 0.5 |
| `ok` | 0.5 ≤ utilization < 0.85 |
| `near` | 0.85 ≤ utilization ≤ 1.0 |
| `overload` | utilization > 1.0 |

Department rows sum team-iteration available/committed hours, then recalculate utilization/band.

---

## Project commitments

Derived only from CURRENT revision allocations:

`WorkAllocation` → `ProjectWorkItem` → `Project`

Fields: project identity, `committedHours`, `workItemCount`, `allocationCount`, href `/initiatives/{initiativeId}/project`.

Membership allocation percent is **never** treated as project commitment.

---

## Conflicts

Uses `PlanningService.deriveConflictsForPi` (existing conflict engine). Team-scoped conflicts outside the caller's department filter are dropped. No new conflict rules.

---

## Revision vs baseline

| Concept | Semantics |
|---|---|
| Live metrics | Always the PI's **CURRENT** `PlanningRevision` (`isCurrent: true`) |
| `PiBaseline` | Historical, immutable snapshot (`schemaVersion: 1`) |
| Comparison | When a baseline exists with recognized schemaVersion=1 allocations: report `baselineCommittedHours`, `liveCommittedHours`, `deltaHours` |
| Unavailable comparison | No baseline, or unrecognized payload → `{ available: false, reason }` — **never invent numbers** |
| Mixing | Live rows never include baseline commitments; baseline hours appear only in `baselineComparison` |

---

## Data quality

On `ready` results, `dataQuality` reports:

- `missingCapacityInputs` — memberships with null `capacityHoursPerWeek` and no `availableHours` override (engine still treats as **0 hours**, not unavailable)
- `notes` — human-readable explanations

Distinguish:

| Signal | Meaning |
|---|---|
| `0 hours` | Valid calculated zero |
| `unavailable` | Structural inability to calculate |
| `no_pi_selected` | Missing PI filter |
| empty participating teams | `unavailable` with explicit reason |
| missing capacity inputs | Flagged in `dataQuality`; hours remain 0 |

---

## Authorization (Phase 0C + M2A/M2D)

Uses `resolvePortfolioVisibility` then PI `PI_VIEW` checks:

| Role | Typical scope |
|---|---|
| Organization Admin | Organization |
| Section Manager | Section → descendant departments |
| Department Manager | Department |
| Team Manager | Team → department visibility (portfolio convention) |
| Viewer | Bound read-only scope |

Rules:

- Cross-org and sibling-department leakage forbidden
- `sectionId` / `departmentId` filters **never expand** visibility
- PI-wide access does **not** imply every Resource is shown outside scoped participating teams
- Resource rows are limited to memberships of in-scope participating teams and paginated

---

## Non-goals (M2E-A exclusions)

- PI scenarios A/B
- New allocations or planning workflows
- PI approval / transition changes
- New capacity formulas or availability workflows
- Portfolio UI
- Dependency expansion beyond existing conflict derivation
- New database tables
- Changes to Project / Issue / Closure modules

---

## Known limitations

1. Team-scoped RoleBindings expand to **department** visibility in portfolio (same as M2A) — sibling teams in that department may appear.
2. Section-scoped PIs require ancestor (org/section) `PI_VIEW`; department-only bindings cannot view the PI entity (Phase 0C scope matching).
3. Baseline comparison is committed-hours delta only; it does not reconstruct per-team baseline capacity.
4. Live capacity uses CURRENT revision only; historical revision browsing is out of scope.
5. `asOf` affects lifecycle listing; capacity hours use stored iteration windows (not truncated to asOf).

---

## M2E-B (explicitly deferred)

UI surfaces, charts, and management navigation for these queries are **M2E-B** and must not be implemented in this slice.
