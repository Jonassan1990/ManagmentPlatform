# Management & PI Planning Platform

Phase 0 product foundation lives in [`/docs`](./docs).  
Phase 1 technical foundation + Organization vertical slice is implemented on branch `phase1-technical-foundation`.

## Quick start (Phase 1)

See [`docs/LOCAL-DEVELOPMENT.md`](./docs/LOCAL-DEVELOPMENT.md).

```bash
cp .env.example .env
# set DEV_AUTH_PRINCIPAL_ID to a generated UUID
docker compose up -d
npm install
npx prisma migrate deploy
npm run dev
```

## Documentation map

- [`docs/README.md`](./docs/README.md) — Phase 0 index
- [`docs/PHASE-1-IMPLEMENTATION.md`](./docs/PHASE-1-IMPLEMENTATION.md) — Phase 1 decisions
- [`docs/LOCAL-DEVELOPMENT.md`](./docs/LOCAL-DEVELOPMENT.md)
- [`docs/DEPLOYMENT-VERCEL.md`](./docs/DEPLOYMENT-VERCEL.md)

## Hard constraints

- No hardcoded business users, departments, teams, projects, or permissions
- Empty database is a valid starting state
- Phase 2+ domains are not implemented yet
