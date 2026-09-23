# ADR-004: Derived Pre-study Readiness Policy

- Status: Accepted (Phase 2)
- Date: 2026-09-23

## Context

Managers need to know whether a Pre-study can be submitted for governance review. Persisting `ready=true` would drift from actual evidence and confuse readiness with approval.

## Decision

Compute readiness in `readiness-policy.ts` from assessments, requirements, alternatives, demand, and risks. Do not store a manual ready flag. Keep readiness ≠ approval.

## Consequences

UI displays derived status. Phase 3 can replace the default policy with configurable evidence packages without rewriting Initiative rows.
