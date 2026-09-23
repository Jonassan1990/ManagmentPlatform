# ADR-010: Project Conversion & Traceability

- Status: Accepted (Phase 4)
- Date: 2026-09-23

## Context

Scaling a Pilot must not fork Initiative identity or lose prior PoC/Pilot/decision history. Concurrent or repeated conversion must be safe. Project delivery artifacts (budget, milestones, work items) attach to the same Initiative lineage.

## Decision

`convertToProject` creates a `Project` with unique `initiativeId` (duplicate → `CONFLICT`, including concurrent P2002). Conversion requires `SCALE` or `CONDITIONAL_SCALE` with blocking conditions resolved and current stage PILOT. Lifecycle transition PILOT→PROJECT is recorded with audit. Traceability is read via `getTraceability` (Initiative → PoC → Pilot → Project + decisions + transitions). Budget uses Decimal columns; work items support parent hierarchy.

## Consequences

One Initiative remains the durable root through delivery. Idempotent conversion prevents double Projects. Downstream PI Planning can hang work items off the same Project without re-keying history.
