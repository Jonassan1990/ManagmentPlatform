# Glossary

**Status:** Canonical terminology for Phase 0  
**Rule:** Prefer these terms in docs, UI copy, and future code names where practical

---

## A

**Allocation** — Assignment of work to a team/resource within a timebox/PI iteration.

**Approval** — First-class record in which an authorized principal records an outcome (approved / rejected / changes requested) for a specific subject version/gate. Not a boolean field alone.

**Attention item** — Something requiring management action (pending approval, decision, overload, blocker, missing evidence, etc.).

**Audit event** — Structured record of a material action for later reconstruction and reporting.

## B

**Baseline** — Immutable snapshot of planning and/or governance-relevant state that can be reproduced and compared later.

**Business Owner** — Accountable business principal for an initiative’s outcome (assignment, not a hardcoded person).

## C

**Capacity** — Available effort for a team/resource in a time period.

**Changes Requested** — Approval/document outcome indicating revision is required before approval.

**Conflict (planning)** — System-detected planning problem (e.g., overload, dependency timing issue).

## D

**Decision** — First-class record of an authorized choice among options, with rationale and history. Distinct from Recommendation.

**Demand / Idea** — Initial capture of a problem/opportunity requesting investment.

**Department** — Organizational unit under a Section containing teams, resources, and owned initiatives/projects.

**Dependency** — Canonical relationship between work/projects/org units with status, owner, needed-by, criticality, resolution.

**Documentation Hub** — Initiative-scoped canonical index of documents and versions.

## E

**Evidence / Evidence Package** — Structured set of artifacts required or optional for a gate; completeness can be evaluated.

**Executive cockpit** — Senior-manager view optimized for attention, portfolio health, and drill-down.

## G

**Gate** — Governance checkpoint controlling transition or binding action based on policy (evidence, approvals, decisions).

## I

**Initiative** — Enduring container for lifecycle history from demand through delivery linkage.

**Iteration / Timebox** — Subdivision of a PI used for planning and capacity.

## M

**Membership** — Association of a Resource to a Team/Department with effectivity.

**Milestone** — Canonical dated commitment/event linked across portfolio and planning views.

**Modular monolith** — Single deployable application with enforced internal domain module boundaries.

## O

**Organization** — Top-level boundary for configuration and data.

**Overload** — Planned load exceeds capacity (beyond configured threshold).

## P

**PI (Planning Increment)** — Cadence container for multi-department planning.

**Pilot** — Stage answering whether the solution works sufficiently in a limited real/production-like context and readiness to scale. Distinct from PoC.

**PoC (Proof of Concept)** — Stage answering whether something can work and whether a hypothesis is supported by evidence. Distinct from Pilot.

**Portfolio** — Cross-initiative/project management view of health, cost, risk, and progress.

**Pre-study** — Stage that assesses whether further investment is justified, including alternatives comparison.

**Principal** — Authenticated identity in the system.

**Project / Rollout** — Delivery vehicle after appropriate governance; preserves initiative history links.

## R

**Recommendation** — Non-binding suggested option supported by evidence. Never equivalent to Decision.

**Requirement** — Structured need statement with category, acceptance criteria, and traceability.

**Resource** — Capacity-bearing entity (often a person, but extensible).

**Role Binding** — Assignment of a Role Definition to a Principal within a Scope.

## S

**Scope (authorization)** — Boundary limiting a role binding (org/section/department/team/initiative/…).

**Section** — Organizational tier containing multiple departments that plan together.

**Stage / Stage Instance** — Rich lifecycle container (not merely a status string).

**Superseded** — Prior approved/decided record replaced by a newer authoritative record; retained for history.

## T

**Team** — Grouping of resources within a department.

**Traceability** — Ability to follow links from business need through requirements, evidence, project work, PI, and delivery.

## U

**Utilization** — Planned load divided by capacity for a period.

## V

**Version (document)** — Immutable document revision; approvals bind to versions.

---

## Terms to Avoid as Synonyms (Ambiguity Traps)

| Avoid saying… | Prefer… |
|---|---|
| “PoC/Pilot” as one thing | PoC **or** Pilot, explicitly |
| “Approved” meaning a Decision | Approval vs Decision explicitly |
| “Status updated to Project” | Governed transition / conversion with history |
| “The system decided” | Recommendation or policy check; humans Decide |
| “Attachment” as the only doc model | Document + Version in Documentation Hub |

---

## Open Terminology

- Exact customer-facing label for “Section” (may map to division/area) — **Open**
- Exact label for “Resource” if non-person capacity is first-class in UI — **Open**
