# ADR-027: PI Plan Approval Bound to CURRENT Fingerprint

- Status: Accepted (M3D-C)
- Date: 2026-10-09

## Context

M3D-A selection and M3D-B promotion are explicitly non-approval. Existing `PiBaseline` is an immutable snapshot under `PI_BASELINE`, but product requires a separate **Approve CURRENT plan** step before baseline so approval cannot silently apply to a later-edited CURRENT. Governance `DecisionRecord` models initiative gate decisions and must not be overloaded.

## Decision

Introduce additive `PiPlanApproval` rows that bind:

- PI + CURRENT revision id/version
- Allocation fingerprint (SHA-256)
- Promotion provenance
- Approver, timestamp, readiness evidence

Statuses: `VALID` → (`INVALIDATED` on CURRENT mutation/re-promote) or `CONSUMED` when a `PiBaseline` is created from that exact state. At most one `VALID` approval per PI (partial unique index). `createBaseline` requires a matching `VALID` approval and links `PiBaseline.planApprovalId`.

## Consequences

Approval and baseline remain separate authorized actions (`PI_REVIEW` vs `PI_BASELINE`). Historical approvals and baselines stay immutable. Portfolio continues to read live CURRENT only. Existing Governance DecisionRecord lifecycle is unchanged.
