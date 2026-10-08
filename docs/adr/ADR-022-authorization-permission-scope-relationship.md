# ADR-022: Authorization = Permission + Scope + Relationship

- Status: Accepted (Phase 0C)
- Date: 2026-10-08

## Context

Authorization already used `Principal` → `RoleBinding` → `RoleDefinition.permissions` with `AuthScope` and `assertCan`. Two problems remained:

1. **PLATFORM bindings matched every requested scope** (universal wildcard), granting implicit business mutation authority far beyond platform administration.
2. **Child scopes incorrectly satisfied ancestor requests** (e.g. TEAM binding could satisfy ORGANIZATION), and descendant hierarchy was not verified from DB relationships.
3. Phase 0B structured Resource ownership was not yet usable for narrow self-management grants.

## Decision

Keep `RoleDefinition` / `RoleBinding` / `assertCan`. Authorization is:

```text
Permission + Scope (+ optional Ownership Relationship)
```

### PLATFORM

A PLATFORM binding satisfies **PLATFORM requests only**. It does not wildcard ORGANIZATION / SECTION / DEPARTMENT / TEAM mutations.

Platform Admin pack holds bootstrap, org create (PLATFORM-scoped manage), role management, audit read, and governance policy — not business delivery permissions.

### Bootstrap

Empty-state / token bootstrap still grants PLATFORM Platform Admin. Creating the first organization still calls `grantOrganizationAdmin`, which is the recoverable path into scoped business authority.

### Hierarchy

Ancestor bindings may satisfy descendant requests when Prisma relationships confirm containment. Child bindings never satisfy ancestor requests.

### Relationship

Only when `Resource.linkedPrincipalId == Principal.id` and the Resource is the business owner of the subject, and only for the allow-listed permissions:

- `initiative.view` / `initiative.edit`
- `project.view` / `project.edit`

Ownership never implies approval, decision, role management, or PI baseline authority.

## Alternatives rejected

- Generic ABAC engine
- Per-object ACL tables
- Hundreds of department-specific role definitions
- Keeping PLATFORM universal matching for compatibility

## Consequences

More precise authorization; increased security test surface; existing org-admin bootstrap path remains recoverable; Phase 0A/0B ownership and Principal≠Resource invariants unchanged.
