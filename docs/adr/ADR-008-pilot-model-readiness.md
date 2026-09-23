# ADR-008: Pilot Model & Derived Readiness

- Status: Accepted (Phase 4)
- Date: 2026-09-23

## Context

Pilot must remain distinct from PoC: it answers operational scale readiness in a limited real/production-like context. Persisting a `ready` boolean would drift from criteria evaluations and operational definition fields, and would blur start readiness with governance readiness.

## Decision

Model Pilot as a first-class aggregate (`Pilot`, `PilotCriterion`, `PilotFeedback`, `PilotExtension`) on Initiative. Derive readiness in `pilot-readiness-policy.ts`:

- `isPilotDefinitionComplete` — operational definition for DRAFT→READY
- `evaluatePilotStartReadiness` — READY→IN_PROGRESS
- `evaluatePilotGovernanceReadiness` — submit for Pilot-gate decision

Status advances only adjacent-forward. Do not store a ready flag on Pilot or Initiative.

## Consequences

UI, attention, and `submitPilotForGovernance` share one derivation. PoC and Pilot remain separate entities and evidence shapes. Phase 5+ can deepen Pilot multi-site orchestration without rewriting readiness into toggles.
