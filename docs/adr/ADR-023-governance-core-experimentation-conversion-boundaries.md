# ADR-023: Governance Core vs Experimentation vs Project Conversion Boundaries

- Status: Accepted (Phase 1B)
- Date: 2026-10-08
- Supersedes: n/a (implements Phase 1A proposed split in `GOVERNANCE-BEHAVIOR-CONTRACT.md`)

## Context

`GovernanceService` grew into a ~2700-line application god-class owning:

- governance gates / submissions / snapshots / approvals / decisions / policy
- PoC operational lifecycle
- Pilot operational lifecycle
- Initiative → Project conversion orchestration
- inbox / workspace queries

Phase 1A locked AS-IS observable behavior. Phase 1B must extract clear module/service boundaries **without** schema, feature, or behavior change.

The repository already uses a facade + child services pattern in PI Planning (`PlanningService`).

## Decision

Keep logical Experimentation under the `governance` module for Phase 1B (no new top-level `experimentation` package yet) to minimize import churn and match Planning’s colocated child services.

```text
src/modules/governance/application/
  governance-service.ts              # thin compatibility facade
  governance-core-service.ts         # Core writes + governance queries
  poc-service.ts                     # PoC operational lifecycle
  pilot-service.ts                   # Pilot operational lifecycle
  project-conversion-service.ts      # Initiative → Project conversion
  governance-utils.ts                # shared parse / version / outcome helpers
  *-readiness-policy.ts / snapshot-builder / approval-policy / …
```

### Boundaries

| Service | Owns |
|---|---|
| `GovernanceCoreService` | Gate, Submission, ReviewSnapshot, Evidence, Approval*, Decision*, policy templates, submit*/revise, governance queries |
| `PoCService` | create/update/transition PoC, criteria, evaluation, results |
| `PilotService` | create/update/transition Pilot, criteria, evaluation, results, feedback |
| `ProjectConversionService` | `convertToProject` orchestration (prerequisites, create Project, stage transition, audit) |
| `GovernanceService` | Public signature facade; constructs children; no duplicated business logic |

### Dependency direction

```text
Server Actions / InitiativeService
        → GovernanceService (facade)
              → GovernanceCoreService
              → PoCService
              → PilotService
              → ProjectConversionService
        → readiness / snapshot / ownership (leaves)
```

Children **must not** import the facade. Children do not import each other. Core may write Pilot rows on `EXTEND_PILOT` via Prisma (AS-IS) without calling `PilotService`.

### Compatibility

Public method signatures on `GovernanceService` are preserved. Container and Server Actions continue to use the facade only.

### Explicit non-changes

- No Prisma schema / migration changes
- No authorization or ownership semantics changes
- No transaction redesign; audit remains post-commit (known debt)
- No automatic PoC/Pilot/Project creation after GO/SCALE
- Recommendation ≠ decision remains unchanged

## Consequences

- Facade shrinks to ~140 LOC of delegates; business logic lives in focused services.
- Future Phase 1C+ can move PoC/Pilot into a physical `experimentation` module without changing behavior if import edges stay acyclic.
- Callers may later depend on child services directly; until then the facade is the supported entry point.

## Alternatives considered

1. **Physical `src/modules/experimentation` in 1B** — deferred to avoid large path/import churn while behavior is locked.
2. **Move conversion into `ProjectService`** — rejected for 1B; conversion is governance-orchestrated and prerequisite-heavy; ProjectService remains post-existence CRUD.
3. **Rewrite during extract** — rejected; move proven logic only.
