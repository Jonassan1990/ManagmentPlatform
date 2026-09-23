# Management & PI Planning Platform

Phase 0 product foundation lives in [`/docs`](./docs).  
Implementation through **Phase 6** (production OIDC identity + secure bootstrap) is on branch `phase6-production-auth-deployment`.

## Quick start (local)

See [`docs/LOCAL-DEVELOPMENT.md`](./docs/LOCAL-DEVELOPMENT.md).

```bash
cp .env.example .env
# set DEV_AUTH_PRINCIPAL_ID to a generated UUID
# set DIRECT_URL to the same value as DATABASE_URL locally
docker compose up -d
npm install
npx prisma migrate deploy
npm run dev
```

## Documentation map

- [`docs/README.md`](./docs/README.md) — documentation index
- [`docs/PHASE-6-IMPLEMENTATION.md`](./docs/PHASE-6-IMPLEMENTATION.md) — production identity
- [`docs/PRODUCTION-AUTH-RUNBOOK.md`](./docs/PRODUCTION-AUTH-RUNBOOK.md) — operator OIDC + bootstrap
- [`docs/LOCAL-DEVELOPMENT.md`](./docs/LOCAL-DEVELOPMENT.md)
- [`docs/DEPLOYMENT-VERCEL.md`](./docs/DEPLOYMENT-VERCEL.md)
- [`docs/DEPLOYMENT-ACCEPTANCE.md`](./docs/DEPLOYMENT-ACCEPTANCE.md)

## Hard constraints

- No hardcoded business users, departments, teams, projects, or permissions
- Empty database is a valid starting state
- Identity key is OIDC `(issuer, subject)` — never email alone
- Production forbids `ALLOW_DEV_AUTH`
