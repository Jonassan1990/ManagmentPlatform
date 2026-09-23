# Management & PI Planning Platform — Documentation Index

**Phase:** 0 — Product Foundation  
**Status:** Source of truth established (documentation only)  
**Implementation status:** Not started

This directory is the product and architecture source of truth for the Management & PI Planning Platform. No application code, scaffolding, or business seed data belongs in Phase 0.

---

## Purpose of Phase 0

Establish shared understanding of:

- what the product is for;
- which problems it solves for operational and senior managers;
- the organizational, initiative, governance, and planning models;
- architectural direction and MVP boundaries;
- explicit non-goals, open questions, and assumptions.

Phase 1 (implementation scaffolding and domain foundations) must not begin until this set is reviewed and accepted.

---

## Document Map

| Document | Contents |
|---|---|
| [PRODUCT-VISION.md](./PRODUCT-VISION.md) | Problem, users, value proposition, helicopter-view outcomes |
| [PRODUCT-REQUIREMENTS.md](./PRODUCT-REQUIREMENTS.md) | Confirmed requirements, non-goals, acceptance-oriented capability list |
| [DOMAIN-MODEL.md](./DOMAIN-MODEL.md) | Entities, relationships, invariants, extensibility rules |
| [INITIATIVE-LIFECYCLE.md](./INITIATIVE-LIFECYCLE.md) | Stage model, optional paths, skip/gate controls, stage contents |
| [GOVERNANCE-AND-APPROVALS.md](./GOVERNANCE-AND-APPROVALS.md) | Approval records, gates, evidence packages, configurable rules |
| [DECISION-MANAGEMENT.md](./DECISION-MANAGEMENT.md) | Decision vs recommendation, options, auditability |
| [DOCUMENT-MANAGEMENT.md](./DOCUMENT-MANAGEMENT.md) | Documentation Hub, versioning, approval lifecycle |
| [PI-PLANNING-MODEL.md](./PI-PLANNING-MODEL.md) | Multi-department PI Planning, capacity, dependencies, baselines |
| [ROLES-AND-PERMISSIONS.md](./ROLES-AND-PERMISSIONS.md) | Scoped authorization model (no hardcoded identities) |
| [UX-PRINCIPLES.md](./UX-PRINCIPLES.md) | Manager-oriented UX, progressive disclosure, attention model |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Modular monolith, boundaries, persistence, deployment portability |
| [MVP-ROADMAP.md](./MVP-ROADMAP.md) | MVP / Next / Later scope and vertical slice |
| [GLOSSARY.md](./GLOSSARY.md) | Canonical terminology |

### Supporting documents (optional but material)

| Document | Contents |
|---|---|
| [AUDIT-AND-BASELINES.md](./AUDIT-AND-BASELINES.md) | Audit events, baseline/snapshot semantics |
| [EXCEL-MIGRATION.md](./EXCEL-MIGRATION.md) | Future import architecture (not implemented in Phase 0) |
| [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) | Unresolved questions and assumption log |
| [PHASE-1-IMPLEMENTATION.md](./PHASE-1-IMPLEMENTATION.md) | Phase 1 technical foundation decisions |
| [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md) | Local Docker/Postgres workflow |
| [DEPLOYMENT-VERCEL.md](./DEPLOYMENT-VERCEL.md) | Vercel readiness (portable architecture) |
| [adr/](./adr/) | Architecture Decision Records |

---

## How to Read These Documents

1. Start with **PRODUCT-VISION** and **GLOSSARY**.
2. Read **DOMAIN-MODEL** and **INITIATIVE-LIFECYCLE** for the conceptual core.
3. Read **GOVERNANCE-AND-APPROVALS**, **DECISION-MANAGEMENT**, and **DOCUMENT-MANAGEMENT** for control planes.
4. Read **PI-PLANNING-MODEL** and **ROLES-AND-PERMISSIONS** for planning and access.
5. Read **ARCHITECTURE** and **MVP-ROADMAP** before any implementation planning.
6. Check **OPEN-QUESTIONS** before converting recommendations into requirements.

### Classification markers used across docs

| Marker | Meaning |
|---|---|
| **Confirmed** | Accepted product requirement for this platform direction |
| **Recommendation** | Architectural or product recommendation; not yet binding |
| **Future** | Intended capability; not required for MVP |
| **Open** | Unresolved; must not be silently assumed |

---

## Hard Constraints (Phase 0)

- Do **not** implement application code.
- Do **not** scaffold Next.js or other stack components in this phase.
- Do **not** create fake/mock business data (users, departments, projects, PoCs, etc.).
- Do **not** hardcode organizational identities or role assignments into future application logic.
- Do **not** treat Vercel as a domain constraint; it is an initial deployment target only.
- Do **not** start Phase 1 from this documentation commit alone without explicit go-ahead.

---

## Consistency Rules Across Documents

These invariants must hold everywhere:

1. **PoC ≠ Pilot** — different questions, different evidence, different outcomes.
2. **Recommendation ≠ Decision** — humans make governance decisions.
3. **Approvals are first-class records** — not a boolean flag alone.
4. **Approved documents do not silently mutate** while retaining prior approval.
5. **Traceability is preserved** across demand → delivery.
6. **Dependencies have one source of truth**.
7. **PI Planning is multi-department**.
8. **Capacity problems must be detectable**, not only displayed.
9. **No hardcoded business data** in product behavior.
10. **Deployment is portable** beyond the initial GitHub → Vercel path.

---

## Change Control

Changes to these documents after Phase 0 acceptance should:

- update the affected document(s);
- update **OPEN-QUESTIONS** when assumptions are resolved or new ones appear;
- note material contradictions resolved in PR descriptions;
- keep **GLOSSARY** aligned with renamed concepts.
