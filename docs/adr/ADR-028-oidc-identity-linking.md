# ADR-028: Explicit OIDC Identity Linking (no email merge)

- Status: Accepted (R1-B)
- Date: 2026-10-10

## Context

OIDC JIT provisioning (ADR-018) creates a new `Principal` per `(issuer, subject)` with zero RoleBindings. The temporary owner Principal (ADR-026) already holds bootstrap RoleBindings and audit history. Auto-merging OIDC users onto that Principal by email or display name would be unsafe and could attach unrelated IdP subjects to privileged accounts.

## Decision

1. **No automatic merge** by email, display name, or username across OIDC and temporary-auth issuers.
2. Provide an **explicit, auditable** `linkOidcIdentityToPrincipal` operation:
   - Requires actor `ROLE_MANAGE` at **PLATFORM** scope.
   - Requires `confirmExplicitLink: true`.
   - Identity key remains `(issuer, subject)` only.
   - Fails closed on conflicts (subject already on another Principal; Principal already has a different subject for the same issuer).
   - Does **not** grant RoleBindings.
   - Does **not** delete or rewrite `TEMP_AUTH` ExternalIdentity rows.
3. Alternative cutover without linking: assign RoleBindings to the new OIDC Principal via existing access UI, leaving the temporary Principal intact until TEMP_AUTH removal.
4. TEMP_AUTH credentials stay until Production OIDC is verified for an intended administrator; removal is a separate controlled change.

## Consequences

- Operators can preserve Principal continuity for the owner during SSO cutover.
- Accidental privilege inheritance via email collision is prevented.
- UI: `/setup/link-oidc` for PLATFORM admins.
