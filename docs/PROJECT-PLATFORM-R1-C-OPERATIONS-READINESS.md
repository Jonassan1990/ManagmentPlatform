# PROJECT PLATFORM — R1-C

## Operations Readiness (Backup, Restore, Observability, Recovery)

**STATUS: PARTIAL**

**Verdict:** `R1-C CODE READY — OPERATIONS PARTIALLY VERIFIED`

**Date:** 2026-10-10  
**Starting main SHA:** `ae281676768aa538c856f557c55128e465ad1963`  
**Branch:** `cursor/r1c-operations-readiness-60bb`

---

## 1. Executive Summary

R1-C adds a trustworthy operational foundation for V1:

| Area | Outcome |
|---|---|
| Health / readiness | **VERIFIED** (code + local DB probe); Production HTTP check after deploy |
| Structured logging + correlation | **VERIFIED** (unit tests + code) |
| AuthZ denial / action failure logs | **VERIFIED** (code paths) |
| Production Prisma Postgres backups / PITR | **NOT VERIFIED** (provider console settings not readable via available APIs) |
| Full production restore test | **NOT EXECUTED** (would endanger or copy production data); isolated **schema rebuild drill** measured |
| Monitoring / alerts | **DOCUMENTED**, **NOT CONFIGURED** in Vercel (0 log drains) |
| Protected migrate workflow | **DESIGNED** (`docs/ops/prisma-migrate-production.workflow.yml`); **NOT INSTALLED** in `.github/workflows` (token lacks `workflow` scope) |

OIDC Production remains unconfigured (R1-B). TEMP_AUTH remains recovery path.

---

## 2. Production Architecture

| Component | Identity |
|---|---|
| App | `https://managmentplatform.vercel.app` |
| Vercel project | `managmentplatform` / `prj_bIKvpiacwLps32zOEJHRMXGpIcZM` |
| Region | `iad1` |
| Database | Prisma Postgres store **`prisma-postgres-cinnabar-engine`** (`store_i1vyuTF6nGuwzs7g`) → `db.prisma.io` |
| Auth | Auth.js JWT; TEMP_AUTH present; OIDC env **absent** |
| Migrations | **14/14** applied (R1-A) |

---

## 3. Backup Assessment

| Question | Status | Evidence |
|---|---|---|
| Automated backups enabled? | **NOT VERIFIED** | Vercel/Prisma store APIs available to this session do not expose backup toggles |
| Frequency | **NOT VERIFIED** | — |
| Retention | **NOT VERIFIED** | — |
| Point-in-time recovery (PITR) | **NOT VERIFIED** | Assumed possible only per Prisma Postgres product docs — **not confirmed on this store** |
| Restore mechanism | **NOT VERIFIED** | Operator must use Prisma Console / Vercel Marketplace UI |
| Operator permissions | Partial | Vercel token can list project/env metadata; cannot decrypt secrets or manage store backups |

### Operator action required

1. Open Vercel → Project → Storage / Prisma Postgres → **`prisma-postgres-cinnabar-engine`**.
2. Confirm automated backups / PITR / retention.
3. Record retention window and restore UI path in this document’s Evidence Appendix.
4. Optionally enable a log drain / alert channel (see §9).

---

## 4. Restore Test

| Item | Result |
|---|---|
| Production overwrite | **Not performed** (forbidden) |
| Production data copy to uncontrolled env | **Not performed** |
| Isolated schema rebuild drill | **PASS** — empty local DB `management_platform_r1c_restore_drill`; `npx prisma migrate deploy` applied **14/14** migrations |
| Measured duration | **~1968 ms** (local agent host; not production network) |
| Data integrity after drill | Migration history complete; empty business tables (no prod data) |

This drill validates **schema recovery from repository migrations**, not provider backup restore of production data.

### Authorized restore procedure (when operator confirms backups)

1. Identify restore point (timestamp / backup id) in Prisma Console.
2. Restore into a **new** non-production database / branch (never onto live Production URL).
3. Point a Preview or local app at the restored DB with isolated secrets.
4. Run `npx prisma migrate status` (expect up to date or pending only if production was ahead).
5. Verify invariants (one CURRENT per PI; no failed `_prisma_migrations`; FK indexes).
6. Only after validation, plan cutover under change control.

---

## 5. RTO / RPO

| Metric | Value | Basis |
|---|---|---|
| Production RPO (backup) | **NOT VERIFIED** | Provider retention/PITR not inspected |
| Production RTO (full restore) | **NOT VERIFIED** | No production restore executed |
| Schema rebuild (migrations only) | ~2 s measured locally | Isolated drill; **not** a committed RTO SLA |

Do not treat the schema drill timing as a production RTO commitment.

---

## 6. Health / Readiness

| Endpoint | Auth | Behavior |
|---|---|---|
| `GET /api/health` | Public | App liveness + DB `SELECT 1` (2.5s timeout) + auth **configuration flags** (booleans only) |

Response shape (no secrets):

```json
{
  "status": "ok|fail",
  "ready": true,
  "checks": {
    "app": "ok",
    "database": "ok|fail",
    "databaseLatencyMs": 12,
    "auth": {
      "oidcConfigured": false,
      "tempAuthConfigured": true,
      "devAuthEnabled": false
    }
  },
  "requestId": "…",
  "durationMs": 15
}
```

- HTTP **200** when DB ready; **503** when DB fails.
- Middleware allowlists `/api/health`.
- Does not return connection strings, issuer URLs, or usernames.

---

## 7. Logging

Structured JSON logs via `src/server/logger.ts`:

| Field | Purpose |
|---|---|
| `ts`, `level`, `event` | Standard envelope |
| `requestId` | Correlation (middleware `x-request-id` + ALS) |
| Redaction | Keys matching password/secret/token/URL; `postgres://` values |

Critical events:

| Event | Source |
|---|---|
| `auth.oidc_signin_rejected` | `auth.ts` |
| `auth.temp_identity_failed` | `auth.ts` |
| `authz.denied` | `AuthorizationService.assertCan` |
| `action.denied` / `action.unexpected` | `runAction` |
| Named ops | `pi.scenario.promote`, `pi.plan.approve`, `pi.baseline.create`, `governance.*`, `project.close`, … |
| `health.database_fail` | `/api/health` |

Audit events continue in DB; `correlationId` auto-filled from request context when present.

**Never logged:** passwords, tokens, connection strings, OIDC client secrets.

---

## 8. Monitoring

| Signal | Where to observe | Status |
|---|---|---|
| Availability | Vercel project deployments + `/api/health` uptime check | Health **implemented**; external uptime **NOT CONFIGURED** |
| HTTP 5xx | Vercel Runtime Logs / Analytics | **CONFIGURED BUT NOT TESTED** (platform default) |
| DB failures | `health.database_fail` + Prisma error logs | Code ready |
| Auth failures | `auth.*` structured events | Code ready |
| Failed deployments | Vercel Git integration | Platform default |
| Migration failures | Manual / future workflow stdout | See §11 |
| Log drains | Vercel API list | **0 drains** — **NOT CONFIGURED** |

---

## 9. Alerts

| Alert | Status |
|---|---|
| Uptime on `/api/health` | **NOT CONFIGURED** — operator should add Vercel/external monitor |
| 5xx spike | **NOT CONFIGURED** |
| Deploy failure | Rely on Vercel GitHub check notifications |
| Migration job failure | When workflow installed + Environment reviewers |

Do **not** claim alerts are operational until configured and tested.

---

## 10. Incident Response

### Application unavailable

1. Check Vercel deployment status and Runtime Logs.
2. Hit `/api/health` — if `database=fail`, go to DB unavailable.
3. Rollback deployment to last known-good Production deploy (Vercel Instant Rollback).
4. Escalate: platform owner + whoever holds Vercel/Prisma access.

### Database unavailable

1. Confirm `/api/health` and Prisma Console status.
2. Do **not** run `migrate reset` or destructive SQL.
3. If data loss suspected: open backup/PITR path (once verified in Console).
4. Keep TEMP_AUTH / OIDC as-is; app will 503 readiness until DB returns.

### Failed migration

1. Capture sanitized `prisma migrate status` (redact URLs).
2. Inspect `_prisma_migrations` for unfinished rows (ops host only).
3. Fix forward or restore DB from backup to pre-migrate point; never `db push` in production.
4. Use protected `production-migrate` workflow once installed.

### Authentication outage

| Symptom | Action |
|---|---|
| OIDC misconfigured | Fix/unset `OIDC_*`; TEMP_AUTH remains recovery if still configured |
| TEMP_AUTH failure | Rotate hash via known procedure; do not share password |
| Both down | App fail-closed; restore env from Vercel backups / prior env values |

### Invalid production env

1. Compare required vars in `PRODUCTION-AUTH-RUNBOOK.md` / `DEPLOYMENT-VERCEL.md`.
2. Prefer Vercel UI with 2FA step-up; never commit secrets.
3. Redeploy after correction.

### Deployment rollback

1. Vercel → Production → Promote previous READY deployment.
2. Confirm `/login` + `/api/health`.
3. Schema is forward-only unless DB restored — app rollback ≠ schema rollback.

### Data recovery

1. Confirm backup identity (cinnabar-engine).
2. Restore to **non-production** target first.
3. Validate migrations + invariants.
4. Cut over under change control.

---

## 11. Migration Operations

Carry-forward from R1-A:

| Item | Status |
|---|---|
| GitHub Environment `production-migrate` | **NOT CONFIGURED** (operator) |
| Workflow file in `.github/workflows` | **BLOCKED** by PAT `workflow` scope — template at `docs/ops/prisma-migrate-production.workflow.yml` |
| Target guard | Refuses non-`db.prisma.io` hosts |
| Approval | `workflow_dispatch` + Environment required reviewers |
| Logging | Status/deploy stdout with URL redaction |

Install steps:

1. Create Environment `production-migrate` with reviewers.
2. Add `DATABASE_URL` / `DIRECT_URL` for cinnabar-engine only.
3. Copy YAML to `.github/workflows/prisma-migrate-production.yml` with a `workflow`-scoped token.
4. Run once dry (status only) then deploy when needed.

---

## 12. Security

| Control | Result |
|---|---|
| Production secrets not in repo | PASS |
| Health endpoint leaks | No secrets/URLs/usernames |
| Log redaction | Unit tested |
| TEMP_AUTH isolation | Unchanged (R1-B) |
| OIDC absence reported accurately | `auth.oidcConfigured: false` on health when unset |
| RBAC / auth semantics | Unchanged |
| DEV auth in production | Still coerced off |

---

## 13. Outstanding Blockers

1. **Confirm Prisma Postgres backup/PITR/retention** in Console for `prisma-postgres-cinnabar-engine`.
2. **Install** protected migrate workflow + Environment secrets.
3. **Configure** uptime monitor on `/api/health` and optional log drain.
4. **Production OIDC** still blocked (R1-B) — separate from R1-C.
5. Execute an **authorized** non-production backup restore when Console access allows.

---

## 14. Evidence Appendix

| Evidence | Detail |
|---|---|
| Baseline SHA | `ae281676768aa538c856f557c55128e465ad1963` |
| Schema drill DB | `management_platform_r1c_restore_drill` (local) |
| Schema drill result | 14 migrations; ~1968 ms |
| Vercel log drains | `GET /v1/integrations/log-drains` → empty list |
| Health route | `src/app/api/health/route.ts` |
| Logger | `src/server/logger.ts` |
| Correlation | `x-request-id` middleware + audit `correlationId` |
| Quality gates | typecheck / lint / test / integration / build (see PR) |

### Production checks (post-merge)

| Check | Classification |
|---|---|
| `GET https://managmentplatform.vercel.app/api/health` | To be verified after deploy |
| Backup settings | **NOT VERIFIED** |
| Alerts | **NOT CONFIGURED** |

---

## Remaining R1-D scope (do not implement here)

- Live backup restore attestation with Console evidence
- Working GitHub `production-migrate` Environment + installed workflow
- Configured uptime/5xx alerts
- Optional OpenTelemetry export
- Production OIDC cutover completion (from R1-B)

**STOP — do not implement R1-D in this change set.**
