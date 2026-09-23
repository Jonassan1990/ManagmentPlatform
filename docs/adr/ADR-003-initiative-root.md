# ADR-003: Initiative as Durable Lifecycle Root

- Status: Accepted (Phase 2)
- Date: 2026-09-23

## Context

Phase 0 requires Demand → … → Delivery without losing history. Treating Demand/PoC/Pilot/Project as disconnected apps would break traceability.

## Decision

`Initiative` is the durable aggregate root. Stage data (Demand, Requirements, Pre-study, future PoC/Pilot/Project) attaches to the same Initiative identity.

## Consequences

Lifecycle transitions mutate `currentStage` and append history; they do not copy the initiative.
