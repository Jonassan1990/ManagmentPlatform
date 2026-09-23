# Deployment — Vercel Readiness

## Intent

Initial deployment target is **GitHub → Vercel**. Domain architecture is portable and must not import Vercel-specific APIs into business modules.

## Build

- Install: `npm install`
- Build: `next build` (`npm run build`)
- Start (non-Vercel): `npm start`

Prisma Client is generated via `postinstall` (`prisma generate`).

## Required environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NODE_ENV` | Yes (set by host) | `production` on Vercel |
| `APP_URL` | Recommended | Public URL |
| `ALLOW_DEV_AUTH` | Must be unset/false | Production fail-closed |
| `DEV_AUTH_PRINCIPAL_ID` | Must be unset | Not for production |

## Database

- Provision an external PostgreSQL instance (Neon, RDS, Cloud SQL, etc.).
- Run migrations before or during deploy:

```bash
npx prisma migrate deploy
```

Recommended approach:

1. CI/CD or release step runs `prisma migrate deploy` against the target database.
2. Vercel build runs `prisma generate` + `next build`.

Do not rely on `db push` in production.

## Auth in production (current limitation)

OIDC provider is still an open decision (Phase 0 OQ-10).

Until a provider is wired:

- production has **no** DEV auth bridge;
- mutating routes fail closed without a principal;
- do not invent a hardcoded production identity.

## Portability checklist

- Storage/auth/job adapters stay outside domain modules.
- No Vercel Blob / Edge-only assumptions in organization domain.
- App can run on other Node hosts with PostgreSQL.

## What this document does not claim

- No production database was provisioned by Phase 1.
- No production Vercel deploy was executed unless credentials/infrastructure are explicitly available.
