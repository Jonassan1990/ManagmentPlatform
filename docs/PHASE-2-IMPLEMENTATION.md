# Phase 2 Implementation

**Status:** Implemented on branch `phase2-initiative-prestudy`  
**Baseline:** `main` @ `ca952a3` (Phase 0 + Phase 1)

---

## 1. Goal

Deliver the first real initiative workflow:

```text
Initiative → Demand → Requirements → Pre-study → Pre-study Readiness
```

Phase 2 does **not** implement approval/decision execution, PoC, Pilot, Project conversion, PI Planning, capacity, dependencies, Excel import, AI, or production OIDC.

---

## 2. Initiative aggregate

`Initiative` is the durable lifecycle root.

| Field | Notes |
|---|---|
| id | UUID |
| referenceKey | `INIT-0001` style, org-scoped counter |
| title | Mutable; not used as identity |
| organizationId / departmentId | Validated parent relationship |
| requesterName / businessOwnerName | Free-text business person references — **not** Principal/Resource FKs |
| currentStage | DEMAND \| REQUIREMENTS \| PRE_STUDY |
| status | ACTIVE / ON_HOLD / CANCELLED / ARCHIVED |
| version | Optimistic concurrency |

Demand, Requirements, Pre-study, Risks, and Documents hang off the same Initiative. Progression does not fork a new identity.

---

## 3. Lifecycle

Explicit application operations:

- `advanceLifecycle({ toStage: "REQUIREMENTS" })`
- `advanceLifecycle({ toStage: "PRE_STUDY" })`

Rules:

- Only DEMAND→REQUIREMENTS and REQUIREMENTS→PRE_STUDY are allowed in Phase 2.
- Demand must be complete before Requirements.
- Requirements must include ≥1 ACCEPTED and no DRAFT/PROPOSED before Pre-study.
- Every transition writes `LifecycleTransition` + audit event.
- No generic “change status” UI.

---

## 4. Demand

Structured fields: problem/opportunity, reason, expected value, affected areas, urgency, strategic alignment, initial impact, notes.

Completion is evaluated by `isDemandComplete` / `canAdvanceFromDemand` in the readiness policy module.

---

## 5. Requirements

First-class records with category, priority, status, owner/source references, acceptance criteria children, and relationships:

- DEPENDS_ON / RELATED_TO / REFINES / CONFLICTS_WITH
- Self-relation rejected
- Duplicate relation rejected
- Cross-initiative relation rejected

---

## 6. Pre-study

`PreStudy` + `PreStudyAssessment` + `SolutionAlternative`.

Assessment areas are an enum that includes OTHER for extensibility. Required areas for readiness are listed in the policy module (not scattered in React).

Alternatives are free-titled. `isRecommended` is explicitly **not** a decision.

---

## 7. Risks

Canonical `Risk` owned by Initiative (not `PreStudyRisk`).

---

## 8. Documents / evidence foundation

`ManagedDocument` + `DocumentVersion` metadata only. Binary upload deferred; `storagePointer` reserved; no blobs in PostgreSQL. UI states this clearly.

---

## 9. Pre-study readiness

Implemented in `src/modules/initiative/application/readiness-policy.ts`.

- Pure derivation from snapshot state
- No persisted `ready` boolean on Initiative
- Default required assessments + alternatives + accepted requirements
- Warnings (e.g. missing risks) do not block by default
- Readiness ≠ Approval (Phase 3)

---

## 10. What needs attention

`attention.ts` builds deterministic items from the same snapshot. No AI/demo warnings.

---

## 11. Authorization

New permissions:

- initiative.view / create / edit
- initiative.manage_demand / manage_requirements / manage_prestudy / manage_risk
- initiative.advance

Granted to organization admin and platform bootstrap roles (configuration, not person hardcoding).

---

## 12. Concurrency & audit

Version fields on mutable records; stale updates → `STALE_VERSION`.

Structured audit for initiative/demand/lifecycle/requirement/assessment/alternative/risk/document events.

---

## 13. Deferred to Phase 3

Approval execution, decision records as governance outcomes, PoC, Pilot, project conversion, configurable evidence packages UI, binary document storage, OIDC.
