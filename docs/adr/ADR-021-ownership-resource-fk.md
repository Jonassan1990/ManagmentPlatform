# ADR-021: Ownership via Resource FK + Name Snapshot

- Status: Accepted (Phase 0B)
- Date: 2026-10-08

## Context

Business ownership was stored primarily as free-text `*Name` fields. That prevented reliable queries such as “what does this person own?” and blocked future ownership-based authorization (Phase 0C). Platform actors (approvers, decision makers) were already correctly modeled as Principal FKs.

## Decision

1. **Business accountability** references `Resource` via nullable FKs (`businessOwnerResourceId`, `ownerResourceId`, etc.).
2. **Platform actors** remain Principal FKs (`approverPrincipalId`, `decisionMakerPrincipalId`, …).
3. Existing `*Name` columns remain as **snapshot / fallback** during the compatibility period.
4. When a Resource owner is selected, write both FK and name snapshot (`Resource.name`).
5. Reads prefer Resource display name when FK is set; otherwise fall back to snapshot text.
6. Eligible owners are `Resource.type = PERSON`, same organization, ACTIVE.
7. Resource need **not** have a linked Principal (staff without login may own work).
8. All new ownership FKs use `ON DELETE SET NULL`.

## Alternatives considered

- Owner as Principal only — rejected: excludes people without platform access.
- Destructive rename/removal of `*Name` — rejected: breaks legacy data and rollback.
- Automatic name→Resource backfill — rejected: names are not unique identity keys.

## Consequences

Structured ownership is queryable without forcing backfill. Phase 0C may later add ownership-based authZ using these FKs. Capacity math remains on Resource independently of ownership.

## Migration impact

Additive nullable FK columns + indexes. Legacy rows keep `*ResourceId = null` with historical `*Name` intact.
