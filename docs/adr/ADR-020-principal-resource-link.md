# ADR-020: Principal ↔ Resource Optional Link

- Status: Accepted (Phase 0A)
- Date: 2026-10-08

## Context

Authentication identity (`Principal` / OIDC `ExternalIdentity`) and capacity-bearing organization entities (`Resource`) were correctly modeled as separate concepts, but had no bridge. Without a link, the platform cannot associate a login with a planning person while preserving service accounts, staff without platform access, and OTHER (non-person) capacity resources.

## Decision

Add optional `Resource.linkedPrincipalId → Principal.id`:

- nullable;
- unique when populated (0..1 both directions);
- referential action `ON DELETE SET NULL` so Principal deletion/deactivation never deletes Resource, memberships, capacity, or allocation history;
- linking allowed only for `ResourceType.PERSON` (not OTHER);
- capacity math continues to use Resource fields only — the link does not participate in utilization.

Invariant: **Principal ≠ Resource**.

## Alternatives considered

1. **Merge Principal into Resource** — rejected: breaks service accounts, OIDC JIT least privilege, and OTHER capacity entities.
2. **Require Principal for every Resource** — rejected: blocks staff without login.
3. **Many-to-many link table** — rejected for v1: product requires at most one login per person resource.

## Consequences

- Resource-only people and Principal-only accounts remain valid.
- Admins can link/unlink via organization structure manage permission.
- Phase 0B ownership FKs can later point at Resource without forcing login.
- Email is never used as the identity key; OIDC remains `(issuer, subject)`.

## Migration impact

Additive nullable column + unique index + FK. No backfill. Existing rows keep `linked_principal_id = NULL`. Rollback: drop FK, index, and column.
