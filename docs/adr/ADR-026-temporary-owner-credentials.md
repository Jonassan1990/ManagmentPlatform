# ADR-026 — Temporary Single-Owner Credentials Authentication

**Status:** Accepted (temporary)  
**Phase:** Production Recovery P1  
**Date:** 2026-10-08

## Context

Production OIDC is not yet available. The platform must remain fail-closed for anonymous users, must not enable `ALLOW_DEV_AUTH` in production, and must preserve Principal / RoleBinding / AuthorizationService semantics. Operators need a minimal way for a single owner to authenticate until OIDC is wired.

## Decision

Add an Auth.js **Credentials** provider (`temp-credentials`) gated by complete environment configuration:

| Variable | Role |
|---|---|
| `AUTH_SECRET` | Session signing (≥16 chars) |
| `TEMP_AUTH_USERNAME` | Single allowed username |
| `TEMP_AUTH_PASSWORD_HASH` | bcrypt (or argon2-shaped) hash only — never plaintext |
| `TEMP_AUTH_PRINCIPAL_ID` | Stable Principal UUID |
| `TEMP_AUTH_DISPLAY_NAME` | Optional display label |

Partial or invalid config ⇒ **TEMP AUTH DISABLED** (provider not registered).

### Identity mapping

- Upsert `Principal` with id = `TEMP_AUTH_PRINCIPAL_ID`
- Upsert `ExternalIdentity` with  
  `issuer = urn:managmentplatform:temp-auth:v1`,  
  `subject = TEMP_AUTH_USERNAME`
- Conflicting Principal ↔ ExternalIdentity bindings fail closed
- Email is never the identity key; no automatic Resource link

### Session

Existing Auth.js JWT: `principalId` only, maxAge **8 hours**, production `__Secure-` httpOnly cookie. No roles/permissions in the token.

### Authorization

Unchanged. Login ≠ admin. Zero RoleBindings → `/access-not-configured` → existing `BOOTSTRAP_SETUP_TOKEN` one-time flow (ADR-019).

### DEV auth

Separate path. Production continues to coerce `ALLOW_DEV_AUTH` off. Temp credentials never call the DEV bridge.

### Rate limiting

Best-effort in-process failure throttle + short delay. Not globally reliable on multi-instance serverless — documented limitation for this temporary control.

## Consequences

- Owner can recover production without OIDC.
- OIDC provider remains intact and is the long-term target.
- No Prisma schema / migration.
- Temporary architectural surface; must be removed after OIDC.

## Removal path

1. Configure and verify OIDC login.
2. Confirm RoleBindings on the intended Principal (same or linked).
3. Remove `TEMP_AUTH_*` from Vercel Production.
4. Remove Credentials provider + login form branch.
5. Retain historical Principal / ExternalIdentity / audit as needed.

## Risks

Shared password is high-value; protect Vercel env access; rotate hash by replacing `TEMP_AUTH_PASSWORD_HASH`; do not leave temp auth enabled after OIDC works.
