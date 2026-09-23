# Phase 6 Backlog

**Source:** Phase 5.5 UX / deployment acceptance findings only (code audit + continuity fixes + acceptance journey).  
**Phase 6 Must Fix (production OIDC / auth):** **Done** on branch `phase6-production-auth-deployment` — see [PHASE-6-IMPLEMENTATION.md](./PHASE-6-IMPLEMENTATION.md). Production deploy remains blocked until real OIDC + managed Postgres credentials are supplied ([DEPLOYMENT-ACCEPTANCE.md](./DEPLOYMENT-ACCEPTANCE.md)).

---

## Must Fix

| Item | Why (finding) | Status |
|---|---|---|
| **Production OIDC / auth** | Production fails closed; DEV auth forbidden; no real principal path. Blocks any safe Vercel/production deploy (DEPLOYMENT-ACCEPTANCE). | **Done (Phase 6)** — Auth.js OIDC, ExternalIdentity, secure bootstrap, session cookies. Deploy blocked on credentials only. |

---

## Should Fix

| Item | Why (finding) |
|---|---|
| **Overview overload polish** | Many metric tiles still dense for first-time managers even after section grouping / links |
| **Risk update UI** | `updateRisk` (+ action) exists; risks page is create/list only |
| **Team members list** | Team page thin; membership/capacity discovery requires Resource navigation |
| **Stronger Project → PI UX** | 5.5 added Plan delivery → `/pi`; still no first-class “place work on PI board” continuity |
| **Error copy audit** | Manager-facing forms often surface technical `AppError` / validation wording |
| **Performance caching for large PI boards** | Conflicts derived on read (correct); large portfolios need selective cache/pagination |

---

## Could Improve

| Item | Why (finding) |
|---|---|
| **Metric deep filters** | Some overview tiles link to broad lists; stage/type deep filters incomplete |
| **Archive org UI** | Archive exists in service layer without UI |
| **Binary documents** | Documents intentionally metadata-only; uploads deferred |
| **Scenario UX** | `PlanningRevision` foundation only; no A/B what-if UI |
| **WCAG formal audit** | Basic labels/focus present; no formal WCAG pass |

---

## Explicitly out of this backlog seed

- Excel import architecture (EXCEL-MIGRATION.md — Future)
- AI recommendations-as-decisions
- Invented executive cockpit features beyond attention polish implied by overview density

Prioritize remaining **Should Fix** items after production credentials unblock deploy smoke.
