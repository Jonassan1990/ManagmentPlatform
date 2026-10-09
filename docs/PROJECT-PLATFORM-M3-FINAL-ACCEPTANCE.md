# Project Platform — M3 Final Acceptance (M3E)

**Date:** 2026-10-09  
**Starting main SHA:** `4519bbd04f7fc3d4683b2df7b49b05193bb71ba9`  
**Final main SHA (acceptance merge):** `6bb7789bc7b533b3077b9cae06aa5e5c38ba3e50`  
**Scope:** Final M3 milestone acceptance and production-release assessment. **No new product features. No M4.**

Prerequisite: [PI-SCENARIO-M3D-ACCEPTANCE.md](./PI-SCENARIO-M3D-ACCEPTANCE.md) — **STATUS: PASS (functional)**.

---

## 1. Executive Summary

M3 (PI Planning Scenarios) is **functionally complete** on `main`: architecture through approval/baseline is merged, isolated regression and acceptance evidence is green, and the authenticated browser journey succeeds.

**Production release remains blocked** because the production Postgres host (`db.prisma.io`) is unreachable from the verification environment (P1001). Schema application of M3D-A/B/C migrations on production has **not** been verified. A green Vercel build/deploy must not be conflated with production database readiness.

| Dimension | Verdict |
|---|---|
| Functional milestone | **COMPLETE** |
| Production release | **BLOCKED** |
| Security (code/contract) | PASS with known temp-auth fail-closed |
| Database integrity (schema + local apply) | PASS |
| Operational readiness | PARTIAL — deploy path exists; prod migrate unverified |

**M3 FUNCTIONALLY COMPLETE — PRODUCTION RELEASE BLOCKED**

---

## 2. M3 Functional Verdict

**COMPLETE**

Merged chain on main (verified by git history + migrations present):

| Milestone | Evidence |
|---|---|
| M3A Architecture | PR #29 / `PROJECT-PLATFORM-M3-SCENARIO-ARCHITECTURE.md` |
| M3B Create & Edit | `20261009150000_m3b_planning_scenarios` |
| M3C Comparison | compare service + `/pi/[piId]/compare` |
| M3D-A Selection & Readiness | `20261009170000_m3d_a_scenario_selection` |
| M3D-B Promotion | `20261009180000_m3d_b_scenario_promotion` |
| M3D-C Approval & Baseline | `20261009190000_m3d_c_plan_approval` + merge `99ef57c` |
| M3D-D E2E Acceptance | `docs/PI-SCENARIO-M3D-ACCEPTANCE.md` PASS; merge `11abed0` |

Lifecycle matrix (M3D-D): **25 / 25 PASS**.  
Browser journey (M3E re-run): **25 / 25 PASS**.  
Integration suite: **190 / 190 PASS**.

---

## 3. Production Release Verdict

**BLOCKED**

| Gate | Result |
|---|---|
| Repository migrations present & ordered | PASS |
| Local `prisma migrate status` (14 migrations) | PASS — up to date |
| Production `prisma migrate status` | **FAIL** — `P1001: Can't reach database server at db.prisma.io:5432` |
| Production schema includes M3D-A/B/C | **NOT VERIFIED** |
| Vercel production deployment exists | Observed (GitHub deployments API shows Production env for tip SHAs) — **not** proof of schema readiness |
| Authorized migrate-deploy workflow documented | PASS — runbook exists; **operator must execute** against reachable prod DB |

Exact remaining operator action (see §13):

1. From a network path that can reach production Postgres (`DIRECT_URL`).
2. Confirm credentials for the intended production database (not a substitute local DB).
3. Run `npx prisma migrate deploy` (never `migrate reset` / `db push`).
4. Capture `npx prisma migrate status` showing M3D-A/B/C applied.
5. Smoke-test Review → Approve → Baseline against that database.

Until step 4–5 succeed, M3 must not be declared production-ready.

---

## 4. Architecture Assessment

| Invariant | Result | Notes |
|---|---|---|
| One CURRENT `PlanningRevision` per PI | PASS | Partial unique index `planning_revisions_one_current_per_pi` |
| Multiple isolated scenario revisions | PASS | Revision-scoped `WorkAllocation` |
| Single allocation ledger | PASS | No second ledger |
| Capacity/conflict engine reuse | PASS | Readiness + promote/approve re-evaluate |
| Explicit scenario selection | PASS | `selectedRevisionId` + SELECTED status unique |
| Atomic promotion | PASS | Transactional allocate-replace; CURRENT id stable |
| Version-bound approval | PASS | `currentRevisionVersion` + allocation fingerprint |
| Immutable baseline | PASS | Append-only `versionNumber`; payload JSON; approval FK |
| Initiative/Project traceability | PASS | Allocations → `ProjectWorkItem` → Project/Initiative |
| Phase 0C authorization | PASS | `assertCan` on all PI mutations |
| Portfolio M2 compatibility | PASS | Queries CURRENT only for live metrics |
| Legacy bypass of approval/version gates | PASS | `createBaseline` requires `expectedApprovalId` (Zod + service); Server Actions → services only |

UI → Server Actions (`requirePrincipal`) → `PlanningService` → selection/promotion/approval/baseline → AuthZ → Prisma → Audit.

---

## 5. End-to-End Journey

Isolated browser DB: `management_platform_m3d_qa` (non-destructive vs integration DBs).  
Scripts: `scripts/seed-m3dd-browser-qa.mjs`, `scripts/m3dd-browser-qa.mjs`  
App: [PI Planning QA](http://localhost:43148)

| Step | Result |
|---|---|
| Open PI Planning / Board | PASS |
| Create Scenario A from CURRENT | PASS |
| Clone Scenario B | PASS |
| Edit B (A + CURRENT unchanged) | PASS |
| Compare CURRENT / A / B | PASS |
| Select B + inspect readiness | PASS |
| Promote B → CURRENT matches B | PASS |
| Approve CURRENT (version-bound) | PASS |
| Create immutable baseline | PASS |
| Baseline history visible | PASS |
| Stale approval after CURRENT edit | PASS |
| Stale approval blocks baseline | PASS |
| Portfolio Capacity CURRENT; no draft leak | PASS |
| Mobile review layout | PASS |
| Subsequent scenario planning after baseline | PASS (CURRENT remains editable; new scenarios creatable — covered by post-baseline edit + M3D INT) |

Evidence: [`docs/acceptance-assets/m3e/browser-result.json`](./acceptance-assets/m3e/browser-result.json), screenshots under `docs/acceptance-assets/m3e/screenshots/`.

---

## 6. Authorization / Security

| Control | Result |
|---|---|
| Permission boundaries (`PI_VIEW` / `ALLOCATE` / `REVIEW` / `BASELINE`) | PASS — system role packs |
| Org / section / department scope isolation | PASS — `assertCan` + cross-org INT denials |
| Viewer read-only | PASS — mutations `FORBIDDEN` |
| Project/Resource ownership (Phase 0) | PASS — ownership INT suites |
| Approval authority (`PI_REVIEW`) | PASS — Org Admin + Section Manager |
| Baseline authority (`PI_BASELINE`) | PASS — Org Admin only among standard packs |
| Auth.js CSRF / session cookies | PASS — NextAuth credentials + JWT HttpOnly; `SameSite=lax` |
| Server Action validation | PASS — Zod parse in services; principal required |
| Sensitive data exposure | PASS — no secrets in responses; passwords not logged |
| Audit actor identity | PASS — `actorPrincipalId` on promote/approve/baseline |
| Temporary auth fail-closed | PASS — incomplete/invalid temp env disables provider (unit + INT) |

**Note:** Section Manager can approve (`PI_REVIEW`) but cannot baseline (`PI_BASELINE`) — intentional pack split; UI must keep baseline disabled with explanation for that persona.

Credentials are not recorded in this document.

---

## 7. Database Integrity

Constraints verified in schema + applied SQL (local DBs):

| Constraint | Mechanism |
|---|---|
| One CURRENT per PI | `UNIQUE (piId) WHERE isCurrent = true` |
| One SELECTED per PI | `UNIQUE (piId) WHERE status = 'SELECTED'` |
| One selected pointer | `program_increments.selectedRevisionId` UNIQUE |
| Allocation uniqueness | `@@unique([revisionId, workItemId])` |
| One VALID approval per PI | `UNIQUE (piId) WHERE status = 'VALID'` |
| Baseline version uniqueness | `@@unique([piId, versionNumber])` |
| Baseline↔approval | `planApprovalId` UNIQUE + FK `ON DELETE RESTRICT` |
| Referential integrity | FKs Restrict/Cascade as modeled |
| Migration ordering | M3B → M3D-A → M3D-B → M3D-C |
| Destructive migrations | None in M3 incremental migrations |

Application + DB uniqueness jointly prevent inconsistent selected/promoted/approved states under concurrency (see §8).

---

## 8. Concurrency / Idempotency

| Scenario | Result |
|---|---|
| Concurrent scenario edits (stale version) | Rejected |
| Concurrent selection | One winner |
| Promotion races | One winner; no partial CURRENT |
| Approval races | One VALID |
| Baseline races | One new version |
| Stale retries | `CONFLICT` |
| Transaction rollback | PASS — failed approve leaves no approval row |
| Idempotent promote replay | PASS when versions match |
| Recovery from partial failure | Business state transactional; **audit recorded after commit** |

**Audit-after-commit limitation (P3):** If the process dies between commit and `audit.record`, domain state is correct but the audit trail may miss an event. Not a data-corruption P0; operational debt for M4+ observability.

No release-blocking concurrency failure modes found in code or tests.

---

## 9. Portfolio Compatibility

| Check | Result |
|---|---|
| Live commitments from CURRENT | PASS |
| Historical approved baseline distinct | PASS |
| Resource utilization from CURRENT capacity | PASS |
| Delivery health / Project references | PASS (Portfolio M2 suites) |
| Draft scenarios contaminate KPIs | FAIL mode prevented — browser + INT |

---

## 10. UX / Accessibility

Evaluated against Board / Scenarios / Compare / Review / Baselines / Portfolio Capacity. No M4 redesign performed.

| Topic | Finding | Class |
|---|---|---|
| Lifecycle labels (Selected / Promoted / Approved / Baselined) | Clear copy on Review | Good |
| Consequential confirms | Promote / Approve / Baseline confirm steps | Good |
| Readiness explanations | Classification + blockers/warnings | Good |
| Disabled actions | Stale baseline disabled with visible stale copy | Good |
| Responsive / mobile Review | Usable at 390×844 | Good |
| Keyboard | Forms/buttons focusable; dense compare tables are mouse-biased | P3 |
| Empty/loading/error | ActionResult errors surfaced; empty compare guarded | Good |
| Silent no-ops | Optimistic versions conflict rather than silent success | Good |
| Visual alignment | Capacity UI reference used as guidance; not a full design-system pass | P3 debt → M4 |

---

## 11. Performance / Scale

Script: `scripts/m3e-performance-bench.mts`  
DB: `management_platform_m3e_perf`  
Evidence: [`docs/acceptance-assets/m3e/performance-bench.json`](./acceptance-assets/m3e/performance-bench.json)

**Fixture (representative, not production-scale):**

| Dimension | Size |
|---|---|
| Work items | 200 |
| Allocations / scenario | 80 |
| Scenarios / PI | 4 |
| Departments / teams / resources | 3 / 6 / 12 |
| Iterations | 4 |
| PIs | 3 |
| Observed allocations after promote | 400 |
| Observed revisions | 7 |

**Timings (local Postgres, single process):**

| Operation | ms |
|---|---|
| Create scenario from CURRENT | 24 |
| Clone scenario | 31 |
| Edit 20 allocations | 447 |
| Compare 3-way | 78 |
| Select | 31 |
| Readiness | 35 |
| Promote | 72 |
| Approve | 73 |
| Baseline | 45 |
| Portfolio PI capacity | 49 |

**Scalability risks (honest):** Clone/compare/promote are O(allocations) in-process; large PIs (thousands of allocations) need pagination/streaming review before claiming production-scale readiness. **No million-row claim.**

---

## 12. Operational Readiness

| Item | Status |
|---|---|
| Vercel deployment configuration | Documented (`DEPLOYMENT-VERCEL.md`); Production deployments observed for main tip |
| Production runtime | App builds (`next build` PASS); runtime depends on env |
| Production database connection | **BLOCKED** — P1001 to `db.prisma.io` |
| Migration status (prod) | **NOT VERIFIED** |
| Environment configuration | Runbooks present; OIDC + DB + AUTH_SECRET required for full prod auth |
| Monitoring/logging | Basic `console.error` on Action failures; no dedicated APM claimed |
| Backup/restore evidence | **Not verified** in this assessment |
| Rollback procedure | Documented conceptually (redeploy prior SHA; migrations are additive — do not reset) |
| Safe migration workflow | `prisma migrate deploy` via `DIRECT_URL` only |

---

## 13. Migration Status

| Migration | In repo | Local applied | Production applied |
|---|---|---|---|
| `20261009150000_m3b_planning_scenarios` | Yes | Yes | **Unknown** |
| `20261009170000_m3d_a_scenario_selection` | Yes | Yes | **Unknown** |
| `20261009180000_m3d_b_scenario_promotion` | Yes | Yes | **Unknown** |
| `20261009190000_m3d_c_plan_approval` | Yes | Yes | **Unknown** |

All M3 migrations are **additive** (no DROP/TRUNCATE).

**Operator action required:**

```bash
# From a host that can reach production Postgres
export DATABASE_URL="<production pooled URL>"
export DIRECT_URL="<production direct URL>"
npx prisma migrate status    # inspect pending
npx prisma migrate deploy    # apply pending — never reset / db push
npx prisma migrate status    # confirm M3D-A/B/C applied
```

An authorized production migration process is **documented** but **not successfully executed** in this session due to network/credential reachability.

---

## 14. Regression Results

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 20 files / **147** tests |
| `npm run test:integration` | PASS — 20 files / **190** tests |
| `npm run build` | PASS |
| Local `npx prisma migrate status` | PASS — 14 migrations |
| Browser E2E (M3 lifecycle) | PASS — 25/25 |
| Performance bench | PASS (timing capture) |
| Production migrate status | **BLOCKED** (P1001) |

Integration coverage includes foundation, initiative, governance, PoC/pilot, project/issues/closure, PI planning, Portfolio M2, M3 scenarios (B/C/D), authentication/RBAC, temp-auth fail-closed.

---

## 15. Defect Register

| ID | Severity | Summary | Disposition |
|---|---|---|---|
| REL-M3E-01 | **Release blocker** (ops) | Production schema not verified — `db.prisma.io` P1001 | Blocks production release only |
| P3-M3E-01 | P3 | Audit events recorded after DB commit | Documented limitation |
| P3-M3E-02 | P3 | Compare/board keyboard density; design-system debt | Hand off to M4 UX |
| P3-M3E-03 | P3 | Backup/restore not evidenced in this assessment | Ops follow-up |
| — | — | No P0/P1 product defects found in M3 workflow | — |

---

## 16. Release Blockers

1. **Production migration verification** — mandatory; currently impossible from this environment (P1001).
2. Confirm production env has correct `DATABASE_URL` / `DIRECT_URL`, Auth.js `AUTH_SECRET`, and either OIDC or intentionally configured fail-closed temp auth.
3. Post-migrate smoke: promote → approve → baseline on production data path.

Functional completeness is **not** a release blocker.

---

## 17. Recommended Next Actions

1. **Operator:** Execute §13 migrate deploy against the real production database; attach migrate status evidence to release notes.
2. **Operator:** Confirm backup/restore for the managed Postgres instance.
3. **Product:** Proceed to **M4 — Product UX & Design System** once functional M3 is accepted (this document). M4 remains the best next milestone: lifecycle is correct; UX density, keyboard, and visual system are the largest remaining product gaps—not missing scenario workflow features.
4. **Do not** start M4 feature redesign inside this acceptance branch.

---

## 18. Evidence Appendix

| Artifact | Path |
|---|---|
| M3D-D acceptance | `docs/PI-SCENARIO-M3D-ACCEPTANCE.md` |
| Lifecycle matrix | `docs/acceptance-assets/m3e/lifecycle-matrix.json` |
| Browser result | `docs/acceptance-assets/m3e/browser-result.json` |
| Performance bench | `docs/acceptance-assets/m3e/performance-bench.json` |
| Screenshots | `docs/acceptance-assets/m3e/screenshots/` |
| Perf script | `scripts/m3e-performance-bench.mts` |
| Architecture | `docs/PROJECT-PLATFORM-M3-SCENARIO-ARCHITECTURE.md` |
| Deploy / auth runbooks | `docs/DEPLOYMENT-VERCEL.md`, `docs/PRODUCTION-AUTH-RUNBOOK.md` |

### Milestone lines

```
M3 FUNCTIONALLY COMPLETE
M3 FUNCTIONALLY COMPLETE — PRODUCTION RELEASE BLOCKED
```

(Do **not** claim `M3 PRODUCTION RELEASE READY` until production migrate status is evidenced.)
