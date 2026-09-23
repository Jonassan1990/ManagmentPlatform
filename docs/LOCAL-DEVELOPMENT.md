# Local Development

## Prerequisites

- Node.js 22+
- npm
- Docker + Docker Compose

## 1. Clone and install

```bash
git clone https://github.com/Jonassan1990/ManagmentPlatform.git
cd ManagmentPlatform
git checkout phase1-technical-foundation
npm install
```

## 2. Environment

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomUUID())"
```

Put the generated UUID into `.env` as `DEV_AUTH_PRINCIPAL_ID`.

Required local values:

```env
NODE_ENV=development
DATABASE_URL=postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public
DIRECT_URL=postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public
ALLOW_DEV_AUTH=true
DEV_AUTH_PRINCIPAL_ID=<your-generated-uuid>
DEV_AUTH_DISPLAY_NAME=Local Developer
```

`DIRECT_URL` is required by the Prisma schema for migrations; locally set it equal to `DATABASE_URL`.

Do not use a personal email as an identity key.

Optional production auth vars (not needed for local DEV bridge) are documented in `.env.example` and [PRODUCTION-AUTH-RUNBOOK.md](./PRODUCTION-AUTH-RUNBOOK.md).

## 3. Start PostgreSQL

```bash
docker compose up -d
```

Health check:

```bash
docker compose exec postgres pg_isready -U mgmt -d management_platform
```

## 4. Migrate

```bash
npx prisma migrate deploy
# or during schema development:
npx prisma migrate dev
```

## 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Expected first-run path:

1. Overview indicates no organization configured.
2. Use **Set up organization**.
3. Create sections → departments → teams → resources.

No fake business records are required.

## 6. Tests

```bash
npm run test                 # unit
npm run test:integration     # requires Docker PostgreSQL + migrated schema
npm run typecheck
npm run lint
```

## 7. Shutdown / reset

```bash
docker compose down
# destructive reset of local DB volume:
docker compose down -v
```

## Notes

- SQLite is not used.
- Production auth is not configured; local DEV auth is explicitly gated.
- `ALLOW_DEV_AUTH` cannot be enabled when `NODE_ENV=production`.
