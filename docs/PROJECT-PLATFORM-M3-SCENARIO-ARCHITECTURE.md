# Project Platform — M3A PI Planning Scenarios & What-If Architecture Review

**Date:** 2026-10-09  
**Nature:** Architecture and domain design only — no schema, migration, or application behavior changes in this phase  
**Baseline main SHA (start):** `904113f7b36c1766c4b1ba0e0efd4f947cc9dc38`  
**Prior roadmap decision:** [PROJECT-PLATFORM-M2-MILESTONE-REVIEW.md](./PROJECT-PLATFORM-M2-MILESTONE-REVIEW.md) (M2F-B) — next product milestone = M3 Scenarios  
**Related:** [PI-PLANNING-MODEL.md](./PI-PLANNING-MODEL.md), [PHASE-5-IMPLEMENTATION.md](./PHASE-5-IMPLEMENTATION.md), ADR-014 / ADR-016 / ADR-017, [PORTFOLIO-PI-CAPACITY-CONTRACT.md](./PORTFOLIO-PI-CAPACITY-CONTRACT.md)

---

## 1. Executive Summary

M3 must let planners explore multiple independent planning alternatives for the same Program Increment without mutating the committed/current plan prematurely, then select, approve, and baseline a preferred plan.

**Recommendation: Option A — Extend `PlanningRevision`.**

Repository evidence already anticipates this shape:

- Prisma comment on `PlanningRevision`: *“Scenario foundation: MVP uses key='CURRENT' with isCurrent=true. Future Scenario A/B rows share the same shape; allocations belong to a revision.”* (`prisma/schema.prisma`)
- `WorkAllocation` is already revision-scoped with `@@unique([revisionId, workItemId])`
- ADR-014 / ADR-016 explicitly describe future non-CURRENT revision allocations and baselining by `revisionIdCaptured`
- Capacity and conflict engines consume allocation rows for a single revision id; they do **not** hardcode formulas to “one PI = one allocation set” beyond `requireCurrentRevision`

**M3A does not implement scenarios.** It defines isolation, capacity reuse, lifecycle, comparison, selection/approval, baseline compatibility, auth, audit, Portfolio query semantics, migration, ADR draft, and M3B–M3E roadmap.

**Critical invariants preserved:**

| Invariant | Evidence |
|---|---|
| `Resource` (+ membership / availability) = capacity inputs | `Resource`, `ResourceMembership`, `ResourceAvailability`; `capacity-policy` / `CapacityService` |
| `WorkAllocation.plannedHours` = commitment unit | ADR-012 / ADR-014; schema comment “canonical capacity unit” |
| Single capacity engine | `capacity-policy` + `CapacityService.computeCapacityViews` |
| Conflicts derived on read | `conflict-engine.ts` — no `PlanningConflict` table |
| Exactly one CURRENT revision per PI (product rule) | `requireCurrentRevision` filters `key=CURRENT` + `isCurrent=true`; M2F-B OQ |
| Immutable `PiBaseline` | ADR-016; insert-only `versionNumber` |
| Phase 0C authorization | `PERMISSIONS.PI_*` + role packs |
| Portfolio M2 reads CURRENT only | `portfolio-pi-capacity-query-service.ts` `isCurrent: true` |

---

## 2. Current PI Architecture

### 2.1 Hierarchy

```text
Organization
  └─ Section? (optional on ProgramIncrement)
       └─ ProgramIncrement
            ├─ PiIteration*
            ├─ PiParticipatingDepartment*
            ├─ PiParticipatingTeam*
            ├─ PlanningRevision*          ← TODAY: exactly one CURRENT created at PI create
            │     └─ WorkAllocation*      ← unique (revisionId, workItemId)
            └─ PiBaseline*                ← immutable JSON payload, schemaVersion=1
```

Capacity inputs live outside the revision tree:

```text
Resource
  ├─ ResourceMembership (team %, effective window)
  └─ ResourceAvailability (per iteration override / reduction)
```

Dependencies are org-scoped canonical rows (`PlanningDependency`), not revision-scoped.

### 2.2 Status model (`PiStatus`)

`DRAFT → PLANNING → REVIEW → BASELINED → ACTIVE → CLOSED`  
(`BASELINED` entered via `createBaseline`, not `transitionStatus` — `pi-service` / `baseline-service`.)

### 2.3 Service boundaries (actual)

| Concern | Primary service | Hard CURRENT assumption? |
|---|---|---|
| PI CRUD / iterations / participation / status | `PiService` | Creates CURRENT on create; `requireCurrentRevision` |
| Allocations | `AllocationService` | Yes — `requireCurrentRevision` before mutate/list |
| Capacity | `CapacityService` | Yes — loads allocations by CURRENT `revision.id` |
| Conflicts | `deriveConflicts` via `PlanningService` | Indirect — uses CURRENT capacity/allocation snapshot |
| Dependencies | `DependencyService` | Org-level; some reads use CURRENT for timing context |
| Baselines | `BaselineService` | Snapshots CURRENT; stores `revisionIdCaptured` |
| Portfolio capacity | `PortfolioPiCapacityQueryService` | Explicitly CURRENT + latest baseline compare |

### 2.4 End-to-end planning flow (today)

```text
createProgramIncrement
  → creates PlanningRevision(key=CURRENT, isCurrent=true)
add participating departments / teams
add PiIteration(s)
select ProjectWorkItem(s) via allocateWork (participating-dept overlap check)
WorkAllocation.plannedHours on CURRENT
CapacityService.computeCapacityViews(piId) → requireCurrentRevision → capacity-policy
PlanningService board/review → deriveConflicts(...)
transition to REVIEW
createBaseline (PI_BASELINE @ ORGANIZATION) → immutable PiBaseline + status BASELINED
```

---

## 3. Existing Domain Inventory

Sources: `prisma/schema.prisma` §PI Planning, `src/modules/pi-planning/application/*`, Portfolio M2E query service.

### 3.1 `ProgramIncrement`

| Aspect | Actual |
|---|---|
| Purpose | Time-bounded multi-dept planning container |
| Relations | org, optional section, iterations, participating depts/teams, revisions, baselines |
| Lifecycle | `PiStatus` enum; optimistic `version` |
| Unique | `@@unique([organizationId, referenceKey])` |
| Auth | `PI_CREATE` / `PI_EDIT` / `PI_VIEW` / `PI_TRANSITION` via `piAuthScope(org, section)` |
| Audit | `pi.created`, `pi.updated`, status transitions |
| Consumers | PI Planning UI, Portfolio list/capacity, baselines |

### 3.2 `PiIteration`

| Aspect | Actual |
|---|---|
| Purpose | Timeboxes for allocation and availability |
| Relations | PI; `WorkAllocation[]`; `ResourceAvailability[]` |
| Unique | `(piId, sequence)`, `(piId, referenceKey)` |
| Shared across scenarios? | **Yes** — iterations are PI-level, not revision-level |
| Implication | Scenario edits change *placement into* shared iterations; they do not fork iteration calendars |

### 3.3 `PlanningRevision`

| Aspect | Actual |
|---|---|
| Purpose | Documented scenario foundation; MVP uses single CURRENT |
| Fields | `key`, `label?`, `isCurrent`, `version`, timestamps |
| Unique | `@@unique([piId, key])`; index `[piId, isCurrent]` (**not** a uniqueness guarantee of one CURRENT) |
| Lifecycle today | Created with PI; no status field; never archived |
| Consumers | All allocation/capacity/baseline paths via `requireCurrentRevision` |

### 3.4 `WorkAllocation`

| Aspect | Actual |
|---|---|
| Purpose | Authoritative planned commitment (`plannedHours`) |
| Unique | `@@unique([revisionId, workItemId])` |
| Optimistic version | `version` + `STALE_VERSION` (ADR-017) |
| Auth | `PI_ALLOCATE` |
| Does **not** copy | work-item title/estimate into PI storage (ADR-014) |

### 3.5 `ProjectWorkItem`

| Aspect | Actual |
|---|---|
| Purpose | Plannable delivery unit; identity stays on Project |
| Relation to PI | Indirect via `WorkAllocation.workItemId` |
| Shared across scenarios | **Referenced**, never forked |

### 3.6 `PiParticipatingDepartment` / `PiParticipatingTeam`

| Aspect | Actual |
|---|---|
| Purpose | Scope which depts/teams may plan on the PI |
| Scope | PI-level (shared), not revision-level |
| Unique | `(piId, departmentId)` / `(piId, teamId)` |

### 3.7 `Resource` / `ResourceMembership` / `ResourceAvailability`

| Aspect | Actual |
|---|---|
| Purpose | Capacity source of truth + team % + per-iteration overrides |
| Scope | **Shared inputs** across all scenarios for a PI’s iterations |
| Implication | Changing availability affects derived capacity for every scenario that evaluates those iterations — by design (same physical capacity). Scenario isolation applies to **allocations**, not to inventing per-scenario Resource copies |

### 3.8 `PiBaseline`

| Aspect | Actual |
|---|---|
| Purpose | Immutable approved plan snapshot |
| Payload | JSON `schemaVersion: 1` (PI meta, revision id/key/version, iterations, allocations, participation, dependencies, `capturedAt`) |
| Unique | `(piId, versionNumber)` |
| Mutation | **Never** update payload; rebaseline = insert N+1 (ADR-016) |
| Auth | Create: `PI_BASELINE` at **ORGANIZATION** scope; read: `PI_VIEW` |

### 3.9 `PlanningDependency`

| Aspect | Actual |
|---|---|
| Purpose | Canonical cross-subject dependency SOT |
| Scope | `organizationId` — **not** revision-scoped |
| Unique | `(sourceType, sourceId, targetType, targetId, type)` |
| Scenario implication | Shared dependency graph for conflict timing; scenario-specific dependency forks are **out of MVP** unless explicitly added later |

### 3.10 `PlanningConflict`

| Aspect | Actual |
|---|---|
| Persistence | **None** — no Prisma model; derive on read (`conflict-engine.ts`) |
| Consumers | Planning board / review; Portfolio capacity conflict counts |

---

## 4. Current Revision Semantics

### 4.1 Creation

`PiService.createProgramIncrement` creates nested:

```text
revisions: { create: { key: "CURRENT", label: "Current plan", isCurrent: true } }
```

### 4.2 Resolution

`requireCurrentRevision(piId)`:

```text
findFirst where { piId, key: "CURRENT", isCurrent: true }
else CONFLICT "CURRENT planning revision is missing"
```

### 4.3 What assumes exactly one editable revision

| Call site | Behavior if multiple non-CURRENT revisions exist |
|---|---|
| `AllocationService.allocateWork/move/remove/list` | Always mutates CURRENT only — scenarios would be unreachable |
| `CapacityService.computeCapacityViews` | Always CURRENT allocations |
| `BaselineService.createBaseline` / `getChangesSince` | Snapshots CURRENT only |
| `PlanningService` board compose | CURRENT capacity + conflicts |
| Portfolio M2E | Filters `isCurrent: true` then uses `CapacityService` |

### 4.4 What does **not** break if non-CURRENT rows exist (structurally)

- Schema uniqueness `(piId, key)` and `(revisionId, workItemId)` already support multiple revisions.
- Capacity formulas remain valid if called with a different `revision.id`.
- Baseline payload already records `revision.id` / `key` / `version`.

### 4.5 Gaps vs multi-scenario

1. No scenario lifecycle fields on `PlanningRevision`.
2. No service API accepting `revisionId` (or scenario key) for allocate/capacity/conflicts.
3. `isCurrent` uniqueness is **not** enforced by a partial unique index — only product convention + `key=CURRENT`.
4. No promote/select transaction.
5. `PlanningDependency` remains shared — scenario A cannot hold a private dependency graph without a new design.
6. Portfolio has no revision selector (correct for M2; must stay CURRENT-default in M3).

---

## 5. Scenario Model Alternatives

### Option A — Extend `PlanningRevision`

Represent scenarios as additional `PlanningRevision` rows (`key` ≠ `CURRENT`, `isCurrent=false`) with explicit lifecycle fields; clone allocations on create; mutate only non-current rows until promote.

| Criterion | Assessment |
|---|---|
| Data integrity | Strong — existing unique constraints already isolate allocation sets |
| Complexity | Low–medium — additive fields + parameterized services |
| Capacity engine reuse | Direct — pass scenario `revision.id` into the same load path |
| Conflict engine reuse | Direct — feed scenario allocations into `deriveConflicts` |
| Existing query compatibility | High if Portfolio/default APIs keep CURRENT |
| Concurrency | Per-row allocation versions already exist; add revision-level version for promote |
| Isolation | Physical row isolation per revision |
| Comparison performance | Load 2 revision allocation sets + shared capacity inputs; derive |
| Approval/baseline | Promote → CURRENT, then existing `createBaseline` path |
| Migration | Additive columns; backfill none required for CURRENT |
| Rollback | Drop new columns / ignore non-CURRENT keys |
| Maintainability | Aligns with schema comments, ADR-014/016, Phase 5 docs, M2F-B |

### Option B — Dedicated `PlanningScenario`

New entity referencing PI + optional revision/allocations.

| Criterion | Assessment |
|---|---|
| Data integrity | Requires either duplicating allocation ownership or indirection to revisions |
| Complexity | Higher — second aggregate overlapping `PlanningRevision` |
| Engine reuse | Possible only if scenario still maps to a revision-like allocation set |
| Compatibility | New join paths; risk of dual CURRENT concepts |
| Maintainability | Conflicts with existing “revision = scenario foundation” documentation |

**Verdict:** Reject for MVP — invents a parallel aggregate the schema already named.

### Option C — Scenario Snapshot / Overlay

Store deltas vs CURRENT without copying all allocations.

| Criterion | Assessment |
|---|---|
| Data integrity | Hard — merge semantics for upserts/deletes; race with CURRENT edits |
| Complexity | High — overlay applicator inside every capacity/conflict path |
| Engine reuse | **Breaks** clean reuse unless engine is rewritten to accept merged views |
| Comparison | Attractive storage size; expensive correctness |
| CURRENT changes | Overlays become stale / ambiguous without copy-on-write |
| Maintainability | Highest long-term risk |

**Verdict:** Reject for M3 — violates “do not introduce a second ledger / rewrite capacity path” spirit.

### Recommendation

**Choose Option A.** It is the only alternative already scaffolded in Prisma, ADRs, and Phase 5 implementation notes, and it reuses `WorkAllocation` as the sole planned-hours ledger without a second engine.

---

## 6. Recommended Architecture

### 6.1 Conceptual model

```text
ProgramIncrement
  ├─ PlanningRevision key=CURRENT, isCurrent=true, status=ACTIVE_PLAN
  ├─ PlanningRevision key=SCN-…, isCurrent=false, status=DRAFT|READY|… (scenarios)
  └─ PiBaseline* (immutable; revisionIdCaptured points at revision snapshotted)
```

### 6.2 Additive fields (proposed — **not applied in M3A**)

On `PlanningRevision` (illustrative):

| Field | Purpose |
|---|---|
| `status` | Scenario lifecycle (see §9) |
| `archivedAt` | Soft archive |
| `clonedFromRevisionId` | Provenance |
| `createdByPrincipalId` | Authorship |
| `selectedAt` / `selectedByPrincipalId` | Selection marker (pre-approval) |
| `updatedAt` | Already missing today — add for optimistic concurrency on revision metadata |

Retain: `key`, `label`, `isCurrent`, `version`.

### 6.3 Key invariants (product + DB)

1. **Exactly one** row with `isCurrent=true` per PI (enforce with partial unique index in M3B migration).
2. Reserved key `CURRENT` always denotes the authoritative editable live plan after promote.
3. Scenario keys are opaque (e.g. `SCN-<shortid>`); labels are human-readable.
4. Scenario allocation mutations never write `revisionId = CURRENT.id`.
5. Portfolio default queries continue to resolve CURRENT only.
6. No second `plannedHours` store.

### 6.4 Service parameterization (directional)

| Service method | Today | M3 target |
|---|---|---|
| `requireCurrentRevision(piId)` | Keep for default paths | Keep |
| `requireRevision(piId, revisionId)` | — | New; assert same PI |
| `allocateWork(..., revisionId?)` | Implicit CURRENT | Explicit; default CURRENT only for legacy callers |
| `computeCapacityViews(piId, revisionId?)` | CURRENT | Parameterized |
| `deriveConflicts` inputs | CURRENT snapshot | Scenario or CURRENT snapshot |
| `createBaseline` | CURRENT | After promote, still CURRENT (selected plan becomes CURRENT first) |

**Promote-before-baseline** keeps ADR-016 semantics intact: baselines capture the authoritative CURRENT plan.

---

## 7. Scenario Isolation

### 7.1 Independence rule

```text
Scenario A allocations  ⊥  Scenario B allocations  ⊥  CURRENT allocations
```

Changing Resource X from 40h → 60h **planned** in Scenario B updates only `WorkAllocation` rows with `revisionId = B`. Scenario A and CURRENT retain prior `plannedHours`.

### 7.2 Ownership of allocation rows

| Object | Ownership |
|---|---|
| Scenario allocation rows | Belong exclusively to that `PlanningRevision` |
| CURRENT allocation rows | Belong exclusively to CURRENT |
| On create-from-CURRENT | **Clone** rows (new UUIDs, same workItem/iteration/team/resource/hours/notes) into new revision |
| On clone-scenario | Clone source scenario rows |
| Work items / Resources / Iterations / Participation | **Referenced**, not copied |

### 7.3 Dependencies

| Approach | M3 MVP |
|---|---|
| Shared org `PlanningDependency` graph | **Yes** — conflict timing uses shared deps |
| Scenario-private dependency rows | **No** for M3 — would violate canonical SOT and unique constraint model |
| Documented limitation | Scenario comparison of “what if we drop this dependency” is out of scope unless a later revision-scoped overlay is designed |

### 7.4 Shared Resource capacity inputs

| Input | Shared? | Effect |
|---|---|---|
| `Resource.capacityHoursPerWeek` | Shared | Same available hours base for all scenarios |
| `ResourceMembership.allocationPercent` | Shared | Same team capacity contribution |
| `ResourceAvailability` per iteration | Shared | Same overrides/reductions |
| Scenario `WorkAllocation.plannedHours` | Isolated | Different committed/remaining per scenario |

If planners need “what if we hire / change availability,” that is a **capacity-input** what-if (Resource Planning depth / M7), not M3 scenario allocation isolation.

### 7.5 CURRENT changes vs existing scenarios

| Event | Effect on scenarios |
|---|---|
| Edit CURRENT allocations after scenarios exist | Scenarios **unchanged** (forked copies) |
| Change shared availability | Derived capacity **recomputes** for all scenarios on next read |
| Add iteration / participation | Shared structure changes; scenarios may reference new iterations when edited; orphaned placements validated on edit |
| Promote scenario → CURRENT | Transaction replaces CURRENT allocation set (see §12); other scenarios remain readable unless archived |

Avoid implicit shared mutable allocation state: never point two revisions at the same `WorkAllocation` row.

---

## 8. Capacity Source of Truth

### 8.1 Desired evaluation path

```text
Scenario A
  → WorkAllocations where revisionId = A
  → existing capacity-policy + CapacityService formulas
  → available / committed / remaining / utilization / overload bands

Scenario B
  → different WorkAllocations
  → same formulas
  → different results
```

### 8.2 Distinction table

| Concept | Persisted? | Source |
|---|---|---|
| Resource availability inputs | Yes | `Resource`, `ResourceMembership`, `ResourceAvailability` |
| Team membership capacity | Derived | Sum of effective resource hours on participating teams |
| Committed allocation (CURRENT) | Yes | CURRENT `WorkAllocation.plannedHours` |
| Scenario-proposed allocation | Yes | Scenario revision `WorkAllocation.plannedHours` |
| Available / remaining / utilization | Derived | `capacity-policy` (`effectiveResourceCapacity`, `utilization`, bands) |
| Conflicts | Derived | `deriveConflicts` |
| Approved baseline | Yes (immutable JSON) | `PiBaseline.payload` |

### 8.3 Implementation note (M3B/C)

Refactor `computeCapacityViews(piId)` to `computeCapacityViews(piId, revisionId)` internally; default `revisionId` from `requireCurrentRevision` for backward compatibility. Portfolio M2E continues to omit the parameter (CURRENT).

**Do not** duplicate overload thresholds — keep `CAPACITY_THRESHOLDS` / `isOverloaded`.

---

## 9. Scenario Lifecycle

Inspected conventions: `PiStatus` is PI-level governance; baselines are separate; allocations have no workflow enum. Scenario workflow should stay **minimal** and attach to `PlanningRevision`, not invent a second PI status machine.

### 9.1 Proposed status enum (`PlanningRevisionStatus`)

```text
DRAFT
  → READY_FOR_REVIEW
  → SELECTED          (exactly one SELECTED per PI optional; soft preference)
  → ARCHIVED          (terminal soft-delete)

On promote + baseline path:
  SELECTED (or DRAFT/READY) → promoted into CURRENT
  (scenario row may become ARCHIVED or PROMOTED marker — see open decision)
```

**Do not** require `APPROVED` / `BASELINED` on the scenario row as separate durable states that duplicate PI baseline. Approval authority already exists as `PI_BASELINE` / PI REVIEW→BASELINED. Selection ≠ approval.

### 9.2 Recommended MVP states

| Status | Meaning | Editable allocations? |
|---|---|---|
| `DRAFT` | Working alternative | Yes |
| `READY_FOR_REVIEW` | Frozen-for-discussion (optional soft lock) | No (or yes with explicit reopen → DRAFT) |
| `SELECTED` | Preferred candidate for promote | No |
| `ARCHIVED` | Hidden from default lists; readable in history | No |
| CURRENT row | Live plan (`isCurrent=true`) | Yes (subject to PI status CLOSED rules) |

### 9.3 Transitions

| From | To | Who (permission) |
|---|---|---|
| — | DRAFT (create/clone) | `PI_ALLOCATE` (reuse) or new `PI_SCENARIO_MANAGE` — see §15 |
| DRAFT | READY_FOR_REVIEW | Scenario editors |
| READY_FOR_REVIEW | DRAFT | Scenario editors (reopen) |
| DRAFT / READY | SELECTED | `PI_REVIEW` (selection authority) |
| SELECTED | DRAFT / READY | `PI_REVIEW` (clear selection) |
| * | ARCHIVED | Scenario editors; cannot archive CURRENT |
| SELECTED → promote | CURRENT contents replaced | `PI_REVIEW` + transaction; audit |
| After promote | createBaseline | Existing `PI_BASELINE` @ ORGANIZATION |

### 9.4 Rules

- Rejected / non-selected scenarios remain readable until archived.
- Archived scenarios remain readable with explicit include flag.
- Approved plan immutability is provided by **`PiBaseline`**, not by freezing CURRENT forever (CURRENT may still change after baseline; dirty-vs-baseline is existing behavior).
- CURRENT `isCurrent` does not change when a scenario is merely SELECTED.

---

## 10. Creation / Editing

### 10.1 MVP operations

| Operation | MVP? | Notes |
|---|---|---|
| Create scenario from CURRENT | **Yes** | Primary path |
| Clone existing scenario | **Yes** | Cheap once clone helper exists |
| Rename scenario (`label`) | **Yes** | Metadata only |
| Archive scenario | **Yes** | Soft archive; keep rows for audit/compare history |

### 10.2 Initial copy semantics (create from CURRENT)

**Copied (new rows):**

- All `WorkAllocation` fields except `id`, `revisionId`, `version` (reset to 1), timestamps

**Referenced (not copied as editable forks):**

- `ProjectWorkItem`, `PiIteration`, teams, resources
- Participating departments/teams
- `PlanningDependency`
- `PiBaseline` payloads — **never** copied into editable scenario data
- Resource availability rows

**Revision metadata:**

- New `key` (generated), `label` (user), `isCurrent=false`, `status=DRAFT`, `clonedFromRevisionId=CURRENT.id`

### 10.3 Editing operations (scenario revision only)

Reuse existing validation from `AllocationService`:

- PI not CLOSED
- Iteration belongs to PI
- Team is participating
- Work item project overlaps participating departments
- Optimistic `expectedVersion` on updates
- Unique `(revisionId, workItemId)`

Operations: add / edit hours / remove / move iteration|team|resource — same as today, with `revisionId` of a non-CURRENT, non-ARCHIVED, editable status revision.

**Guarantee:** scenario edit path must assert `!revision.isCurrent` (or assert status ∈ editable scenario set) so CURRENT cannot be mutated through the scenario API by mistake.

---

## 11. Comparison Contract

### 11.1 Typed contract (directional)

```ts
type ScenarioComparison = {
  piId: string;
  left: RevisionRef;   // scenario or CURRENT
  right: RevisionRef;  // scenario or CURRENT or baseline ref
  capacityAssumptions: {
    // Shared inputs fingerprint for honesty labeling
    iterationIds: string[];
    availabilityRevisionNote: "SHARED_PI_CAPACITY_INPUTS";
  };
  metrics: {
    availableHours: MetricPair;
    committedHours: MetricPair;
    remainingHours: MetricPair;
    utilization: MetricPair; // 0–1 or %
    overloadedTeamCount: MetricPair;
    conflictCount: MetricPair;
    // optional breakdowns
    byTeam?: TeamMetricRow[];
    byProject?: ProjectCommitmentRow[];
  };
  conflicts: {
    left: DerivedConflict[];
    right: DerivedConflict[];
    onlyLeft: DerivedConflict[];
    onlyRight: DerivedConflict[];
  };
};
```

| Metric | Calculated vs stored |
|---|---|
| Available hours | Calculated (shared inputs) |
| Committed hours | Calculated (sum scenario allocations) |
| Remaining / utilization / overload | Calculated |
| Conflicts | Calculated (`deriveConflicts`) |
| Project commitments | Calculated (group allocations by project via work items) |
| Baseline side | From immutable payload when comparing to baseline |

### 11.2 Consistency rules

- Both sides must use the same PI and same iteration calendar.
- If comparing to a baseline captured under older participation/iterations, label `capacityAssumptions` / schema drift explicitly (baseline `schemaVersion` + captured iteration set).
- Never present draft scenario metrics as Portfolio “committed” KPIs (§17).

---

## 12. Selection / Approval

### 12.1 Distinct acts

| Act | Meaning | Permission | Mutates CURRENT? | Creates baseline? |
|---|---|---|---|---|
| Select | Marks preferred scenario | `PI_REVIEW` | No | No |
| Promote | Copies/replaces CURRENT allocations from selected scenario | `PI_REVIEW` (or tighter) | **Yes** | No |
| Approve / Baseline | Existing `createBaseline` | `PI_BASELINE` @ ORGANIZATION | No (snapshots CURRENT) | **Yes** |

Selection must **not** silently grant approval. Approval must **not** bypass Phase 0C (`PI_BASELINE` already ORGANIZATION-scoped and not granted via project ownership — `authorization-matrix.md`).

### 12.2 Promote transaction (sensitive)

Within one DB transaction:

1. Lock / re-read PI + source scenario + CURRENT (`version` checks).
2. Assert scenario status allows promote; assert PI status allows planning edits (not CLOSED).
3. Delete (or replace strategy) CURRENT allocations; insert clones from scenario **or** swap `isCurrent` flags with key rename strategy.

**Recommended promote strategy (safer for history):**

- Keep scenario row immutable after promote (archive or mark `PROMOTED`).
- Replace CURRENT allocation set with clones from scenario (new allocation ids on CURRENT).
- Bump CURRENT `version` and PI `version`.
- Clear other SELECTED markers.

**Alternative (swap isCurrent):** rename keys so promoted scenario becomes `CURRENT` — higher risk to FKs (`revisionIdCaptured` on old baselines still points at old revision id — acceptable) but confuses `key=CURRENT` invariant used by `requireCurrentRevision`. Prefer **allocation replace** while keeping the same CURRENT revision row identity.

### 12.3 Becoming authoritative

Authoritative live plan = CURRENT after successful promote.  
Authoritative approved plan = latest `PiBaseline` after `createBaseline`.  
Portfolio KPIs = CURRENT (and baseline compare), never draft scenarios.

---

## 13. Baseline Compatibility

### 13.1 Current payload (schemaVersion 1)

Captures: PI meta, revision `{id,key,version}`, iterations, allocations, participating dept/team ids, dependencies, `capturedAt`.  
`revisionIdCaptured` FK on `PiBaseline` row.

### 13.2 M3 approach

1. Promote scenario → CURRENT (allocations).
2. Ensure PI in `REVIEW` for first baseline (existing rule) or rebaseline from `BASELINED`/`ACTIVE`.
3. Call existing `createBaseline` — still snapshots CURRENT.
4. Never overwrite prior baseline rows.

Optional enhancement (M3D): allow `createBaseline` to accept `revisionId` **only if** that revision is CURRENT after promote — avoids dual paths. Capturing a non-CURRENT scenario directly into a baseline **without** promote is **not** recommended for MVP (would create approved plans that differ from live CURRENT and confuse Portfolio).

### 13.3 Portfolio M2E

Continues reading latest baseline payload vs live CURRENT. Scenario drafts remain invisible unless an explicit future selector is added (out of M3 core; M2F-B noted as optional follow-on).

---

## 14. Concurrency

| Race | Recommendation |
|---|---|
| Concurrent scenario allocation edits | Existing `WorkAllocation.version` + `STALE_VERSION` (ADR-017) |
| Stale client scenario metadata | `PlanningRevision.version` on rename/status transitions |
| Simultaneous SELECTED | Transaction: clear other SELECTED for PI; unique partial index optional |
| Simultaneous promote | Transaction on CURRENT revision version + PI version; loser gets `STALE_VERSION` / `CONFLICT` |
| Simultaneous baseline | Existing insert `versionNumber = max+1` in transaction |
| Concurrent CURRENT edits during scenario edit | Isolated rows — no conflict unless promote merges |
| Concurrent Resource availability changes | Shared inputs; both scenarios recompute; no allocation corruption |

**Do not** introduce distributed locks. Idempotency: optional `Idempotency-Key` on promote/createScenario only if HTTP retries observed as a problem (open).

**DB constraint (M3B):** partial unique index `UNIQUE (piId) WHERE isCurrent = true`.

---

## 15. Authorization

Preserve Phase 0C scopes (`piAuthScope` org/section). Business ownership does not grant `pi.baseline`.

### 15.1 Permission mapping (recommended)

Prefer **reuse** over proliferating permissions for MVP:

| Capability | Permission |
|---|---|
| Scenario view / compare | `PI_VIEW` |
| Scenario create / clone / rename / archive / edit allocations | `PI_ALLOCATE` |
| Scenario mark READY / reopen | `PI_ALLOCATE` |
| Scenario select / clear selection / promote to CURRENT | `PI_REVIEW` |
| Baseline after promote | `PI_BASELINE` (ORGANIZATION) — unchanged |

**Optional M3E split** (only if review finds `PI_ALLOCATE` too broad): add `PI_SCENARIO_MANAGE` — deferred unless needed.

### 15.2 Role pack impact (existing)

| Role | Today | Scenario implication |
|---|---|---|
| Organization Admin | All PI_* | Full |
| Section Manager | PI through REVIEW; **no** `PI_BASELINE` | Can select/promote; cannot baseline |
| Department / Team / Project Manager | VIEW + ALLOCATE (+ capacity/deps vary) | Can edit scenarios; **cannot** select/promote/baseline |
| Portfolio Manager | `PI_VIEW` only | View/compare only |
| Viewer | `PI_VIEW` | View/compare only |

Cross-org / cross-dept isolation remains via existing AuthZ scope checks on the PI.

---

## 16. Audit

### 16.1 Events (proposed)

| Action | `actionType` (proposed) | Subject |
|---|---|---|
| Created | `pi.scenario.created` | PlanningRevision |
| Cloned | `pi.scenario.cloned` | PlanningRevision |
| Edited (allocation) | reuse `pi.allocation.*` with `revisionId` in payload | WorkAllocation |
| Renamed / status | `pi.scenario.updated` | PlanningRevision |
| Archived | `pi.scenario.archived` | PlanningRevision |
| Selected | `pi.scenario.selected` | PlanningRevision |
| Promoted | `pi.scenario.promoted` | PlanningRevision (+ CURRENT id) |
| Baselined | existing `pi.baseline.created` / `rebaselined` | PiBaseline |

### 16.2 Payload fields

Actor Principal id, organizationId, piId, scenario revisionId, key/label, old/new status, version, optional allocation diffs summary, timestamp.

### 16.3 Known debt (do not fix in M3A)

Audit writes typically occur **after** transaction commit (noted in `GOVERNANCE-BEHAVIOR-CONTRACT.md` / ADR-023). Scenario services should follow the same existing pattern for consistency; transactional outbox is out of scope.

---

## 17. Portfolio Integration

### 17.1 Current M2 consumers

- Executive Dashboard / Portfolio queries — PI lists and CURRENT metrics where applicable
- PI & Capacity Overview — `PortfolioPiCapacityQueryService` → `isCurrent: true` + `CapacityService.computeCapacityViews`
- Project commitments — derived from CURRENT allocations
- Baseline comparison — latest `PiBaseline.payload` vs CURRENT

### 17.2 Explicit query semantics

| Mode | Meaning | Default Portfolio? |
|---|---|---|
| `CURRENT` | Live authoritative plan | **Yes** |
| `SCENARIO` | Named non-current revision | Only when UI explicitly selects (PI Planning / future optional portfolio selector) |
| `BASELINE` | Immutable payload | Compare panels only |

**Rule:** Draft/READY/SELECTED scenarios must not appear in management KPIs as committed work. M3B–D must add regression tests that Portfolio capacity totals ignore non-CURRENT revisions.

---

## 18. UI/UX Architecture (design only — not implemented)

Reuse PI Planning board and Portfolio Capacity visual language.

### 18.1 Surfaces

1. **PI selector** (existing)
2. **Scenario list** — CURRENT badge + scenario cards (label, status, updated, cloned-from)
3. **Create / clone / rename / archive** actions
4. **Scenario allocation board** — same board component, bound to `revisionId`; persistent banner: `SCENARIO: {label}` vs `CURRENT`
5. **Comparison view** — metrics table (§11) + conflict delta
6. **Capacity / conflict indicators** — same bands/colors as today
7. **Select / Promote** controls (REVIEW permission) separate from **Baseline** (BASELINE permission)
8. **Baseline status** — existing baseline list + dirty-since-baseline

### 18.2 Labeling

Always show one of: `CURRENT` | `SCENARIO` | `BASELINE` in page chrome. Never imply a scenario is approved until a baseline exists for the promoted CURRENT.

---

## 19. Migration Strategy

### 19.1 Smallest safe additive migration (M3B)

1. Add nullable/defaulted columns on `planning_revisions` (`status` default compatible with CURRENT, archive/provenance fields, `updatedAt`).
2. Backfill: existing rows → `status = ACTIVE_PLAN` or treat CURRENT specially; scenarios none yet.
3. Add partial unique index on `(piId) WHERE isCurrent`.
4. No changes to `work_allocations` shape required.
5. No destructive backfill; no automatic creation of scenario rows.
6. `PiBaseline` untouched.

### 19.2 Sequencing

```text
M3B schema + services (parameterize revisionId, create/clone/edit)
 → M3C comparison APIs + UI
 → M3D select/promote + baseline path verification
 → M3E QA / auth / concurrency / Portfolio regression
```

### 19.3 Rollback

- App rollback: ignore non-CURRENT revisions (CURRENT-only code paths remain valid if feature-flagged).
- Schema rollback: columns are additive; dropping scenario rows is safe if no baselines pointed at them (baselines should point at CURRENT id under recommended promote strategy).

### 19.4 Compatibility

Old clients without scenario UI continue to call CURRENT APIs. Portfolio unchanged until optional selector.

---

## 20. Proposed ADR

> **Status: Proposed — not accepted**  
> **Title: PI Planning Scenario Persistence and Isolation**  
> **ID: (next) ADR-027 candidate**

### Context

Managers need what-if alternatives for a PI without mutating the live CURRENT plan or rewriting immutable baselines. `PlanningRevision` was introduced in Phase 5 as scenario foundation but only CURRENT is used. Portfolio M2 now exposes CURRENT capacity; scenarios are the accepted next product milestone (M2F-B).

### Alternatives

- **A.** Extend `PlanningRevision` with lifecycle + cloned allocations (recommended)
- **B.** Dedicated `PlanningScenario` aggregate
- **C.** Overlay/delta store vs CURRENT

### Decision (proposed)

Adopt **Option A**. Scenarios are non-current `PlanningRevision` rows. Allocations remain the sole planned-hours ledger, scoped by `revisionId`. Capacity and conflicts evaluate a chosen revision through the existing engines. Promote copies allocations onto the existing CURRENT revision row; baseline continues to snapshot CURRENT via ADR-016.

### Data model

Additive `PlanningRevision` lifecycle/provenance fields; partial unique CURRENT index; no new allocation table; no `PlanningConflict` table.

### Capacity-engine reuse

Parameterize revision id; shared Resource capacity inputs; isolated committed hours per revision.

### Approval / baseline compatibility

Select ≠ approve. Promote then `createBaseline`. Never mutate historical `PiBaseline.payload`.

### Concurrency

Optimistic versions (ADR-017) + transactional promote + partial unique `isCurrent`.

### Authorization

Reuse `PI_VIEW` / `PI_ALLOCATE` / `PI_REVIEW` / `PI_BASELINE`; do not grant baseline via project ownership.

### Migration

Additive, non-destructive; existing CURRENT remains authoritative.

### Consequences

- Enables isolated what-if plans and comparison.
- Requires disciplined Portfolio defaults (CURRENT only).
- Scenario-private dependencies deferred.
- Availability what-ifs remain Resource-level (shared), not per-scenario forks.

---

## 21. Implementation Roadmap

### M3B — Scenario Creation & Editing

| | |
|---|---|
| **Scope** | Additive schema; create/clone/rename/archive; allocate/move/remove on non-CURRENT revisions; parameterize capacity compute for revisionId (API internal OK); CURRENT default preserved |
| **Dependencies** | M3A merged; Phase 5 PI module |
| **Schema** | `PlanningRevision` fields + partial unique `isCurrent` |
| **Acceptance** | ≥1 scenario cloned from CURRENT; edits do not change CURRENT allocations; unauthorized edit denied; unit/integration coverage |
| **Risks** | Accidentally mutating CURRENT; missing `isCurrent` uniqueness |
| **GitHub checkpoint** | PR `cursor/m3b-scenario-create-edit-60bb` → main |

### M3C — Scenario Comparison

| | |
|---|---|
| **Scope** | Comparison query contract; capacity/conflict/project commitment diffs; comparison UI; conflict indicators per scenario |
| **Dependencies** | M3B |
| **Schema** | None expected (read-side) |
| **Acceptance** | Diff table for two scenarios / scenario vs CURRENT; shared capacity inputs labeled; Portfolio still CURRENT-only |
| **Risks** | Performance on large allocation sets; conflating baseline schema drift |
| **GitHub checkpoint** | PR `cursor/m3c-scenario-compare-60bb` |

### M3D — Scenario Selection & Baseline

| | |
|---|---|
| **Scope** | SELECTED state; promote transaction; audit events; baseline via existing path post-promote; auth for review/baseline |
| **Dependencies** | M3B, M3C |
| **Schema** | Possibly selection fields only |
| **Acceptance** | Select does not baseline; promote updates CURRENT only in transaction; baseline immutability holds; concurrent promote safe |
| **Risks** | Promote race; partial promote; confusing SELECTED with approved |
| **GitHub checkpoint** | PR `cursor/m3d-scenario-select-baseline-60bb` |

### M3E — Final Integration & QA

| | |
|---|---|
| **Scope** | Browser journeys; auth matrix; concurrency tests; Portfolio regression; acceptance doc |
| **Dependencies** | M3B–D |
| **Schema** | None |
| **Acceptance** | M2F-B exit criteria 1–5 met; no draft pollution of KPIs |
| **Risks** | Role-pack gaps (section manager promote without baseline) — document UX |
| **GitHub checkpoint** | PR `cursor/m3e-scenario-acceptance-60bb` |

---

## 22. Risks and Open Decisions

| ID | Topic | Recommendation / status |
|---|---|---|
| R1 | Promote strategy: replace allocations vs swap `isCurrent` | **Replace allocations on stable CURRENT row** |
| R2 | Scenario-private dependencies | **Out of M3**; shared deps only |
| R3 | Per-scenario availability forks | **Out of M3** (M7 / resource depth) |
| R4 | New `PI_SCENARIO_*` permissions vs reuse | **Reuse** for MVP; split only if needed |
| R5 | Soft-lock READY_FOR_REVIEW | Optional; can ship DRAFT+ARCHIVED+SELECTED only if UX wants simpler |
| R6 | Partial unique index support on Postgres | Expected available; verify in M3B migration |
| R7 | Audit-after-commit debt | Known; do not fix in M3 |
| R8 | Portfolio scenario selector | Optional follow-on; not required to start M3B |
| R9 | Whether promoted scenario row is archived or kept SELECTED | Prefer **archive or PROMOTED** marker; open for M3D |
| R10 | Max scenarios per PI | Unknown — suggest soft product limit (e.g. 10) in M3B UX, not hard DB constraint yet |

---

## 23. Evidence Appendix

### 23.1 Baseline verification

| Check | Result |
|---|---|
| Starting `main` SHA | `904113f7b36c1766c4b1ba0e0efd4f947cc9dc38` |
| Expected minimum SHA | Same (exact match) |
| M2F-B present | `docs/PROJECT-PLATFORM-M2-MILESTONE-REVIEW.md` |
| M0/M1/M2 lineage | Merge history includes Portfolio M2A–M2E + M2F-A/B on `main` |
| Working tree product drift | None material for this review (local noise: `next-env.d.ts`, untracked seed/AGENTS — not part of deliverable) |
| Branch | `cursor/m3a-scenario-architecture-60bb` |

### 23.2 Key file evidence

| Evidence | Path |
|---|---|
| Scenario foundation comment | `prisma/schema.prisma` `PlanningRevision` |
| Allocation uniqueness | `WorkAllocation @@unique([revisionId, workItemId])` |
| CURRENT create | `pi-service.ts` `createProgramIncrement` |
| CURRENT gate | `pi-service.ts` `requireCurrentRevision` |
| Allocation CURRENT hardcode | `allocation-service.ts` |
| Capacity CURRENT hardcode | `capacity-service.ts` `computeCapacityViews` |
| Conflicts derived | `conflict-engine.ts` |
| Baseline immutable | `baseline-service.ts`, `baseline-snapshot.ts` `schemaVersion: 1` |
| ADR future scenarios | `docs/adr/ADR-014-planning-allocation.md`, `ADR-016-pi-baseline-snapshot.md` |
| Concurrency | `docs/adr/ADR-017-planning-concurrency.md` |
| Permissions | `src/modules/shared/permissions.ts`, `role-packs.ts` |
| Portfolio CURRENT | `portfolio-pi-capacity-query-service.ts` |
| Roadmap choice M3 | `docs/PROJECT-PLATFORM-M2-MILESTONE-REVIEW.md` §9 |
| Audit-after-commit debt | `docs/GOVERNANCE-BEHAVIOR-CONTRACT.md` |

### 23.3 Explicit unknowns

- Production load size for N scenarios × allocations (perf budget TBD in M3C).
- Whether product wants READY_FOR_REVIEW soft-lock in MVP or DRAFT-only until select.
- Final ADR number assignment when accepted (proposed ADR-027 candidate).
- Whether Section Managers should gain `PI_BASELINE` later (today they cannot baseline — by design).

---

**M3A COMPLETE — ARCHITECTURE RECORDED**

Do not implement M3B in this phase.
