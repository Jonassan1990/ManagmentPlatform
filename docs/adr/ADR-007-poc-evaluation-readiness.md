# ADR-007: Derived PoC Evaluation Readiness

- Status: Accepted (Phase 3)
- Date: 2026-09-23

## Context

PoC readiness for a governance decision must reflect evaluation evidence (criteria, results, findings) rather than a manually toggled flag. Persisting `ready=true` would drift from criteria evaluations and blur readiness with approval/decision.

## Decision

Compute PoC readiness in `poc-readiness-policy.ts` via `evaluatePoCReadiness` from PoC status, required criterion evaluation states, results, and findings. Do not store a ready boolean on `PoC` or `Initiative`. Definition completeness (`isPoCDefinitionComplete`) gates DRAFT→READY separately from decision readiness. PoC status advances only adjacent-forward.

## Consequences

UI and `submitPoCForGovernance` share one derivation. Attention items surface unevaluated required criteria. Phase 4+ can deepen Pilot/project conversion without rewriting readiness into flags.
