# Phase 4 Implementation

**Status:** Implemented on branch `phase4-pilot-project`  
**Baseline:** Phase 0–3 (Organization + Initiative + Governance/PoC)

---

## 1. Goal

Deliver Pilot stage depth and governed project conversion:

```text
PoC GO → createPilot → operational readiness → Pilot gate →
SCALE / CONDITIONAL_SCALE → convertToProject → milestones / work items
```

Phase 4 does **not** implement PI Planning, capacity, dependencies, Excel import, AI, binary document storage, or production OIDC.

---

## 2. Pilot (≠ PoC)

First-class `Pilot` + `PilotCriterion` + `PilotFeedback` + `PilotExtension` owned by Initiative.

Pilot answers **scale readiness in a limited real/production-like context**. Operational completeness (site/area, environment, support model, rollback) is required for start readiness.

Status advances only adjacent-forward:

`DRAFT → READY → IN_PROGRESS → EVALUATION → COMPLETED`

| Gate | Policy |
|---|---|
| DRAFT → READY | Definition complete (`isPilotDefinitionComplete`) |
| READY → IN_PROGRESS | Start readiness (`evaluatePilotStartReadiness`) |
| Governance submit | Derived readiness (`evaluatePilotGovernanceReadiness`) — never a stored flag |

Governance readiness requires EVALUATION/COMPLETED, all required criteria evaluated, results, and business/technical/operational findings.

---

## 3. Pilot gate & scale decisions

`GovernanceGate` type `PILOT_GATE` reuses the Phase 3 submission / snapshot / approval / decision machinery.

Pilot-gate outcomes (human-chosen; recommendation never auto-copied):

| Outcome | Effect |
|---|---|
| `SCALE` | Initiative ACTIVE; `convertToProject` permitted |
| `CONDITIONAL_SCALE` | Requires ≥1 condition; blocking open conditions gate conversion |
| `EXTEND_PILOT` | Writes `PilotExtension`; updates planned end; stage stays PILOT; history retained |
| `STOP` | Initiative `CANCELLED`; conversion blocked |
| `HOLD` | Initiative `ON_HOLD`; conversion blocked |

PoC GO does **not** auto-create Pilot. Pilot SCALE does **not** auto-create Project.

---

## 4. Project conversion & traceability

`convertToProject` is an authorized action (`project.convert`):

- Requires latest Pilot-gate decision `SCALE` or `CONDITIONAL_SCALE` with blocking conditions resolved.
- Unique `initiativeId` → duplicate conversion → `CONFLICT`.
- Advances stage `PILOT → PROJECT` with lifecycle transition + audit.
- Same Initiative identity preserved; PoC/Pilot/decisions remain queryable via `ProjectService.getTraceability`.

`Project` supports Decimal budget fields, participating departments, milestones, and hierarchical work items (EPIC → FEATURE → TASK via `parentId`).

---

## 5. Approval policy versioning

`ApprovalRequirementTemplate` rows are versioned (`policyVersion`, supersede-on-update).

- `updateApprovalTemplate` supersedes the old row and inserts `policyVersion + 1`.
- Submissions store `policyVersion`; `ApprovalRequest` snapshots `authorityKey` / `requiredPermission` / `label` at submit time.
- Later template changes do **not** mutate historical request authorities.

---

## 6. Attention & capabilities

Attention items extended for Pilot (draft / unevaluated criteria / incomplete results / ready-for-decision) and Project (missed milestones / high open risks).

`resolveCapabilities` / `getPrincipalCapabilities` expose UI capability flags from authorization — never hardcoded identities.

New permissions (role-granted): `pilot.*`, `project.*`, `governance.policy.manage`.

---

## 7. Testing & smoke

- Unit: `tests/unit/pilot-readiness.test.ts`; Pilot/Project attention in `governance-attention.test.ts`
- Integration: `tests/integration/pilot-project.test.ts` (progression, pilot lifecycle, scale decisions, conversion, project, policy, auth, security, concurrency)
- Smoke: `npx tsx scripts/smoke-phase4.ts` (happy Project path + CONDITIONAL_SCALE + EXTEND_PILOT)

Service-level only — tests do not depend on Next.js pages.

---

## 8. Deferred to Phase 5 / later

PI Planning, capacity, dependencies, Excel import, AI recommendations-as-decisions, binary document storage, production OIDC.
