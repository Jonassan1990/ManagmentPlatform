# Product Requirements

**Status:** Phase 0 requirements baseline  
**Companion docs:** Vision, Domain Model, Lifecycle, Governance, MVP Roadmap

---

## 1. Purpose

Capture **confirmed** product requirements for the Management & PI Planning Platform, distinguish them from recommendations and future work, and define acceptance-oriented capability expectations.

This is not a UI wireframe set and not an API specification.

---

## 2. Scope

### In scope for the product (overall)

- Organizational hierarchy and scoped access
- Initiative lifecycle with rich stages
- Demand/idea capture and review
- Requirement management with categories and traceability
- Pre-study, PoC, Pilot as distinct stage capabilities
- Decision management and approval/governance engine
- Documentation Hub with version/approval semantics
- Evidence/readiness for gates
- Project/portfolio representation after governance
- Multi-department PI Planning, capacity, dependencies
- Cost/budget readiness (not full finance)
- Baselines/snapshots
- Executive attention cockpit
- Auditability
- Future Excel import architecture (documented; not Phase 0 implementation)

### Out of scope for Phase 0

- Application implementation
- Scaffolding
- Seed/fake business data
- Concrete UI builds

---

## 3. Requirement Classification

| Key | Meaning |
|---|---|
| **FR-*** | Functional requirement (confirmed product need) |
| **NFR-*** | Non-functional / quality requirement |
| **AR-*** | Architectural requirement |
| **REC-*** | Recommendation (not binding until accepted) |
| **FUT-*** | Future capability (post-MVP unless promoted) |

---

## 4. Functional Requirements

### 4.1 Organization & Resources

| ID | Statement | Class |
|---|---|---|
| FR-ORG-001 | System shall represent Organization → Section → Department → Team → Resource hierarchy. | Confirmed |
| FR-ORG-002 | Resources shall support identity/reference, role, skills/capabilities, availability, capacity, and membership. | Confirmed |
| FR-ORG-003 | Resource model shall not assume every resource is a person; domain must be extensible. | Confirmed |
| FR-ORG-004 | Access shall be scopable (e.g., own department vs cross-department visibility). | Confirmed |
| FR-ORG-005 | Platform shall not require hardcoded users, departments, teams, or role assignments to function. | Confirmed |

### 4.2 Initiative Lifecycle

| ID | Statement | Class |
|---|---|---|
| FR-LC-001 | Initiatives shall progress through governed stages (not status-string-only). | Confirmed |
| FR-LC-002 | Stages may contain work, structured info, documents, evidence, assessments, risks, dependencies, approvals, decisions, comments/history, owners, completion criteria. | Confirmed |
| FR-LC-003 | Not every initiative must execute every stage; supported path examples include Pre-study→Project, with/without PoC and/or Pilot. | Confirmed |
| FR-LC-004 | Skipping stages shall be controlled and auditable (not silent status edits). | Confirmed |
| FR-LC-005 | Workflow configuration is a product direction; MVP may ship a constrained configurable subset. | Confirmed (direction) / FUT for full engine |

### 4.3 Demand / Idea

| ID | Statement | Class |
|---|---|---|
| FR-DEM-001 | Demand capture shall include at minimum: title, requesting department, requester, business owner, problem/opportunity, reason, expected value, affected users/areas, urgency, strategic alignment, initial impact, attachments/documents. | Confirmed |
| FR-DEM-002 | Demand shall be reviewable before progressing. | Confirmed |

### 4.4 Requirements Management

| ID | Statement | Class |
|---|---|---|
| FR-REQ-001 | Requirement Gathering shall support structured requirements (not one text blob). | Confirmed |
| FR-REQ-002 | Categories shall include Business, Functional, Non-functional, Architecture, Security, Integration, Data, Compliance, and other configurable categories. | Confirmed |
| FR-REQ-003 | Requirements shall support unique ID, title, description, type/category, priority, owner, source, status, acceptance criteria, relationships, approval/review state, traceability links. | Confirmed |
| FR-REQ-004 | Traceability path shall eventually support: Business Need → Requirement → Pre-study/PoC evidence → Project → Feature/work → PI → Delivery. | Confirmed (direction); MVP may implement a subset with model readiness |

### 4.5 Pre-study

| ID | Statement | Class |
|---|---|---|
| FR-PS-001 | Pre-study shall support management decision whether further investment is justified. | Confirmed |
| FR-PS-002 | Pre-study shall support analysis areas including business, current state, options, architecture/security/integration/data assessments, cost/resource estimates, risks. | Confirmed |
| FR-PS-003 | Alternatives comparison shall be extensible (examples: build, buy/use existing, alternative implementation, do nothing—not hardcoded permanent enum-only design). | Confirmed |

### 4.6 PoC

| ID | Statement | Class |
|---|---|---|
| FR-POC-001 | PoC answers: “Can this work and is the hypothesis supported by evidence?” | Confirmed |
| FR-POC-002 | PoC shall capture objective, hypothesis, scope, out of scope, success criteria, duration, cost, resources, dependencies, constraints, evidence, results, findings, risks, lessons learned. | Confirmed |
| FR-POC-003 | Success criteria shall be measurable where appropriate. | Confirmed |
| FR-POC-004 | A PoC shall not automatically decide its own outcome; outcome requires a Decision. | Confirmed |

### 4.7 Pilot

| ID | Statement | Class |
|---|---|---|
| FR-PIL-001 | Pilot is distinct from PoC and answers readiness-to-scale in limited real/production-like context. | Confirmed |
| FR-PIL-002 | Pilot shall support scope, site/area, users, resources, readiness dimensions, rollback considerations, success criteria, KPI/results, feedback, value/cost evidence, risks, lessons learned. | Confirmed |
| FR-PIL-003 | Pilot evaluation may produce extensible decision outcomes (examples: scale, extend, request changes, hold, stop). | Confirmed |

### 4.8 Decisions

| ID | Statement | Class |
|---|---|---|
| FR-DEC-001 | Decisions are first-class entities with identity, question, context, options, recommendation (optional), actual decision, rationale, conditions, authority, participants, evidence, relations, timestamps, history, supersession. | Confirmed |
| FR-DEC-002 | Recommendation ≠ Decision. | Confirmed |
| FR-DEC-003 | Decision history shall be auditable. | Confirmed |

### 4.9 Approvals / Governance

| ID | Statement | Class |
|---|---|---|
| FR-GOV-001 | Approvals are first-class records (not only `approved=true`). | Confirmed |
| FR-GOV-002 | Approval records capture subject, stage/gate, approver, required authority, status, requested/decision times, comments, version, outcome, conditions. | Confirmed |
| FR-GOV-003 | Outcomes include at least approved, rejected, changes requested (extensible). | Confirmed |
| FR-GOV-004 | Governance rules shall be designed as configurable (required and conditional approvers); specific org rules must not be hardcoded as permanent product logic. | Confirmed |

### 4.10 Documents & Evidence

| ID | Statement | Class |
|---|---|---|
| FR-DOC-001 | Initiatives have a Documentation Hub; documents are first-class with type, owner, version, lifecycle, approval status, dates, relationships, history. | Confirmed |
| FR-DOC-002 | Document lifecycle supports Draft → In Review → Changes Requested → Approved → Superseded. | Confirmed |
| FR-DOC-003 | Approved content must not silently change while retaining previous approval. | Confirmed |
| FR-EVD-001 | Gates shall support configurable evidence packages and completeness evaluation. | Confirmed (direction); constrained packages may ship in MVP |

### 4.11 Project / Portfolio

| ID | Statement | Class |
|---|---|---|
| FR-PRJ-001 | After governance, initiatives may become projects/rollouts with ownership, departments, budget/forecast/actual (where available), timeline, priority, status, milestones, work, risks, dependencies, resources, PI allocation, originating history. | Confirmed |
| FR-PRJ-002 | Conversion preserves history and traceability (no disconnected duplicate lifecycle). | Confirmed |

### 4.12 PI Planning, Capacity, Dependencies, Cost

| ID | Statement | Class |
|---|---|---|
| FR-PI-001 | PI Planning supports multi-department planning with PI definition, iterations, views, backlog, allocation, capacity, overload detection, dependencies, milestones, risks, conflicts, filters, overall/detail views, baselines. | Confirmed (direction); MVP subset defined in roadmap |
| FR-PI-002 | Moving planned work shall eventually recalculate relevant planning information. | Confirmed |
| FR-CAP-001 | Capacity supports team/resource capacity, availability, allocation, planned load, utilization, overload, under-allocation, timebox. | Confirmed |
| FR-CAP-002 | System shall identify planning problems (not only display numbers). | Confirmed |
| FR-DEP-001 | Dependencies are first-class with one source of truth across modules. | Confirmed |
| FR-COST-001 | Data model ready for estimated/approved/planned/actual/forecast/variance; full finance system is non-goal for MVP. | Confirmed |

### 4.13 Baselines, Audit, Executive Experience, Excel

| ID | Statement | Class |
|---|---|---|
| FR-BASE-001 | Planning/governance support draft, management review, approved baseline, and current/actual state concepts; approved baselines must be reproducible later. | Confirmed |
| FR-AUD-001 | Material actions (approvals, decisions, transitions, document approvals/versions, baselines, material planning changes, permission changes) are auditable with structured data sufficient for reporting. | Confirmed |
| FR-EXE-001 | Senior management cockpit prioritizes attention items and supports drill-down. | Confirmed |
| FR-XLS-001 | Future Excel import shall support detection, mapping, preview, validation, errors, reusable mappings. | Future (documented) |

---

## 5. Non-Functional Requirements

| ID | Statement | Class |
|---|---|---|
| NFR-SEC-001 | Authorization is enforced server-side; UI hiding is not sufficient. | Confirmed |
| NFR-SEC-002 | Authentication uses standards-based approaches. | Confirmed |
| NFR-AUD-001 | Audit records are append-oriented for material governance events. | Recommendation |
| NFR-PORT-001 | Application must be portable beyond initial Vercel deployment. | Confirmed |
| NFR-DATA-001 | No fake business data required for production operation. | Confirmed |
| NFR-DEV-001 | Local development should eventually support PostgreSQL via Docker. | Confirmed |
| NFR-I18N-001 | Internationalization requirements are Open. | Open |
| NFR-A11Y-001 | Accessibility target level is Open (recommend WCAG 2.2 AA as direction). | Recommendation / Open |

---

## 6. Architectural Requirements

| ID | Statement | Class |
|---|---|---|
| AR-001 | Prefer modular monolith with clear domain boundaries for v1. | Recommendation (strong) |
| AR-002 | Domain must not be tightly coupled to Vercel platform APIs. | Confirmed |
| AR-003 | Persistence should use PostgreSQL with typed access (Prisma or equivalent). | Recommendation |
| AR-004 | Domain modules should avoid a single unstructured CRUD surface. | Confirmed |
| AR-005 | Microservices are not required for first implementation. | Confirmed |

---

## 7. Acceptance Criteria (Phase 0 Documentation)

Phase 0 is accepted when:

1. All required `/docs` documents exist and are internally consistent.
2. PoC and Pilot are separately defined.
3. Recommendation and Decision are separately defined.
4. Approvals are modeled as auditable records.
5. Document version/approval semantics are specified.
6. Traceability approach is specified.
7. Multi-department PI Planning is specified.
8. Capacity problem detection is specified.
9. Executive attention model is specified.
10. No hardcoded business identities appear as product prerequisites.
11. Vercel is documented as deployment target only.
12. No application implementation was introduced in Phase 0.

---

## 8. Explicit Product Non-Goals (Overall)

- Hardcoding org-specific approval matrices into application source.
- Treating PoC success as automatic project approval.
- Silent stage skipping.
- Silent mutation of approved documents.
- Building a full accounting/ERP subsystem in MVP.
- Implementing Excel import in Phase 0/MVP unless explicitly promoted later.

---

## 9. Traceability to Other Docs

| Area | Primary doc |
|---|---|
| Entities | DOMAIN-MODEL |
| Stages | INITIATIVE-LIFECYCLE |
| Approvals | GOVERNANCE-AND-APPROVALS |
| Decisions | DECISION-MANAGEMENT |
| Documents | DOCUMENT-MANAGEMENT |
| PI/Capacity | PI-PLANNING-MODEL |
| Access | ROLES-AND-PERMISSIONS |
| UX | UX-PRINCIPLES |
| Tech | ARCHITECTURE |
| Scope cuts | MVP-ROADMAP |
