# PI Scenario Promotion (M3D-B)

**Date:** 2026-10-09  
**Scope:** Controlled promote of the selected scenario’s allocations into CURRENT  
**Related:** Approval / immutable baseline — see `PI-SCENARIO-APPROVAL-BASELINE-CONTRACT.md` (M3D-C)

## 1. Architecture

- Exactly one CURRENT `PlanningRevision` per PI (identity preserved).
- `WorkAllocation` remains the sole allocation ledger.
- Promote = **allocate-replace**: delete CURRENT allocations, clone selected scenario allocations onto the same CURRENT revision id.
- Source scenario is marked `PROMOTED` and left otherwise unchanged.
- Other scenarios and historical `PiBaseline` rows are untouched.
- Portfolio M2E continues to read CURRENT only — it sees new commitments only after a successful promote.

## 2. Approval boundary

| Act | Permission | Mutates CURRENT? | Creates baseline? |
|---|---|---|---|
| Select | `PI_REVIEW` | No | No |
| Promote | `PI_REVIEW` | Yes | No |
| Approve | `PI_REVIEW` | No | No |
| Baseline | `PI_BASELINE` @ ORGANIZATION | No (snapshots CURRENT) | Yes |

Selection is not approval. Promotion does not mark the PI or scenario APPROVED/BASELINED. Approval is a separate M3D-C step (`PiPlanApproval`) required before baseline.

Ordering is unambiguous: **promote → approve → createBaseline**. No governance weakening.

## 3. Prerequisites

- PI exists and is not `CLOSED`.
- Exactly one selected scenario (`ProgramIncrement.selectedRevisionId`).
- Selected revision belongs to the PI, is not archived, is not CURRENT.
- Caller has `PI_REVIEW` at org/section scope.
- Optimistic versions: PI, selected revision, CURRENT revision.
- Readiness re-evaluated at promote time (not selection-time cache).
- No hard readiness blockers (`NOT_READY` / `UNAVAILABLE` rejected).
- `READY_WITH_WARNINGS` requires `acknowledgeWarnings: true`.

## 4. Transaction

Within one DB transaction:

1. Version-lock PI (`updateMany` + expected version).
2. Re-verify selection id + source/CURRENT versions.
3. Delete CURRENT allocations; insert clones from selected.
4. Bump CURRENT and source revision versions; set source `PROMOTED`; clear selection.
5. Record `lastPromotedFromRevisionId` / `lastPromotedAt` / `lastPromotedByPrincipalId`.
6. Commit; then audit `pi.scenario.promoted`.

Any failure leaves CURRENT unchanged.

## 5. Concurrency & idempotency

- Concurrent promotes: one wins on PI version lock; loser gets `CONFLICT`.
- Stale PI / selected / CURRENT versions → `CONFLICT`.
- Selection changed between review and promote → `CONFLICT`.
- Retry after success with stale expected versions → `CONFLICT` (no duplicate rows).
- Idempotent replay: when selection is already cleared, source is `PROMOTED`, versions match, and CURRENT fingerprint equals source → success with `idempotentReplay: true` (no mutation).

## 6. Audit payload (`pi.scenario.promoted`)

- Actor principal id
- PI id
- Source revision id/key
- CURRENT revision id
- Previous / new CURRENT version
- Allocation count + total committed hours
- Timestamp
- Whether warnings were acknowledged

No secrets or unnecessary PII.
