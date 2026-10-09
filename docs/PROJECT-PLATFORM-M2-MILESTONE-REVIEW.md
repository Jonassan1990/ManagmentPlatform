# Project Platform — M2 Milestone Review & Product Roadmap Decision (M2F-B)

**Date:** 2026-10-09  
**Baseline main SHA:** `0932cbc9dc486e15e70041cf9b6761fddd5d6376` (M2F-A Portfolio Acceptance merged)  
**Nature:** Documentation and architecture assessment only — no feature implementation  
**Prior acceptance:** [PORTFOLIO-M2-ACCEPTANCE.md](./PORTFOLIO-M2-ACCEPTANCE.md) (M2A–M2E verified PASS)

---

## 1. Executive summary

Portfolio Management (M2A–M2E) is **accepted**. The platform now provides an authorization-aware helicopter view across lifecycle KPIs, explorer navigation, delivery health, and PI/capacity — without a second capacity engine or persisted health ledger.

This review updates maturity scores against the documented **enterprise product vision** and **MVP**, assesses production readiness, compares five strategic capability areas, and selects **exactly one** next product milestone.

| Scorecard | Percentage | Directional change after M2 |
|---|---|---|
| Full enterprise product vision | **58%** | ↑ from ~48% (helicopter view + portfolio capacity closed major vision gap) |
| Documented MVP | **90%** | ↑ from ~82% (executive attention + multi-dept capacity/overload now portfolio-complete) |
| Production readiness | **68%** | ↑ from ~55% (accepted Portfolio M2 on deployed Vercel app; OIDC cutover still open) |

**Recommended next product milestone (only one):**  
**M3 — PI Planning Scenarios & What-If Resource Planning**

---

## 2. Completion — full enterprise product vision

**Sources:** [PRODUCT-VISION.md](./PRODUCT-VISION.md), [PRODUCT-REQUIREMENTS.md](./PRODUCT-REQUIREMENTS.md), Later items in [MVP-ROADMAP.md](./MVP-ROADMAP.md).

Vision success means replacing fragmented Excel planning for a multi-department section with governed lifecycle, auditable decisions, multi-dept PI planning, and actionable senior-manager attention — **not** ERP/HRIS/full SaaS commercialization.

### Pillar scoring (weighted toward vision outcomes)

| Pillar | Weight | Maturity | Score contribution | Evidence / residual gap |
|---|---|---|---|---|
| Lifecycle & traceability | 18% | 85% | 15.3 | Demand→…→Project walkable; history preserved. Full RE trace matrix UX incomplete. |
| Governance & decisions | 16% | 78% | 12.5 | First-class approvals/decisions/audit. Visual policy builder / ABAC / e-sign Later. |
| Planning & capacity | 18% | 72% | 13.0 | PI board, capacity-policy, conflicts, baselines, **portfolio capacity**. Scenarios/DnD/under-allocation residual. |
| Evidence & documentation | 10% | 55% | 5.5 | Hub + versions + gate binding. Binary upload / ECM retention deferred. |
| Management attention (helicopter) | 18% | 88% | 15.8 | Portfolio KPIs, attention, delivery health, PI & capacity (M2). Widget studio / budget depth residual. |
| AuthZ & multi-dept collaboration model | 8% | 80% | 6.4 | Phase 0C RBAC + scoped portfolio. Push collaboration / presence Later. |
| Excel cutover & integrations | 7% | 8% | 0.6 | Import architecture docs only. ADO/Jira/ERP Later. |
| Cost / spend visibility | 5% | 30% | 1.5 | Model readiness; not a finance system. |

**Weighted enterprise vision completion: 58%.**

Interpretation: the product is past “foundation only.” Core management loops work. Remaining vision weight is dominated by scenarios, import/cutover, collaboration channels, deep configurability, and external integrations — correctly **out of M2**.

---

## 3. Completion — documented MVP

**Sources:** [MVP-ROADMAP.md](./MVP-ROADMAP.md) §2–§4 and §9 acceptance criteria.

| # | MVP acceptance criterion | Status |
|---|---|---|
| 1 | Create section/departments/teams/resources | **Met** |
| 2 | Capture and review demand | **Met** |
| 3 | Requirements + pre-study with alternatives | **Met** (depth constrained) |
| 4 | Gate with approval records + evidence completeness | **Met** (constrained config) |
| 5 | PoC + human Decision | **Met** |
| 6 | Optional Pilot + human Decision | **Met** |
| 7 | Convert to Project with preserved history | **Met** |
| 8 | Plan work into a PI across ≥2 departments | **Met** |
| 9 | See overload conflict when capacity exceeded | **Met** (+ portfolio surface in M2E) |
| 10 | Approve planning baseline + change summary | **Met** |
| 11 | Pending approvals/decisions in an attention view | **Met** (portfolio + approvals/decisions) |
| 12 | Audit trail for material actions | **Met** |

### MVP residual (does not reopen M2)

| Residual | Why not “100%” |
|---|---|
| Document binary storage / upload UX | Metadata hub shipped; binary port deferred (explicit Phase 6 backlog) |
| Planning DnD polish | Manual allocation works; polished DnD is Next |
| Cost fields “MVP-light” depth | Model-ready; not executive budget cockpit |
| Under-allocation as first-class policy | Overload done; under-allocation policies Next |
| Formal WCAG audit | Basic a11y present; formal pass open |

**Documented MVP completion: 90%.**

The vertical slice is walkable end-to-end. Remaining MVP gaps are polish and deferred storage/UX — not missing stage concepts.

---

## 4. Production-readiness percentage

**Sources:** [DEPLOYMENT-ACCEPTANCE.md](./DEPLOYMENT-ACCEPTANCE.md), [PRODUCTION-AUTH-RUNBOOK.md](./PRODUCTION-AUTH-RUNBOOK.md), [PHASE-6-BACKLOG.md](./PHASE-6-BACKLOG.md), live alias probe, M2F-A gates.

| Dimension | Weight | Score | Notes |
|---|---|---|---|
| Deployability (Vercel + Prisma migrate) | 15% | 90% | App builds/deploys; migrations defined |
| Hosted production instance | 15% | 85% | Alias live; Portfolio routes auth-gated |
| Authentication posture | 20% | 55% | OIDC **implemented**; production login currently **temporary owner** path (“Sign in” / owner). OIDC cutover + temp-auth retirement still required for enterprise SSO. |
| Authorization (Phase 0C) | 15% | 90% | Server-side RBAC; portfolio scoped; fail-closed tested |
| Data integrity / domain engines | 15% | 88% | Single capacity-policy; immutable baselines; health non-persisted |
| Operability (runbooks, bootstrap) | 10% | 70% | Runbooks exist; monitoring/OTel/DR not first-class |
| Quality gates / acceptance | 10% | 92% | M2F-A: 137 unit / 162 integration; Portfolio M2 accepted |

**Weighted production readiness: 68%.**

Safe for **controlled production use** with temporary owner credentials and trained operators. **Not** yet “enterprise SSO production complete.” Do not treat DEV auth as a production path (`ALLOW_DEV_AUTH` forbidden in production).

---

## 5. Capability maturity matrix

Scale: **N** Not started · **F** Foundation · **P** Partial · **O** Operational · **M** Mature

| Capability area | Level | Notes |
|---|---|---|
| Org hierarchy & resources | O | CRUD + memberships + capacity fields |
| Initiative lifecycle stages | O | Constrained configurable path |
| Governance approvals / decisions | O | First-class records; limited policy UX |
| Documents / evidence | P | Hub + versions; binary upload deferred |
| Project / issues / closure | O | Delivery health consumes these |
| PI Planning board & allocations | O | Multi-dept; conflict engine |
| Capacity policy & overload | O | Canonical hours engine |
| Portfolio dashboard (M2A/B) | O | Scoped KPIs + attention |
| Portfolio explorer (M2C) | O | Search/filter/pagination |
| Delivery health (M2D) | O | Classifications + explain |
| Portfolio PI & capacity (M2E) | O | Live CURRENT vs baseline compare |
| PI scenarios / what-if | F | `PlanningRevision` exists; no A/B scenario UX |
| Dependencies | P→O | Canonical model + critical flags; graph UX Next |
| Collaboration / notifications | F | History/comments partial; no push channels / presence |
| Resource planning sophistication | P | Shared membership handled; calendars/skills/under-allocation Next |
| Enterprise authentication (OIDC) | P→O | Code ready; production cutover incomplete |
| Excel import | N→F | Architecture only |
| External PM/ITSM/ERP sync | N | Later |
| Advanced workflow engine | F | Designed for; not shipped |

---

## 6. Cross-department PI / capacity visibility assessment

### What M2 delivered

| Audience | Visibility | Assessment |
|---|---|---|
| Organization / Portfolio Manager | Org-wide PI list + capacity roll-ups, dept/team/resource drill-down, conflicts, project commitments | **Operational** — matches senior-manager “where are we overloaded?” |
| Section Manager | Section-scoped PI view when `PI_VIEW` holds at section | **Operational** within section |
| Department Manager | Sees participating teams in authorized departments; **denied** on section-scoped PI without SECTION `PI_VIEW` | **By design** (Phase 0C / M2E-A) — not a defect; sibling isolation holds |
| Viewer | Read-only portfolio/capacity when org-scoped `pi.view` present | **Operational read-only** |
| Unauthorized | No portfolio data | **Fail closed** |

### Strengths

- One capacity calculation path (`capacity-policy` / `CapacityService`); portfolio does not invent hours.
- Shared resources use membership % without double-counting totals.
- CURRENT revision metrics remain distinct from approved baseline payloads.
- Portfolio and PI Planning navigate to the same planning truth.

### Residual visibility gaps (product, not M2 bugs)

1. No **scenario comparison** of alternate cross-dept plans (only live CURRENT + baseline delta).
2. Dependency **graph** across departments is list/critical-flag oriented, not a senior-manager graph.
3. No notification when another department’s change creates overload/conflict.
4. Department managers may need an explicit **section-participating** read path UX explanation when SECTION `PI_VIEW` is absent.

**Overall assessment:** Cross-department PI/capacity visibility for executive and section scope is **fit for MVP+**. Scenario and collaboration layers are the next visibility amplifiers.

---

## 7. Top five remaining product gaps

| Rank | Gap | Why it matters now |
|---|---|---|
| 1 | **PI Planning Scenarios / what-if** | `PlanningRevision` foundation exists; managers still cannot compare alternate capacity plans before baselining. |
| 2 | **Enterprise OIDC production cutover** | Auth code ready; production alias still on temporary owner login. Blocks SSO adoption and temp-auth retirement. |
| 3 | **Collaboration & notifications** | Attention is pull-based; cross-dept overload/approval changes do not push to owners. |
| 4 | **Excel import / migration tooling** | Spreadsheet replacement vision requires detect/map/preview/validate for cutover. |
| 5 | **Resource planning depth** | Under-allocation policies, richer availability calendars, and allocation UX polish (DnD) remain Next. |

Honorable mentions (not top five): dependency graph UX, binary document storage, formal WCAG, budget/spend executive views, external integrations.

---

## 8. Comparison — five strategic capability areas

| Area | Maturity | Product readiness | Strategic note |
|---|---|---|---|
| **PI Scenarios** | **Low (Foundation)** | Not demo-ready as a scenario product | Highest leverage next *product* capability after Portfolio M2; unlocks “what if we rebalance?” without mutating the only live plan. |
| **Dependencies** | **Medium–High** | Operational for critical flags / lists | Canonical SOT exists; advanced graph + external sync are polish/Later. |
| **Collaboration** | **Low** | Weak as a collaboration product | Comments/history incomplete; no Teams/Slack/email channels or planning presence. |
| **Resource Planning** | **Medium–High** | Operational for load/overload | Strong engine + portfolio UI; scenarios/calendars/under-allocation still open. |
| **Enterprise Authentication** | **Medium–High (code) / Medium (ops)** | SSO cutover incomplete | OIDC + bootstrap + fail-closed are implemented; production still depends on temporary owner credentials until IdP is wired. |

### Decision logic

- **Dependencies** and **Resource Planning** are already operational enough that they should not be the *sole* next milestone.
- **Enterprise Authentication** is primarily an **operations cutover** (credentials + retirement of temp auth), not a greenfield product epic — it should run as a parallel release track, not displace the next capability milestone.
- **Collaboration** without scenario/planning substance risks becoming notification chrome.
- **PI Scenarios** uniquely extend the newly accepted portfolio capacity story: executives can finally *see* overload; next they need to *compare plans* before baseline.

---

## 9. Recommended next product milestone (exactly one)

# **M3 — PI Planning Scenarios & What-If Resource Planning**

### Intent

Enable managers to create and compare alternate planning revisions (scenarios) for a Program Increment — reallocating work across departments/teams/resources — while preserving:

- a single capacity-policy engine;
- immutable approved baselines;
- clear distinction between **scenario draft**, **CURRENT live plan**, and **approved baseline**;
- Phase 0C scoped visibility.

### In scope (directional)

- Scenario create/label/switch on top of `PlanningRevision` (or equivalent revision model already present).
- Capacity/conflict preview per scenario using existing engines (no second ledger).
- Compare scenario vs CURRENT and/or vs baseline (hours + overload/conflict deltas).
- Promote/select a scenario to CURRENT under authorization + audit.
- Portfolio capacity may later accept an explicit revision selector (optional follow-on; not required to start M3).

### Explicitly out of M3

- Excel import
- Full notification platform
- OIDC IdP procurement (ops track)
- Workflow policy builder
- Optimization solvers / ML capacity

### Exit criteria (product)

1. User can create ≥2 named scenarios for one PI without mutating baseline payloads.
2. Overload/conflicts compute per scenario via existing capacity-policy/conflict engine.
3. Diff view shows committed-hour and conflict differences vs CURRENT.
4. Authorized promote-to-CURRENT is audited; unauthorized promote denied.
5. Regression: M2 Portfolio capacity still reads CURRENT correctly; baselines remain immutable.

---

## 10. Revised implementation roadmap

| Horizon | Milestone | Outcome |
|---|---|---|
| **Done** | Phase 0–5 | Org, lifecycle, governance, PoC/Pilot, project, PI planning core |
| **Done** | Phase 6 | Production auth *code* (OIDC, bootstrap, temp-auth ADR-026) |
| **Done** | **M2 Portfolio (M2A–M2E + M2F-A)** | Query → dashboard → explorer → delivery health → PI & capacity; accepted |
| **Next (product)** | **M3 — PI Scenarios & What-If Resource Planning** | Alternate plans with capacity/conflict compare |
| **Parallel (ops)** | **R3 — Enterprise Auth Production Cutover** | Wire OIDC on Vercel; retire `TEMP_AUTH_*`; smoke SSO; keep fail-closed |
| **Then** | **M4 — Collaboration & Attention Notifications** | Push channels for approvals, decisions, overload/conflict events |
| **Then** | **M5 — Dependency Graph & Cross-Dept Coordination UX** | Graph views on canonical dependency SOT |
| **Then** | **M6 — Excel Import v1** | Detect/map/preview/validate for spreadsheet cutover |
| **Then** | **M7 — Resource Planning Depth** | Under-allocation policies, calendars, allocation UX polish |
| **Later** | Workflow engine, external integrations, portfolio optimization, multi-tenant SaaS features | Per vision Later |

### Sequencing rationale

1. Scenarios capitalize immediately on M2 capacity visibility.  
2. Auth cutover runs in parallel so production readiness climbs without blocking product learning.  
3. Collaboration after scenarios avoids notifying on a plan model users cannot branch.  
4. Excel import after core planning maturity reduces mapping churn.  

---

## 11. Risks & open questions (carry-forward)

| ID | Topic | Impact on roadmap |
|---|---|---|
| Auth | Production IdP selection & credential ownership | Blocks R3 completion |
| OQ (MVP-ROADMAP) | Pilot mandatory vs PoC→Project primary path | Training/demo path only; not M3 blocking |
| OQ-50 | Under-allocation in MVP vs Next | Deferred to M7 |
| Scenario semantics | Whether multiple CURRENT revisions are ever allowed | Must stay **one CURRENT**; scenarios are non-current until promoted |

---

## 12. Verdict

| Question | Answer |
|---|---|
| Is Portfolio M2 accepted? | **Yes** (M2F-A) |
| Is the documented MVP substantially complete? | **Yes (~90%)** |
| Is the full enterprise vision complete? | **No (~58%)** — appropriately |
| Is production enterprise-SSO ready? | **Not fully (~68% overall readiness)** — temp owner path active |
| What is the single next **product** milestone? | **M3 — PI Planning Scenarios & What-If Resource Planning** |

**M2F-B COMPLETE — ROADMAP DECISION RECORDED**

STOP. Do not implement M3 in this phase.
