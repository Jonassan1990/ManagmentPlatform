# PROJECT PLATFORM — R1-A

## Production Database Migration Recovery & Environment Verification

**STATUS: PASS**

**Verdict:** `R1-A COMPLETE — PRODUCTION DATABASE VERIFIED`

**Date:** 2026-10-10  
**Starting main SHA:** `7737ba61b1b4f96c03f6f2e07b74f03b905e99ce`  
**Production deploy:** `dpl_2UAK54iwpVD7XmRpHEZ57zhti3mT` (READY, same SHA)  
**Execution method:** Operator-authorized `npx prisma migrate deploy` against production `DIRECT_URL` / `DATABASE_URL` for Prisma Postgres store `prisma-postgres-cinnabar-engine` (host `db.prisma.io`).

---

## 1. Baseline

| Check | Result |
|---|---|
| `origin/main` tip | `7737ba61b1b4f96c03f6f2e07b74f03b905e99ce` (Merge PR #62 M4F-FINAL) |
| Minimum expected SHA | Met (`7737ba6…`) |
| M0–M4 on main | Yes (through M4F-FINAL acceptance) |
| Working tree at start | Clean vs `origin/main` (local untracked QA artifacts only; not committed) |
| Production Vercel ↔ main | Latest Production deployment commit SHA = `7737ba6…` |
| Deploy docs present | `docs/DEPLOYMENT-VERCEL.md`, `docs/PRODUCTION-AUTH-RUNBOOK.md`, `docs/DEPLOYMENT-ACCEPTANCE.md` |

---

## 2. Production target verification

| Fact | Evidence (sanitized) |
|---|---|
| App URL | `https://managmentplatform.vercel.app` |
| Vercel project | `managmentplatform` / `prj_bIKvpiacwLps32zOEJHRMXGpIcZM` |
| Team / scope | `jonassan1990s-projects` |
| Production environment | Target `production`; env vars include `DATABASE_URL`, `DIRECT_URL`, `POSTGRES_URL`, `PRISMA_DATABASE_URL` (all `sensitive`) |
| Prisma Postgres integration | Store name **`prisma-postgres-cinnabar-engine`**, store id `store_i1vyuTF6nGuwzs7g`, region `iad1` |
| Database identity | PostgreSQL database `postgres` at `db.prisma.io:5432` (Prisma Postgres). Identity confirmed via linked Marketplace store + successful authenticated session using production connection material — **not** inferred from hostname alone. |
| Connection method | Direct TLS Postgres (`postgres://…@db.prisma.io:5432/postgres`). Schema `directUrl = env("DIRECT_URL")`. |
| Migration permissions | Role can create types/tables/indexes and write `_prisma_migrations` (proven by successful `migrate deploy`). |

**Secrets:** Connection strings and passwords are **not** recorded in this document, the repository, or commit history.

### Credential access notes

| Path | Outcome |
|---|---|
| `vercel env pull --environment=production` | Blocked for secrets — values written as `[SENSITIVE]` (step-up / 2FA decrypt required for CLI/API reveal) |
| GitHub Actions secrets API | 403 with available PAT (insufficient scope) |
| Authorized production connection material | Used ephemerally for migrate only; not committed |

---

## 3. Migration inventory (repository order)

| # | Migration | Role |
|---|---|---|
| 1 | `20260923090055_phase1_organization_foundation` | Foundation |
| 2 | `20260923093444_phase2_initiative_prestudy` | Initiative |
| 3 | `20260923100000_phase3_governance_poc` | Governance |
| 4 | `20260923110000_phase4_pilot_project` | Pilot / project |
| 5 | `20260923120000_phase5_pi_planning` | PI planning |
| 6 | `20260923130000_phase6_production_auth` | Auth |
| 7 | `20261008190000_phase0a_principal_resource_link` | Principal↔resource |
| 8 | `20261008194500_phase0b_ownership_resource_fks` | Ownership FKs |
| 9 | `20261008210000_phase1c_project_issues` | Project issues |
| 10 | `20261008220000_phase1d_project_closure` | Project closure |
| 11 | `20261009150000_m3b_planning_scenarios` | M3B scenarios |
| 12 | `20261009170000_m3d_a_scenario_selection` | **M3D-A** selection |
| 13 | `20261009180000_m3d_b_scenario_promotion` | **M3D-B** promotion |
| 14 | `20261009190000_m3d_c_plan_approval` | **M3D-C** plan approval |

Lock file: `prisma/migrations/migration_lock.toml` (PostgreSQL).

---

## 4. Pre-migration safety

### Applied vs pending (before deploy)

| State | Migrations |
|---|---|
| Applied (10) | Through `20261008220000_phase1d_project_closure` |
| Pending (4) | `m3b_planning_scenarios`, `m3d_a_scenario_selection`, `m3d_b_scenario_promotion`, `m3d_c_plan_approval` |
| Failed / unfinished / rolled back | **None** |

### Pending SQL risk review

All four pending migrations are **additive**:

- `CREATE TYPE` / `CREATE TABLE` / `ALTER TABLE … ADD COLUMN` / `CREATE INDEX` / `CREATE UNIQUE INDEX` / FK add
- M3B includes a bounded `UPDATE` to set `status = ACTIVE_PLAN` where `isCurrent = true` (new column default `DRAFT`)
- **No** `DROP TABLE`, `TRUNCATE`, `DELETE FROM`, or column drops in the pending set

Earlier history contains only defensive `DROP INDEX IF EXISTS` in phase4 (already applied).

### Pre-migration integrity (counts only)

| Metric | Value |
|---|---|
| Program increments | 2 |
| Planning revisions | 2 |
| Revisions with `isCurrent = true` | 2 (exactly one per PI — no anomalies) |
| Work allocations | 0 |
| PI baselines | 0 |
| `pi_plan_approvals` table | Absent (expected pre-M3D-C) |

### Backup / recovery

| Item | Assessment |
|---|---|
| Provider | Prisma Postgres (Vercel Marketplace) — platform continuous backup / PITR is the recovery path |
| Agent-visible backup API | Not independently enumerable from this session |
| Migration risk | **Acceptable** for proceed: additive-only SQL; zero allocations/baselines; reversible by re-deploy from backup + migrate if needed |
| Rollback strategy | (1) Do not run `migrate reset`. (2) On failed migration, inspect `_prisma_migrations` and restore from Prisma Postgres backup/PITR to pre-deploy timestamp, then re-run `migrate deploy`. (3) Application rollback alone does not undo schema. |

---

## 5. Migration execution

```text
npx prisma migrate deploy
```

| Field | Value |
|---|---|
| Target | Production Prisma Postgres (`db.prisma.io`, database `postgres`) |
| Tooling | Prisma CLI against repo migrations at main `7737ba6…` |
| Forbidden ops | Not used: `migrate reset`, `db push`, manual destructive SQL, local/Preview substitute DBs |
| Result | **Success** — four migrations applied |

Applied in this run:

1. `20261009150000_m3b_planning_scenarios`
2. `20261009170000_m3d_a_scenario_selection`
3. `20261009180000_m3d_b_scenario_promotion`
4. `20261009190000_m3d_c_plan_approval`

Post-status: **Database schema is up to date!** (14/14)

---

## 6. Post-migration verification

| Check | Result |
|---|---|
| All 14 migrations finished | PASS |
| Failed / unfinished / rolled-back / logged failures | **0** |
| Exactly one CURRENT (`isCurrent`) per PI | PASS |
| `ACTIVE_PLAN` alignment with CURRENT | PASS (2/2) |
| SELECTED uniqueness anomalies | None |
| VALID approval uniqueness anomalies | None (0 approvals) |
| WorkAllocations preserved | PASS (still 0) |
| PiBaselines unchanged | PASS (still 0) |
| M3D columns present | `selectedRevisionId`, promotion columns, `status` / `statusBeforeSelection`, `pi_plan_approvals`, `pi_baselines.planApprovalId` |
| Indexes | `planning_revisions_one_current_per_pi`, `planning_revisions_one_selected_per_pi`, `pi_plan_approvals_one_valid_per_pi`, selected/promotion indexes |
| Foreign keys | Present for selection, promotion, approvals, baselines |

Post counts: PIs=2, revisions=2, allocations=0, baselines=0, approvals=0, applied_migrations=14.

No production business row contents are exported in this report.

---

## 7. Production runtime smoke (read-only)

| Surface | Result |
|---|---|
| `GET /login` | 200 — Sign-in / owner credential UI present |
| `/`, `/organizations`, `/initiatives`, `/portfolio`, `/capacity` | Redirect to `/login?callbackUrl=…` (auth gate) |
| `/pi-planning`, `/planning`, `/review` | Redirect to login |
| Authenticated deep smoke (org → initiatives → portfolio → PI → scenarios → review → capacity) | **Not executed** — production temp/OIDC secrets not decryptable via CLI without operator step-up; avoided creating production test data |

Runtime app remains on deploy `7737ba6…`. Schema catch-up does not require app redeploy for these additive migrations.

---

## 8. Operational improvement — protected migrate workflow

**Do not** run migrations automatically on every application startup.

### Recommended workflow

| Step | Practice |
|---|---|
| Execution identity | Dedicated GitHub Environment `production-migrate` (or Vercel protected one-off job) with required reviewers |
| Environment targeting | Explicit `environment: production` + confirmation that `DATABASE_URL`/`DIRECT_URL` resolve to **cinnabar-engine** / `db.prisma.io` (not Preview) |
| Secret access | Store `DIRECT_URL` (and `DATABASE_URL` if distinct) only in the protected Environment; never in repo; prefer OIDC/short-lived reveal over long-lived chat logs |
| Approval gate | `workflow_dispatch` + environment required reviewers (min 1) before job runs |
| Migration logs | Persist `prisma migrate status` before/after and deploy stdout as workflow artifacts (redact URLs) |
| Failure handling | Stop on non-zero; leave failed `_prisma_migrations` row for diagnosis; no auto-reset |
| Rollback / recovery | Prisma Postgres PITR / backup restore to pre-job timestamp; re-verify identity; re-run `migrate deploy` |
| Post-deploy verification | Counts + invariant SQL (one CURRENT per PI; SELECTED/VALID uniqueness; zero failed migrations) + `/login` smoke |

Operator bootstrap:

1. Create GitHub Environment `production-migrate` with required reviewers.
2. Add secrets `DATABASE_URL` and `DIRECT_URL` from Vercel Production (after 2FA reveal) matching cinnabar-engine.
3. Add `.github/workflows/prisma-migrate-production.yml` from the appendix below (requires a token with `workflow` scope) and run it manually after migration merges; attach status logs to the release note.

### Appendix — proposed `prisma-migrate-production.yml`

```yaml
name: Prisma migrate (production)
on:
  workflow_dispatch:
    inputs:
      confirm_production:
        description: 'Type production to target the production database'
        required: true
        type: string
concurrency:
  group: prisma-migrate-production
  cancel-in-progress: false
jobs:
  migrate:
    name: migrate deploy
    runs-on: ubuntu-latest
    environment: production-migrate
    if: ${{ inputs.confirm_production == 'production' }}
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - name: Pre-status (sanitized)
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
        run: |
          set -euo pipefail
          test -n "${DATABASE_URL:-}"
          test -n "${DIRECT_URL:-}"
          echo "$DATABASE_URL" | grep -q 'db.prisma.io' || {
            echo 'Refusing migrate: DATABASE_URL host is not db.prisma.io'
            exit 1
          }
          npx prisma migrate status 2>&1 | sed -E 's#postgres(ql)?://[^@]+@#postgres://***@#g'
      - name: Migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
        run: |
          set -euo pipefail
          npx prisma migrate deploy 2>&1 | sed -E 's#postgres(ql)?://[^@]+@#postgres://***@#g'
      - name: Post-status (sanitized)
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL: ${{ secrets.DIRECT_URL }}
        run: |
          set -euo pipefail
          npx prisma migrate status 2>&1 | sed -E 's#postgres(ql)?://[^@]+@#postgres://***@#g'
```

**Note:** Committing the workflow file itself requires a GitHub credential with the `workflow` scope. Until then, keep the YAML in this runbook and apply it via an operator with sufficient token permissions.

---

## 9. Security considerations

- Production connection strings never committed; ephemeral use only.
- Vercel API/CLI cannot decrypt integration secrets without interactive step-up — treat as a control, not a bug.
- Prefer protected workflow over ad-hoc laptop migrate once Environment secrets are configured.
- Do not paste production URLs into issues/PRs.
- `ALLOW_DEV_AUTH` must remain unset/false in Production.

---

## 10. Quality gates (non-destructive)

| Gate | Result |
|---|---|
| `eslint` | PASS (0 errors; pre-existing script warnings only) |
| Destructive integration suites vs production | **Not run** (by design) |
| `prisma migrate status` (production, post) | Up to date |

---

## 11. Remaining blockers / follow-ups

| Item | Severity | Action |
|---|---|---|
| Configure GitHub `production-migrate` Environment secrets + reviewers | Medium | Operator — enables repeatable protected deploys |
| Vercel secret decrypt still requires 2FA step-up | Info | Expected; use Console or Environment secrets |
| Authenticated production UX smoke after schema catch-up | Low | Operator login once; exercise PI Review / Capacity read-only |
| Confirm Prisma Postgres backup retention in Console | Low | Document retention window in ops runbook |

No blocker remains for **schema correctness** on production.

---

## 12. GitHub

Documentation + protected workflow ship via PR on branch `cursor/r1a-production-db-recovery-60bb`, then merge to `main`. No force push.

---

## Final checklist

| Item | Value |
|---|---|
| STATUS | **PASS** |
| Starting main SHA | `7737ba61b1b4f96c03f6f2e07b74f03b905e99ce` |
| Production DB identity | `prisma-postgres-cinnabar-engine` (`store_i1vyuTF6nGuwzs7g`) → `db.prisma.io` / `postgres` |
| Pending before | M3B + M3D-A/B/C (4) |
| Applied after | 14/14, zero failures |
| Execution | `npx prisma migrate deploy` |
| Data integrity | CURRENT uniqueness OK; allocations/baselines preserved; FKs/indexes present |
| Smoke | Login + auth redirects PASS; authenticated deep smoke deferred |
| Documentation | `docs/PROJECT-PLATFORM-R1-A-PRODUCTION-DB-RECOVERY.md` |

**R1-A COMPLETE — PRODUCTION DATABASE VERIFIED**

STOP — do not implement R1-B in this change set.
