# ADR-018: OIDC Identity with Auth.js (issuer + subject)

- Status: Accepted (Phase 6)
- Date: 2026-09-23

## Context

Phase 5.5 confirmed production cannot use the DEV auth bridge. OQ-10 left the IdP open. The platform needs a provider-neutral production identity path that:

- does not hardcode emails or personal identities;
- supports JIT account creation without elevating privilege;
- keeps session secrets out of browser storage;
- allows `next build` on Vercel without requiring IdP secrets at build time.

## Decision

1. Use **Auth.js / `next-auth` v5** with a **generic OIDC provider** configured via `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`.
2. Persist linked identities as `ExternalIdentity` with uniqueness on **`(issuer, subject)`**. Email is display-only (`emailSnapshot` / `Principal.email`).
3. On successful OIDC sign-in, **JIT-create** `Principal` + `ExternalIdentity` with **zero role bindings**.
4. Session strategy: **JWT** with HttpOnly cookies (Secure in production, SameSite=lax). JWT carries `principalId` only — never role bindings or access tokens in localStorage.
5. Validate OIDC secrets lazily via `getAuthEnv()` / `isOidcConfigured()` so builds succeed when secrets are absent; mutating routes remain fail-closed.
6. Keep the DEV bridge (`ADR-002`) for local development; production continues to forbid `ALLOW_DEV_AUTH`.

## Consequences

- Any standards-compliant OIDC IdP can be wired without code changes beyond env.
- Signed-in users without bindings land on `/access-not-configured` until bootstrap or an admin grants roles.
- Authorization remains DB-backed (`RoleBinding`) and is re-checked on every `assertCan`.
