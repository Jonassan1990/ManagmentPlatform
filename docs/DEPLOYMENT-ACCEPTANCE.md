# Deployment Acceptance — Phase 5.5

**Branch:** `phase5.5-deployment-ux-acceptance`  
**Intent:** Record Vercel / managed Postgres readiness and explicitly state what was **not** deployed and why.

---

## 1. Vercel readiness

| Check | Result |
|---|---|
| `npm install` / `postinstall` → `prisma generate` | OK (Prisma Client generated on install) |
| `npm run build` (`next build`) | OK on this branch (`.next` present; prior Phase 5/5.5 builds known green) |
| Node host portability | Architecture does not import Vercel-only APIs into domain modules |
| Domain ↔ host coupling | Storage/auth adapters stay outside domain (see ARCHITECTURE.md) |

Prisma Client generation via `postinstall` is required for Vercel build. Prefer `prisma migrate deploy` as a **release step** against the target DB, not `db push`.

---

## 2. Managed Postgres requirements

| Requirement | Notes |
|---|---|
| `DATABASE_URL` | Required; PostgreSQL connection string |
| TLS | Use provider TLS (`sslmode=require` / equivalent) for managed instances |
| Pooling | Prefer pooled URL for serverless (e.g. Neon pooler / PgBouncer) for Next serverless functions; keep direct URL for migrations if provider splits them |
| Migrations | `npx prisma migrate deploy` before or during release |
| Docker on Vercel | **No** — local `docker-compose.yml` is for development only; production uses managed Postgres |

Local acceptance DB used for the journey:

```text
postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_acceptance?schema=public
```

---

## 3. AUTHENTICATION BLOCKED BY PRODUCTION AUTH

| Rule | Status |
|---|---|
| DEV auth in production | **Forbidden** — `env.ts` rejects `ALLOW_DEV_AUTH` when `NODE_ENV=production` |
| OIDC / SSO provider | **Not wired** — `resolveCurrentPrincipal` returns `null` outside DEV (ADR-002, OQ-10) |
| Missing principal | **Fail closed** — mutating routes unauthorized / redirect; overview shows auth EmptyState |

**Conclusion:** A production deploy without OIDC would boot the UI shell but **cannot** authenticate real users. Enabling DEV auth in production is explicitly disallowed and must not be used as a workaround.

---

## 4. Deployment NOT attempted

Production / Vercel deployment was **not** attempted in Phase 5.5 because:

1. **No `VERCEL_TOKEN`** (or equivalent CI deploy credentials) available in this environment.
2. **No managed production Postgres** provisioned for this acceptance pass.
3. **Auth is unsafe for production use** until OIDC is wired — fail-closed without a principal; DEV auth must not be enabled.

This document does **not** claim a live Vercel URL or production migration.

---

## 5. Recommended path (when unblocked)

1. Choose OIDC provider and close OQ-10; implement adapter in identity-access (replace DEV-only bridge for production).
2. Provision managed Postgres; set `DATABASE_URL` (+ pooler URL if needed); configure TLS.
3. Run `npx prisma migrate deploy` against production DB.
4. Configure Vercel env: `DATABASE_URL`, `APP_URL`, `NODE_ENV=production`; leave `ALLOW_DEV_AUTH` / `DEV_AUTH_*` unset.
5. Deploy via GitHub → Vercel (or portable Node host); smoke `/` for auth EmptyState then authenticated first-run.
6. Keep domain modules free of host-specific APIs.

Until step 1 lands, treat production deploy as **blocked**.

---

## 6. Related docs

- [DEPLOYMENT-VERCEL.md](./DEPLOYMENT-VERCEL.md) — portable Vercel checklist
- [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md) — Docker Postgres + DEV auth
- [adr/ADR-002-dev-auth-bridge.md](./adr/ADR-002-dev-auth-bridge.md) — DEV-only principal bridge
- [UX-ACCEPTANCE-REPORT.md](./UX-ACCEPTANCE-REPORT.md) — UX acceptance findings
- [PHASE-6-BACKLOG.md](./PHASE-6-BACKLOG.md) — Must Fix includes Production OIDC
