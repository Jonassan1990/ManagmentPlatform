# PI Scenario Approval & Immutable Baseline (M3D-C)

**Date:** 2026-10-09  
**Scope:** Explicit approval of promoted CURRENT, then controlled immutable baseline  
**Out of scope:** M3D-D acceptance packaging

## 0. Pre-implementation state (inspected)

| Concept | Existed before M3D-C? | Notes |
|---|---|---|
| Selection (`SELECTED`) | Yes (M3D-A) | Explicitly **not** approval |
| Promotion (`PROMOTED` + `lastPromoted*`) | Yes (M3D-B) | Explicitly **not** approval / baseline |
| `PiBaseline` | Yes | Immutable snapshot; first baseline REVIEW→BASELINED |
| Dedicated plan approval entity | **No** | No `APPROVED` status on PI/revision |
| Governance `DecisionRecord` | Separate | Initiative gates only — not reused for PI plan approval |
| Permissions | `PI_REVIEW`, `PI_BASELINE` | No more-specific plan-approve permission |

**Decision:** Additive `PiPlanApproval` table (ADR-027). Do not overload `DecisionRecord`. Do not add `APPROVED` to `PlanningRevisionStatus` / `PiStatus`.

## 1. Lifecycle

```
SELECTED → PROMOTED → APPROVED → BASELINED
```

- **Selected for review** — preferred scenario; no CURRENT mutation.
- **Promoted to CURRENT — not approved** — authoritative allocations replaced; no baseline.
- **Approved CURRENT version** — `PiPlanApproval` VALID bound to fingerprint + revision version.
- **Baselined — immutable commitment** — new `PiBaseline` row; approval becomes `CONSUMED`.

Approval and baseline are **separate authorized user actions**.

## 2. Approval persistence

`PiPlanApproval` captures:

- PI id
- CURRENT revision id + version
- Allocation fingerprint (SHA-256 of normalized allocations)
- Promoted source scenario id (`promotedFromRevisionId`)
- Approving Principal + timestamp
- Readiness classification + evidence JSON + warning acknowledgement
- Status: `VALID` | `INVALIDATED` | `CONSUMED`

Partial unique index: at most one `VALID` approval per PI.

## 3. Fingerprint / version semantics

Fingerprint = `sha256(JSON.stringify(sorted normalized allocations))`  
Normalization fields: `workItemId`, `iterationId`, `teamId`, `resourceId`, `plannedHours`, `notes`.

Shared helper: `allocation-fingerprint.ts` (also used by M3D-B idempotent promote).

Any meaningful CURRENT allocation mutation:

1. Bumps CURRENT `PlanningRevision.version`
2. Invalidates `VALID` approvals (`CURRENT_EDITED`)
3. Historical approval rows remain

Second promotion invalidates `VALID` approvals (`REPROMOTED`).

## 4. Authorization

| Act | Permission | Scope |
|---|---|---|
| Approve CURRENT | `PI_REVIEW` | Org / section (existing `piAuthScope`) |
| Create baseline | `PI_BASELINE` | Organization only |

Not granted via project ownership, resource ownership, scenario edit (`PI_ALLOCATE`), or `PI_VIEW`.

## 5. Readiness rules

Approval re-evaluates readiness on **CURRENT** at approve time (capacity + conflict engines).

- `NOT_READY` / `UNAVAILABLE` → reject
- `READY_WITH_WARNINGS` → require `acknowledgeWarnings: true`
- Does not trust selection-time or promote-time readiness alone

## 6. Baseline integration

`BaselineService.createBaseline` requires:

- `expectedApprovalId` of a `VALID` approval
- Matching CURRENT revision version + fingerprint
- Existing PI status rules (first: `REVIEW`; rebaseline: `BASELINED`/`ACTIVE`)
- `PI_BASELINE` @ ORGANIZATION

Links `PiBaseline.planApprovalId` and marks approval `CONSUMED`.  
Historical baselines are never updated or deleted.

## 7. Concurrency & idempotency

- Concurrent approvals: PI version lock + partial unique on `VALID` → one winner
- Concurrent baselines: approval status CAS `VALID`→`CONSUMED` → one winner
- Stale PI / CURRENT versions → `CONFLICT`
- Approval retry with identical VALID fingerprint → `idempotentReplay: true`
- Baseline retry when approval already `CONSUMED` for same fingerprint → `idempotentReplay: true`

No distributed locks.

## 8. Audit

| Event | When |
|---|---|
| `pi.plan.approved` | Successful approval |
| `pi.plan.approval_invalidated` | CURRENT edit / re-promote / supersede / fingerprint mismatch |
| `pi.plan.baselined` | Successful baseline (in addition to existing `pi.baseline.created` / `rebaselined`) |

Payload includes actor, PI, CURRENT version, approval/baseline ids, fingerprint, timestamps. No secrets.

**Known debt:** audit writes remain post-commit (same pattern as M3D-B). Domain transaction rolls back without orphaning CURRENT; audit may be missing on rare post-commit failures.

## 9. Portfolio compatibility

Portfolio M2E continues reading **live CURRENT** only.  
Approved baseline remains a separate historical snapshot. Never mixed into live capacity totals.

## 10. Migration ordering

1. `20261009170000_m3d_a_scenario_selection`
2. `20261009180000_m3d_b_scenario_promotion`
3. `20261009190000_m3d_c_plan_approval` ← this milestone

## 11. Known limitations

- Production migration verification may be blocked without production `DIRECT_URL` reachability.
- Empty CURRENT can be approved if readiness allows (with warning ack when needed).
- Preview may eagerly invalidate a VALID approval that no longer matches live fingerprint (self-heal).
