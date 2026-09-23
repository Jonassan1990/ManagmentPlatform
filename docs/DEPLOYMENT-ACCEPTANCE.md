# Deployment Acceptance — Phase 6

**Branch:** `phase6-production-auth-deployment`  
**Intent:** Record production identity readiness and explicit deploy status.

---

## 1. Vercel readiness

| Check | Result |
|---|---|
| `npm install` / `postinstall` → `prisma generate` | OK |
| `vercel.json` build command | `prisma generate && next build` |
| Node host portability | No Vercel-only APIs in domain modules |
| Build without OIDC secrets | Supported (lazy auth env) |

---

## 2. Managed Postgres requirements

| Requirement | Notes |
|---|---|
| `DATABASE_URL` | Runtime (pooled OK) |
| `DIRECT_URL` | Migrations / Prisma `directUrl` |
| TLS | Provider TLS for managed instances |
| Migrations | `npx prisma migrate deploy` (includes `20260923130000_phase6_production_auth`) |

---

## 3. Authentication (Phase 6)

| Rule | Status |
|---|---|
| DEV auth in production | **Forbidden** — `getEnv` rejects; `isDevAuthEnabled` false |
| OIDC / Auth.js | **Implemented** — generic issuer-based provider |
| JIT Principal | **Least privilege** — no default role bindings |
| Bootstrap | **One-time token** — never first-login-is-admin |
| Session cookies | HttpOnly + Secure (prod) + SameSite |

Without OIDC env vars configured on the host, login shows “authentication not configured” and mutating routes fail closed.

---

## 4. Deployment status

**NOT DEPLOYED / BLOCKED BY MISSING CREDENTIALS**

Production / Vercel deployment was **not** completed in this environment because:

1. **No production OIDC IdP credentials** (`OIDC_ISSUER` / client id / secret / `AUTH_SECRET`) were available — SSO cannot be configured.
2. **No managed production Postgres** was provisioned for a live target (local Docker only; `DATABASE_URL` points at localhost).
3. A Vercel API token may be present in the agent environment, but deploying without OIDC + production DB would ship an auth-incomplete system. Phase 6 policy: deploy only when real auth + DB credentials exist.

Auth **code** is ready; operators follow [PRODUCTION-AUTH-RUNBOOK.md](./PRODUCTION-AUTH-RUNBOOK.md) when credentials are available.

---

## 5. Recommended path (when unblocked)

1. Provision managed Postgres; set `DATABASE_URL` + `DIRECT_URL`.
2. Run `npx prisma migrate deploy`.
3. Configure OIDC + `AUTH_SECRET` + `APP_URL`/`AUTH_URL` on Vercel.
4. Set `BOOTSTRAP_SETUP_TOKEN` for the first operator.
5. Deploy; complete `/login` → `/setup/bootstrap`.
6. Leave `ALLOW_DEV_AUTH` unset.

---

## 6. Related docs

- [PHASE-6-IMPLEMENTATION.md](./PHASE-6-IMPLEMENTATION.md)
- [PRODUCTION-AUTH-RUNBOOK.md](./PRODUCTION-AUTH-RUNBOOK.md)
- [DEPLOYMENT-VERCEL.md](./DEPLOYMENT-VERCEL.md)
- [adr/ADR-018-oidc-identity.md](./adr/ADR-018-oidc-identity.md)
- [adr/ADR-019-secure-bootstrap.md](./adr/ADR-019-secure-bootstrap.md)
