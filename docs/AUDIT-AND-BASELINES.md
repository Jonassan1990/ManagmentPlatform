# Audit and Baselines

**Status:** Confirmed conceptual requirements + recommendations  
**Related:** Governance, Decisions, Documents, PI Planning, Architecture

---

## 1. Purpose

Define auditability and baseline/snapshot semantics so history is reconstructable and approved states are reproducible.

---

## 2. Auditability — Confirmed Requirements

Important actions must be auditable, including at minimum:

- approval outcomes
- decisions (create, decide, supersede)
- workflow / stage transitions (including skips)
- document approval and version lifecycle changes
- baseline creation/approval
- material planning changes
- permission / role-binding changes

### Structured, not only text

Audit must store structured information sufficient for future reporting:

| Field | Purpose |
|---|---|
| Event ID | Unique |
| Timestamp | UTC |
| Actor principal ID | Who |
| Action type | Stable enum/code |
| Subject type + ID | What |
| Organization / scope IDs | Tenancy/scope |
| Correlation / request ID | Tie related writes |
| Payload | Structured before/after or denormalized facts |
| Result | success/denied/failure |

Unstructured messages may exist as display helpers but must not be the only store.

### Recommendation

Treat audit as append-oriented. Corrections are compensating events, not silent edits to history.

---

## 3. Baseline / Snapshot Model

### Confirmed conceptual states

| State | Meaning |
|---|---|
| Draft planning | Mutable working plan |
| Management Review | Candidate snapshot for review |
| Approved Baseline | Binding reproducible snapshot |
| Actual / current | Live state after/while executing |

### Confirmed rule

An approved baseline must be reproducible later. Today’s mutable state must not be the only historical record.

### What a planning baseline should capture (direction)

- PI identity and timebox structure
- participating departments
- allocations (work ↔ team/resource ↔ iteration + estimates)
- capacity figures used
- known conflicts at baseline time (optional snapshot)
- dependency set references/status at baseline time
- metadata: who approved, when, policy version

### Governance baselines (related)

Document versions, evidence package revisions, and decision sets referenced at a gate form a **governance evidence snapshot** that should be retained with the transition audit.

---

## 4. “What Changed?” Support

Executive and management views need deltas such as:

- new/removed allocations since baseline
- load/utilization changes causing new overloads
- newly critical dependencies
- cost forecast variance beyond threshold (**threshold Open**)
- initiatives that changed stage
- decisions made since date X

Exact diff UX is implementation detail; data model must enable it.

---

## 5. Material Planning Change

Not every keystroke needs a prominent audit entry. **Recommendation:**

- Always audit baseline approve/create.
- Audit allocation changes that cross thresholds (estimate delta, iteration move, team change) per configurable policy.
- Always audit dependency criticality/status changes for critical dependencies.

---

## 6. Edge Cases

| Case | Direction |
|---|---|
| Baseline approved then schema evolves | Store schema version with snapshot; migration readers must interpret |
| Partial PI baseline | Open; MVP may require whole-PI |
| Actor account deleted | Preserve actor ID + denormalized display name at event time |
| AuthZ denied attempts | Optionally audit (security); may be sampled — Open |

---

## 7. Non-Goals

- Replacing enterprise SIEM
- Guaranteeing legally certified WORM storage in MVP (may be Later requirement)

---

## 8. Acceptance Criteria

- Structured audit fields defined.
- Material action list covered.
- Baseline reproducibility required.
- Draft/review/approved/actual concepts defined.
- Diff/attention enablement acknowledged.
