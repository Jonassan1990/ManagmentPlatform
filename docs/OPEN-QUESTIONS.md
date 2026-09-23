# Open Questions and Assumptions

**Status:** Living log for Phase 0  
**Rule:** Do not silently convert assumptions into requirements

---

## 1. Purpose

Track unresolved questions and explicitly labeled assumptions so implementation phases do not invent silent product truth.

---

## 2. Classification

| Label | Meaning |
|---|---|
| **Open** | Needs stakeholder answer |
| **Assumption** | Temporary working belief for design continuity; must be revalidated |
| **Resolved** | Move to requirements/docs and date the resolution |

---

## 3. Open Questions

### Organization & tenancy

| ID | Question |
|---|---|
| OQ-01 | Is v1 single-organization deployment or multi-tenant SaaS? |
| OQ-02 | Can nested Sections exist, or is a single Section tier fixed? |
| OQ-03 | May a Resource belong to multiple Teams concurrently? |
| OQ-04 | What customer-facing label maps to “Section”? |

### Identity & access

| ID | Question |
|---|---|
| OQ-10 | Which standards-based auth provider/constraints apply (OIDC vendor, SSO mandates)? |
| OQ-11 | Exact first-run bootstrap admin process for empty system? |
| OQ-12 | Are multi-approver quorum policies required in MVP? |
| OQ-13 | Approver reassignment rules when role membership changes mid-pending? |

### Lifecycle

| ID | Question |
|---|---|
| OQ-20 | Can PoC and Pilot run in parallel for one initiative in v1, or sequential only? |
| OQ-21 | How should “project already started, new PoC needed” be modeled (child initiative vs reopen)? |
| OQ-22 | How early may initiatives appear in PI backlogs before Project conversion? |
| OQ-23 | Is Pilot required in the first production happy path, or is PoC→Project primary? |

### Governance

| ID | Question |
|---|---|
| OQ-30 | Are advisory (non-blocking) gates needed in MVP? |
| OQ-31 | How to resolve Decision vs Approval contradictions if both exist? |
| OQ-32 | Is “Approved with conditions” an MVP outcome? |
| OQ-33 | External approvers without login needed? |

### Documents & storage

| ID | Question |
|---|---|
| OQ-40 | Document version labeling scheme? |
| OQ-41 | Local/prod object storage choices? |
| OQ-42 | Max file sizes / types? |
| OQ-43 | Editorial correction policy for approved docs (typo path)? |

### Planning & capacity

| ID | Question |
|---|---|
| OQ-50 | Under-allocation detection in MVP or Next? |
| OQ-51 | Work spanning multiple iterations—model choice? |
| OQ-52 | Partial PI baseline approval allowed? |
| OQ-53 | Minimum departments for first production PI? |

### Cost & reporting

| ID | Question |
|---|---|
| OQ-60 | Multi-currency required? |
| OQ-61 | Variance thresholds for attention items? |
| OQ-62 | Notification channels (email/Teams/Slack)? |

### Non-functional

| ID | Question |
|---|---|
| OQ-70 | Accessibility target (recommend WCAG 2.2 AA)? |
| OQ-71 | Internationalization required for v1? |
| OQ-72 | Data residency constraints? |

### Excel

| ID | Question |
|---|---|
| OQ-80 | First import workbook kinds priority order? |
| OQ-81 | Export round-trip required with import v1? |

---

## 4. Explicit Assumptions (Working)

| ID | Assumption | Risk if wrong |
|---|---|---|
| AS-01 | v1 can start as single Organization per deployment with org_id still present in schema | Multi-tenant features deferred costly later |
| AS-02 | Sequential stage progression is enough for MVP (no parallel PoC/Pilot) | Model redesign for parallel stages |
| AS-03 | Modular monolith on Next.js + PostgreSQL is acceptable ops model | Hosting constraints force split earlier |
| AS-04 | Object storage is available in each environment via portable adapter | Feature slips for documents |
| AS-05 | Default governance template at bootstrap is acceptable if fully editable | Customers may reject any default policy |
| AS-06 | English-only UI acceptable for first release | i18n retrofit |
| AS-07 | Drag-and-drop can be Next while MVP allows manual allocation edits | UX dissatisfaction in planning pilots |
| AS-08 | Soft-archive preferred over hard delete for governance entities | Storage growth / GDPR deletion process needs refinement |

---

## 5. Change Log

| Date | Change |
|---|---|
| Phase 0 creation | Initial open questions and assumptions recorded |
| Phase 1 | OQ-03 technically unblocked via explicit `ResourceMembership` (multi-membership supported in schema; product policy still open). OQ-02 treated as non-nested Sections for Phase 1. DEV auth bridge documented for OQ-10 interim. |

When questions resolve, update this file and the owning requirements document in the same change set.
