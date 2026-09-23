# ADR-009: Pilot Scale Decision Outcomes

- Status: Accepted (Phase 4)
- Date: 2026-09-23

## Context

Post-Pilot governance must support scale, conditional scale, extend, hold, and stop without auto-creating Projects or destroying Pilot history. Recommendation text must stay informational and never become the binding outcome.

## Decision

Reuse immutable `DecisionRecord` with Pilot-gate outcomes: `SCALE`, `CONDITIONAL_SCALE`, `EXTEND_PILOT`, `STOP`, `HOLD`.

- `CONDITIONAL_SCALE` requires ≥1 `DecisionCondition`; blocking open conditions gate `convertToProject`.
- `EXTEND_PILOT` requires extension payload; creates `PilotExtension` and updates planned end; stage stays PILOT; criteria/results history retained.
- `STOP` / `HOLD` update Initiative status; conversion remains blocked.
- Package `recommendationText` is never auto-copied into `outcome`.
- SCALE does not auto-create Project — conversion is a separate authorized action.

## Consequences

Decision auditability matches Phase 3. Extend preserves evaluation history for later re-submission. Product UI can present recommendation beside outcome without conflating them.
