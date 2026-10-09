# Portfolio PI & Capacity Verification (M2E-C)

**Date:** 2026-10-09  
**Starting main SHA:** `41d69ac4eafb590a8fce0bc196e40f10f82f0dfc`  
**Baseline:** M2E-A (PR #24) + M2E-B (PR #25) + UI reference `docs/ui-reference/resource-overview.html`  
**Contracts:** `docs/PORTFOLIO-PI-CAPACITY-CONTRACT.md`, `docs/PORTFOLIO-PI-CAPACITY-UI.md`  
**Verdict:** **PASS** — `M2E COMPLETE — READY FOR M2F FINAL PORTFOLIO INTEGRATION`

---

## 1. Architecture trace

```
UI (/portfolio/capacity)
  → Server Actions (listPortfolioProgramIncrementsAction | getPortfolioPiCapacityAction)
  → PortfolioPiCapacityQueryService
  → CapacityService.computeCapacityViews + capacity-policy
     + PlanningService.deriveConflictsForPi
     + PiBaseline payload compare (read-only)
  → Prisma (ProgramIncrement, PlanningRevision, WorkAllocation, Resource*, …)
  → Phase 0C resolvePortfolioVisibility / AuthZ (PI_VIEW + dept scope)
```

| Check | Result |
|---|---|
| Single capacity calculation path | PASS — `computeCapacityViews` / `capacity-policy` only |
| No second allocation ledger | PASS — no Portfolio capacity tables; WorkAllocation remains SOT |
| No fabricated workstream % | PASS — UI bars = committed vs available hours |
| No client-side capacity recalculation | PASS — client only sums M2E-A hours for multi-iteration display and reuses `utilizationBand` |
| Immutable baselines preserved | PASS — compare reads payload; never writes baselines |
| CURRENT vs baseline distinguishable | PASS — `meta.revision.isCurrent` + `baselineComparison` |
| Org / department scoping | PASS — visibility + participating-team filter + AuthZ |

---

## 2. Capacity scenario matrix

Evidence: `npx tsx scripts/m2e-qa-matrix.mjs` (browser-QA DB, non-destructive) + `tests/integration/portfolio-pi-capacity.test.ts` (14 cases on isolated `management_platform_m2ec_int`).

| Scenario | Expected | Result | Evidence |
|---|---|---|---|
| No PI | Clear empty state | PASS | matrix + UI `m2ec-08-no-pi.png` |
| No participating teams | Unavailable, not zero | PASS | matrix + UI `m2ec-09-unavailable.png` |
| Valid zero committed hours | Display 0 | PASS | integration `distinguishes valid zero…` |
| Shared Resource | No double counting | PASS | matrix (membership 50%; totals = team sum) |
| Resource availability override | Correct effective capacity | PASS | integration |
| Multiple Projects | Correct committed hours | PASS | matrix 200+10=210 |
| Overloaded Team | Overload indicator | PASS | matrix + KPI/conflict UI |
| Underutilized Team | Remaining capacity shown | PASS | matrix + Reliability 4% |
| CURRENT revision | Live planning metrics | PASS | `meta.source=live_capacity_policy` |
| Approved baseline | Historical snapshot unchanged | PASS | integration (40 baseline vs 70 live) |
| Unsupported baseline version | Explicit unavailable | PASS | integration `schemaVersion: 99` |
| Planning conflict | Conflict-engine result | PASS | matrix + 2 BLOCKER rows |
| Department Manager | No sibling data / AuthZ | PASS | filter isolates; section PI denied without SECTION PI_VIEW (by design) |
| Team Manager | Only permitted scope | PASS | integration team-manager denial |
| Viewer | Read-only | PASS | matrix + `m2ec-11-viewer.png` |
| Unauthorized user | Denied | PASS | matrix + `m2ec-13-unauthorized.png` |

---

## 3. Query / UI reconciliation

| Check | Result |
|---|---|
| KPI totals ↔ query | PASS — 480 / 210 / 270 / 44% |
| Dept ↔ team hours | PASS — matrix roll-up equality |
| Utilization math | PASS — committed/available |
| Project commitments ↔ WorkAllocation | PASS — 200+10=210 |
| Conflict counts | PASS — 2 ↔ conflict engine |
| Filters | PASS — overload filter + departmentId scope |
| Unavailable ≠ 0 | PASS — empty/unavailable UIs |

---

## 4. Authorization matrix

| Principal | Outcome |
|---|---|
| Org admin (DEV) | Full capacity ready |
| Org viewer | Ready, read-only KPIs |
| Department manager (dept A) | FORBIDDEN on section-scoped PI (`Missing PI view permission.`) — matches M2E-A contract |
| Unauthorized (no bindings) | Access not configured / denied |

---

## 5. Browser QA

Stable local DEV-auth fixture DB (`management_platform`). Integration suite ran on **separate** `management_platform_m2ec_int` (migrate deploy). Browser DB was **not** wiped by regression.

| # | Journey | Result | Artifact |
|---|---|---|---|
| 1 | Portfolio → PI & Capacity | PASS | `m2ec-01-portfolio.png` |
| 2 | PI selection / KPIs | PASS | `m2ec-02-capacity-kpis.png` |
| 3 | Department expansion | PASS | `m2ec-03-dept-expanded.png` |
| 4 | Team/resource inspection | PASS | same |
| 5 | Overloaded-only filter | PASS | `m2ec-05-overload-filter.png` |
| 6 | Project commitment drill-down | PASS | `m2ec-06-project-drilldown.png` |
| 7 | PI Planning navigation | PASS | `m2ec-07-pi-planning.png` |
| 8 | No-PI state | PASS | `m2ec-08-no-pi.png` |
| 9 | Unavailable capacity | PASS | `m2ec-09-unavailable.png` |
| 10 | Mobile layout | PASS | `m2ec-10-mobile.png` |
| 11 | Viewer role | PASS | `m2ec-11-viewer.png` |
| 12 | Department-scoped filter / role | PASS | `m2ec-12-dept-scoped.png`, `m2ec-12-dept-manager.png` |
| 13 | Unauthorized access | PASS | `m2ec-13-unauthorized.png` |

---

## 6. Performance

| Finding | Detail |
|---|---|
| Resource pagination | Default 25 / max 100; stable name+iteration sort |
| Capacity engine queries | Batch `findMany` (iterations, teams, memberships, availabilities, allocations) — no N+1 loop |
| Client loads | Renders server payload only; filters client-side on returned rows |
| Timing (local, seeded fixture) | Capacity ready ~237 ms avg; no-PI ~126 ms avg (n=5) |
| Caching | None added |

---

## 7. Regression & quality gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | **137** passed |
| `npm run test:integration` | **162** passed (isolated int DB) |
| `npm run build` | PASS (`/portfolio/capacity` present) |
| `npx prisma migrate status` (int DB) | Database schema is up to date |
| Browser QA DB migrate status | **Environment drift** — created historically via `db push`; incomplete `_prisma_migrations` history. **Not reset.** Integration used `management_platform_m2ec_int` with full `migrate deploy`. |

Covered suites: Phase 0A/0B/0C, governance characterization, initiative/PoC/Pilot, project issues/closure, PI planning + capacity, portfolio M2A–M2D, M2E-A/B.

---

## 8. Defects

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| M2E-C-1 | Low | When `getPortfolioPiCapacityAction` fails with a PI selected, UI also showed “No PI selected”. | **Fixed** in verification PR — distinct load-failure copy. |
| ENV-DRIFT | Info | Local browser QA DB migrate history incomplete (`db push`). | Reported; production untouched. |

No capacity-formula defects. No AuthZ leakage.

---

## 9. Git / production

| Item | Status |
|---|---|
| Verification docs + seed/matrix + UX fix | PR (this branch) |
| Production alias `https://managmentplatform.vercel.app` | Live; `/portfolio/capacity` → login redirect (unauthenticated) |
| Production deployment for `41d69ac` | **success** (Vercel Production) |

Unauthenticated production probe confirms route exists and auth gate holds. No credentials used against production; no production data mutated.

---

## Acceptance

**M2E COMPLETE — READY FOR M2F FINAL PORTFOLIO INTEGRATION**
