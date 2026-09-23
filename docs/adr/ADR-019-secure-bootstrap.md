# ADR-019: Secure One-Time Bootstrap Token

- Status: Accepted (Phase 6)
- Date: 2026-09-23

## Context

Empty-database bootstrap previously auto-granted `PLATFORM_BOOTSTRAP` to whichever principal first exercised authZ in DEV/test. That pattern must not apply to production OIDC — it would become first-login-is-admin.

## Decision

1. Production bootstrap requires a **one-time** environment secret `BOOTSTRAP_SETUP_TOKEN` (min 16 characters).
2. An **already authenticated** principal visits `/setup/bootstrap`, submits the token.
3. On success:
   - create `BootstrapConsumption` with unique `bootstrapKey = "default"`;
   - grant `PLATFORM_BOOTSTRAP` role binding at platform scope;
   - write an audit event (`identity.bootstrap.consume`).
4. Second consumption fails with conflict (unique key + service check). Invalid tokens are denied and audited.
5. `ensureBootstrapBinding` auto-grant remains **DEV/test only** (`isDevAuthEnabled` or `NODE_ENV=test`). Production OIDC never auto-grants.

## Consequences

- Operators must set and rotate/clear `BOOTSTRAP_SETUP_TOKEN` after use.
- First OIDC user is not automatically an admin.
- Bootstrap is auditable and non-reusable.
