# ADR-001: Explicit Resource Membership

- Status: Accepted (Phase 1)
- Date: 2026-09-23

## Context

Phase 0 left open whether a Resource may belong to multiple teams (OQ-03). Embedding a single `teamId` on Resource would block multi-team membership later.

## Decision

Model membership as `ResourceMembership` (resourceId, teamId, isPrimary, effectiveFrom/To).

## Consequences

- Phase 1 can assign zero or more memberships.
- Future capacity allocation can hang off membership without schema rewrite.
- Queries for “resources on a team” go through membership.
