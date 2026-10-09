# PI Scenario Selection & Readiness (M3D-A)

**Status:** Implemented  
**Baseline:** M3C acceptance (`docs/PI-SCENARIO-COMPARISON-ACCEPTANCE.md`)  
**Related:** Architecture § selection / ADR-012 family

---

## 1. Purpose

Allow an authorized reviewer to **select one preferred scenario** for a Program Increment and evaluate its **readiness**.

| Is | Is not |
|---|---|
| Preferred draft for discussion | Approval |
| Soft pointer + status marker | Promotion to CURRENT |
| Readiness using existing capacity/conflict engines | A second capacity formula |

Selection **never** mutates `WorkAllocation` rows or `PiBaseline` payloads.

---

## 2. Persistence model

Smallest additive change on the approved `PlanningRevision` model:

| Field | Location | Role |
|---|---|---|
| `selectedRevisionId` | `ProgramIncrement` (nullable unique FK) | Single selected scenario per PI |
| `status = SELECTED` | `PlanningRevision` | Lifecycle marker for the selected row |
| `selectedAt` / `selectedByPrincipalId` | `PlanningRevision` | Who/when selected |
| `statusBeforeSelection` | `PlanningRevision` | Restore DRAFT / READY_FOR_REVIEW on clear |
| Partial unique index | `(piId) WHERE status = 'SELECTED'` | DB-enforced single selection |

CURRENT identity (`isCurrent` + `ACTIVE_PLAN`) is unchanged.

---

## 3. Selection rules

- Eligible: `DRAFT`, `READY_FOR_REVIEW` (and re-selecting the already `SELECTED` row).
- Reject: `CURRENT`, `ARCHIVED`, cross-PI revision, closed PI.
- At most one selected scenario per PI (FK + partial unique index + transactional clear of previous).
- Optimistic concurrency: `expectedPiVersion` + `expectedRevisionVersion`.
- Archiving a selected scenario clears `selectedRevisionId` and emits `pi.scenario.selection_cleared`.

---

## 4. Readiness classification

Computed via `CapacityService.computeCapacityViews` + `deriveConflictsForPi` (same engines as board / M3C).

| Classification | When |
|---|---|
| `READY` | No blockers, no warnings |
| `READY_WITH_WARNINGS` | No blockers; warning conflicts, near-capacity/missing-input/freshness signals |
| `NOT_READY` | Blocker conflicts, overloaded teams, missing iterations/teams |
| `UNAVAILABLE` | No revision specified/selected, or revision not on PI |

Metrics: available / committed / remaining hours, utilization (`null` when not finite — display as unavailable, not zero), overloaded team count, conflict counts.

---

## 5. Shared input freshness (proven signals only)

Baseline timestamp: scenario `createdAt`.

| Signal code | Proven when |
|---|---|
| `MEMBERSHIP_CHANGED_SINCE_CREATE` | `ResourceMembership.updatedAt` > createdAt for participating teams |
| `RESOURCE_CAPACITY_CHANGED_SINCE_CREATE` | `Resource.updatedAt` > createdAt |
| `AVAILABILITY_CHANGED_SINCE_CREATE` | `ResourceAvailability.updatedAt` > createdAt for PI iterations |
| `ITERATION_CHANGED_SINCE_CREATE` | `PiIteration.updatedAt` > createdAt |

**Not claimed in M3D-A:**

- Historical reconstruction of `PiParticipatingTeam` / `PiParticipatingDepartment` membership (create-only timestamps).
- Dependency graph time-travel (no historical dependency versions).
- Exact capacity hours at scenario creation time (no capacity snapshot store).

Freshness signals surface as **warnings**, not blockers.

---

## 6. Authorization

| Action | Permission |
|---|---|
| Select / change / clear | `PI_REVIEW` at PI org/section scope |
| View selection, history, readiness | `PI_VIEW` |

Project or Resource ownership does **not** grant selection.

---

## 7. Audit

| Action | Event |
|---|---|
| First selection | `pi.scenario.selected` |
| Replace selection | `pi.scenario.selection_changed` |
| Clear (manual or archive) | `pi.scenario.selection_cleared` |

Payload includes actor, `piId`, `oldRevisionId`, `newRevisionId`, timestamp / PI version.

---

## 8. UI

PI Planning → **Review** tab: selection panel with readiness KPIs, blockers/warnings, select/change/clear controls, history. Explicit banner: **Selected for review — not approved**. No promotion, approval, or baseline-from-scenario controls in this panel.

---

## 9. Out of scope (M3D-B)

- Controlled promotion of selected scenario → CURRENT
- Baseline-from-promoted-plan path verification
- Approval workflow gates
