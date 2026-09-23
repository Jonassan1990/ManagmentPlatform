# Deployment — Vercel Readiness

## Intent

Initial deployment target is **GitHub → Vercel**. Domain architecture is portable and must not import Vercel-specific APIs into business modules.

## Build

- Install: `npm install`
- Build: `prisma generate && next build` (see `vercel.json`)
- Start (non-Vercel): `npm start`

Prisma Client is generated via `postinstall` (`prisma generate`).

`next build` does **not** require OIDC secrets at build time (lazy `getAuthEnv` / build placeholder secret). Runtime SSO still requires full OIDC env.

## Required environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL (pooled OK for serverless) |
| `DIRECT_URL` | Yes | Direct URL for migrations; may equal `DATABASE_URL` locally |
| `NODE_ENV` | Yes (set by host) | `production` on Vercel |
| `APP_URL` / `AUTH_URL` | Recommended / required for OIDC | Public URL |
| `AUTH_SECRET` | Required when OIDC enabled | Session signing |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Required for SSO | Generic OIDC |
| `OIDC_SCOPES` | Optional | Default `openid profile email` |
| `BOOTSTRAP_SETUP_TOKEN` | For first admin only | One-time; see runbook |
| `ALLOW_DEV_AUTH` | Must be unset/false | Production fail-closed |
| `DEV_AUTH_PRINCIPAL_ID` | Must be unset | Not for production |

## Database

- Provision managed PostgreSQL (Neon, RDS, Cloud SQL, etc.).
- Run migrations before or during deploy:

```bash
npx prisma migrate deploy
```

Recommended approach:

1. Release step runs `prisma migrate deploy` against the target database using `DIRECT_URL`.
2. Vercel build runs `prisma generate` + `next build`.

Do not rely on `db push` in production.

## Auth in production

OIDC is implemented (Phase 6, ADR-018 / ADR-019). See [PRODUCTION-AUTH-RUNBOOK.md](./PRODUCTION-AUTH-RUNBOOK.md).

Until OIDC env is set:

- `/login` shows “authentication not configured”;
- mutating routes fail closed without a principal;
- DEV auth remains forbidden in production.

## Portability checklist

- Storage/auth/job adapters stay outside domain modules.
- No Vercel Blob / Edge-only assumptions in organization domain.
- App can run on other Node hosts with PostgreSQL.

## What this document does not claim

- No production database is provisioned automatically by the app.
- No production Vercel deploy is executed unless credentials/infrastructure are explicitly available.
