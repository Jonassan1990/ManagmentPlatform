# Phase 3 Implementation

**Status:** Implemented on branch `phase3-governance-poc`  
**Baseline:** Phase 0–2 (Organization + Initiative Demand/Requirements/Pre-study)

---

## 1. Goal

Deliver the first governance-controlled progression path:

```text
Pre-study READY → Submit → Approvals → Decision → PoC → PoC readiness → (optional) PoC gate
```

Phase 3 does **not** implement Pilot, Project conversion, PI Planning, capacity, dependencies, Excel import, AI, binary document storage, or production OIDC.

---

## 2. Governance submission & review snapshot

`GovernanceGate` is durable per initiative+gateType (`PRE_STUDY_GATE` | `POC_GATE`).

Each submit creates:

| Artifact | Notes |
|---|---|
| `GovernanceSubmission` | Revisioned; status machine through review → decision |
| `ReviewSnapshot` | **Immutable** frozen workspace JSON for that revision |
| `EvidencePackage` + `EvidenceEntry` | Derived from snapshot; presence flags, no blobs |
| `ApprovalRequest` rows | From `ApprovalRequirementTemplate` seeds |
| `DecisionPackage` | Question + optional **recommendation** (not a decision) |

Revise after `CHANGES_REQUESTED` creates a **new** snapshot/submission; prior snapshot rows remain.

---

## 3. Approvals

- `ApprovalRecord` is **immutable** (one record per completed request).
- Outcomes: `APPROVED` | `REJECTED` | `CHANGES_REQUESTED`.
- Authority is permission-scoped (`approval.authority.*` + `approval.review`), not hardcoded people.
- All required approvals → submission `APPROVALS_COMPLETE`.
- Re-review requires a new submission revision (new requests), not mutating old records.

---

## 4. Decisions

- `DecisionRecord` is immutable; outcome is human-chosen: `GO` | `CONDITIONAL_GO` | `NO_GO` | `HOLD`.
- Package `recommendationText` is informational and **never** auto-copied into outcome.
- `CONDITIONAL_GO` requires ≥1 `DecisionCondition`; blocking open conditions gate PoC creation.
- Decision only allowed when submission status is `APPROVALS_COMPLETE`.

Lifecycle side effects:

| Outcome | Initiative effect | PoC |
|---|---|---|
| GO | stays ACTIVE | `createPoC` allowed → stage `POC` |
| CONDITIONAL_GO | stays ACTIVE | allowed after blocking conditions resolved |
| NO_GO | `CANCELLED` | not created |
| HOLD | `ON_HOLD` | not created |

---

## 5. PoC (Proof of Concept)

First-class `PoC` + `PoCSuccessCriterion` owned by Initiative.

Status advances only adjacent-forward:

`DRAFT → READY → IN_PROGRESS → EVALUATION → COMPLETED`

- Definition completeness required for `READY` (objective/hypothesis/scope + ≥1 required criterion).
- Readiness for PoC governance is **derived** (`evaluatePoCReadiness`) — never a stored ready flag.
- Ready when status is EVALUATION/COMPLETED, all required criteria evaluated, results + findings present.

PoC ≠ Pilot. Phase 3 does not add Pilot entities.

---

## 6. Evidence

Evidence packages bind to a submission + gate. Entries classify kind/requirement level and reference snapshot bindings. Binary upload remains deferred (`storagePointer` on documents unchanged).

---

## 7. Attention

`buildAttentionItems` extended for governance/PoC:

- pending approvals (warning)
- changes requested / decision required / open blocking conditions (blockers)
- PoC unevaluated required criteria / incomplete results / ready-for-decision info

Deterministic; no AI or demo alerts.

---

## 8. Authorization

New permissions (granted to organization admin + platform bootstrap roles via role configuration, not person hardcoding):

- `governance.view` / `governance.submit`
- `approval.review` + `approval.authority.business|architecture|security`
- `decision.make` / `decision.condition.resolve`
- `poc.create` / `poc.edit` / `poc.transition` / `poc.evaluate`

Cross-org access is rejected.

---

## 9. Concurrency & audit

Optimistic `version` on mutable governance/PoC rows; stale writes → `STALE_VERSION`.

Approval/decision records are insert-once. Structured audit events for submit, approval, decision, condition resolve, PoC lifecycle.

---

## 10. Default approval templates

`ApprovalRequirementTemplate` seeds for Pre-study and PoC gates (business / architecture / security). Data-driven; orgs may later deactivate/extend without code changes.

---

## 11. Testing & smoke

- Unit: PoC readiness, risk readiness warning policy, governance attention shapes
- Integration: `tests/integration/governance.test.ts` against Postgres
- Smoke: `npx tsx scripts/smoke-phase3.ts` (happy + negative not-ready + conditional-go)

---

## 12. Deferred to Phase 4 / later

Pilot stage depth, project conversion, configurable evidence package UI beyond defaults, binary document storage, production OIDC, Excel import, AI recommendations as decisions.
