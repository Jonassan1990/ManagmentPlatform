# ADR-006: Immutable Approval and Decision Records

- Status: Accepted (Phase 3)
- Date: 2026-09-23

## Context

Approvals and governance decisions are control-plane outcomes. Allowing in-place mutation of an approval outcome or decision would undermine audit trails and confuse “recommendation” with “decision.” Re-review after rejection or changes must be explicit.

## Decision

- `ApprovalRecord` is insert-once per completed `ApprovalRequest`. Completed requests reject further `recordApproval` with `CONFLICT`.
- `DecisionRecord` is insert-once per submission. Outcome is chosen explicitly by an authorized principal; `DecisionPackage.recommendationText` is never auto-applied as outcome.
- Changes after `CHANGES_REQUESTED` / rejected paths require a new `GovernanceSubmission` revision (new requests and snapshot), not edits to prior records.

## Consequences

History is append-oriented. Workflow UX must guide revise → re-approve → decide. Conditional-Go conditions are separate mutable rows with their own status/version, not mutations of the decision outcome.
