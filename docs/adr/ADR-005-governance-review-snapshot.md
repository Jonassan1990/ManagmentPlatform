# ADR-005: Immutable Governance Review Snapshot

- Status: Accepted (Phase 3)
- Date: 2026-09-23

## Context

Governance reviewers and decision makers must see the same evidence that was submitted. If live workspace edits mutated the reviewed payload in place, approvals and decisions would drift from the evidence they claimed to cover. Revising after changes-requested must not erase prior review history.

## Decision

On each governance submit (and each revise), create a new `ReviewSnapshot` row with a frozen JSON payload of the workspace state for that revision. Bind `GovernanceSubmission`, `ApprovalRequest`, `ApprovalRecord`, and `DecisionRecord` to the snapshot id. Never update snapshot payload in place. Prior snapshots remain after supersession.

## Consequences

Auditability of “what was reviewed” is preserved. Storage grows with revisions (acceptable for MVP). UI and services must read the submission’s snapshot for review context rather than the live mutable workspace alone.
