# ADR-002: DEV-Only Auth Bridge Until OIDC

- Status: Accepted (Phase 1)
- Date: 2026-09-23

## Context

Final authentication provider is open (OQ-10). Phase 1 still needs authenticated principals for server-side authZ and first-run bootstrap testing.

## Decision

Provide a DEV-only principal resolver gated by **all** of:

1. `NODE_ENV === "development"`
2. `ALLOW_DEV_AUTH === true`
3. `DEV_AUTH_PRINCIPAL_ID` is a UUID supplied by the developer environment

Production forbids `ALLOW_DEV_AUTH`. Missing principal → fail closed.

## Consequences

- No hardcoded email/user in source.
- Local workflows work without inventing an IdP.
- Production remains blocked on mutating paths until OIDC is connected.
