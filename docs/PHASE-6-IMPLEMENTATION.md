# Phase 6 Implementation — Production Identity & Deployment Foundation

**Branch:** `phase6-production-auth-deployment`  
**Status:** Implemented (auth code ready). Production deploy **blocked** without OIDC + managed Postgres credentials.

---

## Scope delivered

| Area | Outcome |
|---|---|
| Auth library | Auth.js (`next-auth` v5 beta) with generic OIDC provider (issuer-based) |
| Identity key | `ExternalIdentity` unique on `(issuer, subject)` — never email alone |
| JIT provisioning | Successful OIDC login creates `Principal` + `ExternalIdentity` with **no** role bindings |
| Secure bootstrap | One-time `BOOTSTRAP_SETUP_TOKEN` via `/setup/bootstrap` → `PLATFORM_BOOTSTRAP` + `BootstrapConsumption` |
| DEV auth | Unchanged local bridge; **impossible** in production (`getEnv` + `isDevAuthEnabled`) |
| Session | Auth.js JWT cookies: HttpOnly, Secure (prod), SameSite=lax — no tokens in localStorage |
| Postgres | `DATABASE_URL` (runtime) + `DIRECT_URL` (migrations) in Prisma datasource |
| UX | `/login`, `/access-not-configured`, `/setup/bootstrap`, shell sign-out |
| Vercel | `vercel.json` + deployment docs updated |

Explicitly **not** in this phase: Excel import, AI features, PI feature expansion, binary document uploads.

---

## Design decisions

See:

- [ADR-018-oidc-identity.md](./adr/ADR-018-oidc-identity.md)
- [ADR-019-secure-bootstrap.md](./adr/ADR-019-secure-bootstrap.md)
- [PRODUCTION-AUTH-RUNBOOK.md](./PRODUCTION-AUTH-RUNBOOK.md)

### Identity resolution order

`AuthorizationService.resolveCurrentPrincipal`:

1. Explicit override (tests)
2. DEV auth (development only)
3. OIDC session → `session.principalId` → `Principal`
4. `null` (fail closed)

### Auto-bootstrap gating

`ensureBootstrapBinding` auto-grants on empty DB **only** when DEV auth is enabled or `NODE_ENV=test`. Production OIDC must use the setup token — never first-login-is-admin.

---

## Schema

Migration: `20260923130000_phase6_production_auth`

- `ExternalIdentity` → `external_identities`
- `BootstrapConsumption` → `bootstrap_consumptions` (singleton `bootstrapKey='default'`)
- `Principal.email` optional display field
- `Principal.externalSubject` retained for DEV bridge (`dev:<uuid>`)

---

## Key files

| Path | Role |
|---|---|
| `src/server/env.ts` | Base env + lazy `getAuthEnv` / `isOidcConfigured` |
| `src/server/auth.ts` | Auth.js OIDC config + callbacks |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth routes |
| `src/modules/identity-access/application/identity-service.ts` | JIT + bootstrap |
| `src/middleware.ts` | Unauthenticated → `/login` |
| `src/app/login/page.tsx` | Sign-in UX |
| `src/app/setup/bootstrap/page.tsx` | Bootstrap token form |
| `src/app/access-not-configured/page.tsx` | Signed in, no bindings |

---

## Verification

```bash
npx prisma migrate deploy
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

---

## Deploy status

See [DEPLOYMENT-ACCEPTANCE.md](./DEPLOYMENT-ACCEPTANCE.md). Without production OIDC secrets + managed Postgres + deploy token usage, status is **NOT DEPLOYED / BLOCKED BY MISSING CREDENTIALS**.
