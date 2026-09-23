# ADR-016: PI Baseline Snapshot

- Status: Accepted (Phase 5)
- Date: 2026-09-23

## Context

Approved / reviewed planning states must be reproducible later. Mutating today’s board must not rewrite history. Partial baseline approval remains Open; MVP baselines the whole PI.

## Decision

`PiBaseline` stores an immutable JSON `payload` (schemaVersion 1) capturing PI meta, CURRENT revision id, iterations, allocations, participation, and dependencies at capture time. Rows are never updated — rebaseline inserts `versionNumber + 1`. First baseline requires status `REVIEW` and transitions the PI to `BASELINED`. `getChangesSince` diffs live CURRENT vs a chosen baseline without altering the stored payload.

## Consequences

Auditors can reconstruct the baselined plan from `payload` alone. Live CURRENT remains editable; “dirty vs baseline” is derived. Scenario revisions can later be baselined by capturing a non-CURRENT revision id into `revisionIdCaptured`.
