# MVP Roadmap

**Status:** Phase 0 scope recommendation  
**Rule:** Do not assume every advanced feature belongs in MVP

---

## 1. Purpose

Define a realistic MVP that proves an end-to-end management workflow, and clearly separate **MVP / Next / Later**.

---

## 2. MVP Goal

Prove that a department (within a section) can move from demand to governed delivery planning with:

- structured stages;
- approvals and decisions as records;
- documents/evidence basics;
- project linkage;
- multi-department PI planning basics;
- capacity overload signals;
- baseline snapshot;
- executive attention list;
- **no hardcoded business data**.

---

## 3. MVP Vertical Slice (Evaluate / Target)

```text
Organization
→ Section
→ Department
→ Team
→ Resources
→ Demand
→ Requirements
→ Pre-study
→ Approval
→ PoC
→ Decision
→ Pilot
→ Decision
→ Project
→ PI Planning
→ Capacity
→ Baseline
```

### Interpretation for MVP

The slice must be **walkable** as a coherent path. Depth per stage can be constrained, but concepts must not collapse (especially PoC vs Pilot, Recommendation vs Decision).

---

## 4. MVP Scope Table

| Area | MVP includes | MVP excludes (push to Next/Later) |
|---|---|---|
| Org structure | CRUD for org tree, memberships, basic capacity fields | Complex resource types marketplace, HR sync |
| Auth | Standards-based login + scoped RBAC bindings | Full ABAC engine, advanced delegation |
| Demand | Required fields + review before progress | Rich scoring models |
| Requirements | Structured items + categories + basic links | Full enterprise RE tooling / advanced trace matrix UX |
| Pre-study | Structured sections + extensible alternatives list | Simulation tooling |
| Gates | Configurable evidence checklist + approval slots (admin config, limited UI) | Visual policy builder, complex conditional DSL |
| PoC | Full core fields + evidence + **no auto-decision** | Lab integrations |
| Pilot | Full core fields + readiness + **no auto-decision** | Multi-site orchestration |
| Decisions | First-class record + supersession | Multi-signature voting frameworks |
| Approvals | First-class records + outcomes | External e-sign |
| Documents | Hub + versions + approval binding + storage port | Collaborative editing, ECM retention |
| Project | Create from initiative with history link + basic portfolio fields | Advanced financials |
| PI Planning | PI, iterations, allocations, dept views, filters | Polished DnD, scenarios |
| Capacity | Team/resource load + overload detection | Predictive/ML capacity |
| Dependencies | Canonical model + critical flags + needed-by | Advanced graph visualization |
| Cost | Estimate/budget/forecast/variance fields | ERP/ledger |
| Baselines | Approve planning baseline snapshot + compare summary | Multi-branch what-if |
| Executive | Attention queue + drill-down + lifecycle counts | Fully customizable widget studio |
| Excel import | Not in MVP | Mapping/preview/validation |
| Audit | Structured events for material actions | Warehouse-scale analytics |

---

## 5. MVP Path Constraint (Recommendation)

To keep MVP deliverable while preserving the vertical slice:

1. Support the example paths:
   - Pre-study → Project
   - Pre-study → PoC → Project
   - Pre-study → Pilot → Project
   - Pre-study → PoC → Pilot → Project
2. Stage skip only via controlled audited action with approval (even if policy UI is minimal).
3. Ship **one** default evidence/approval policy template as *configuration data created at bootstrap*, editable by admin—not hardcoded irreversible logic.

---

## 6. Next (Post-MVP)

- Drag-and-drop planning UX polish and recalculation UX maturity
- Conditional governance rules UI (thresholds, classification)
- Richer requirement traceability matrix
- Multi-baseline comparison UX
- Excel import v1 (detect/map/preview/validate/reusable mappings)
- Stronger dependency graph views
- Under-allocation policies and shared-resource sophistication
- Notification channels (email/Teams/Slack) — **Open** preference
- Initiative types with distinct permitted graphs

---

## 7. Later

- Full workflow configuration engine
- Deep external integrations (ADO/Jira/ServiceNow/ERP)
- Advanced portfolio optimization
- Multi-tenant SaaS commercialization features (if required)
- Mobile-native apps
- Real-time collaborative planning presence
- Automated evidence quality scoring (still not auto-decision)

---

## 8. Phased Delivery After Phase 0 (Recommended)

| Phase | Intent |
|---|---|
| **Phase 0** | Product foundation docs (this work) — **no app code** |
| **Phase 1** | Repo scaffolding, modular boundaries, auth skeleton, org model, empty-state UX |
| **Phase 2** | Initiative + demand + requirements + documents basics |
| **Phase 3** | Governance (approvals, evidence) + decisions |
| **Phase 4** | PoC + Pilot stage depth + project conversion |
| **Phase 5** | PI Planning + capacity + dependencies + baselines |
| **Phase 6** | Executive attention cockpit + audit reporting hardening |
| **Phase 7+** | Excel import, advanced configurability, integrations |

Phase numbering after 0 is a **recommendation** and may be reshaped during planning—**do not start Phase 1 in this Phase 0 delivery**.

---

## 9. MVP Acceptance Criteria (Product)

MVP is successful when a configured (not hardcoded) organization can:

1. Create section/departments/teams/resources.
2. Capture and review demand.
3. Enter requirements and pre-study with alternatives.
4. Pass a gate using approval records and evidence completeness.
5. Run PoC and record a human Decision for next step.
6. Optionally run Pilot and record a human Decision.
7. Convert to Project with preserved history.
8. Plan work into a PI across ≥2 departments.
9. See overload conflict when capacity exceeded.
10. Approve a planning baseline and view change summary afterward.
11. See pending approvals/decisions in an attention view.
12. Produce audit trail for approvals, decisions, transitions, document approvals, baselines.

---

## 10. Explicit Non-Goals for MVP

- Fake demo tenant as required runtime data
- Auto-decision from PoC/Pilot metrics
- Full finance system
- Microservices
- Excel import implementation
- Pixel-perfect design system completeness

---

## 11. Open Scope Questions

- Is Pilot mandatory in the first production rollout path, or can MVP ship PoC→Project as primary demo path while keeping Pilot model complete?
- Minimum number of concurrent departments for first production PI?
- Auth provider mandate from the customer environment?

These remain **Open** and must be resolved before Phase 1 prioritization locks.
