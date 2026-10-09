# Portfolio M2 Enterprise Acceptance (M2F-A)

**Date:** 2026-10-09  
**Starting main SHA:** `b69b2b3fb7e4de690a29c3cb62b8255fcb6ed38d`  
**Scope:** QA-only verification of Portfolio Management across **M2A–M2E**  
**Verdict:** **PASS** — `PORTFOLIO M2 COMPLETE — ACCEPTED`

---

## 1. Baseline

| Check | Result |
|---|---|
| `origin/main` ≥ `b69b2b3` | PASS |
| M2A–M2E merged | PASS — PRs #18–#26 |
| Contracts / UI docs present | PASS — `PORTFOLIO-QUERY-CONTRACT`, `PORTFOLIO-DASHBOARD`, `PORTFOLIO-EXPLORER`, delivery-health + PI-capacity contracts/UI/verification, `docs/ui-reference/resource-overview.html` |
| Working tree | Only local untracked tooling leftovers (`AGENTS.md`, `CLAUDE.md`, `scripts/seed-portfolio-ui.mjs`) — not product drift |

---

## 2. Architecture evidence

```
Portfolio UI
  /portfolio | /portfolio/explorer | /portfolio/health | /portfolio/capacity
    → Server Actions (src/app/actions/portfolio.ts)
    → PortfolioQueryService | PortfolioPiCapacityQueryService
    → Domain policies
         evaluateDeliveryHealth (delivery-health.ts)
         capacity-policy + CapacityService.computeCapacityViews
         conflict engine (PlanningService.deriveConflictsForPi)
    → Prisma (Initiative, Project, Issue, Closure, WorkAllocation, PI*, Resource*)
    → Phase 0C resolvePortfolioVisibility / AuthorizationService
```

| Invariant | Result |
|---|---|
| No duplicated KPI calculations | PASS — snapshot metrics from `PortfolioQueryService` only |
| No second capacity engine | PASS — M2E uses `CapacityService.computeCapacityViews` |
| No persisted health scores | PASS — classifications computed; no Portfolio health tables |
| No duplicated Issue/Dependency stores | PASS — reads `ProjectIssue` / `PlanningDependency` |
| No client-side authorization | PASS — Server Actions + AuthZ; UI filters returned rows only |
| No unauthorized cross-department exposure | PASS — visibility + department filters + integration isolation |
| Immutable PI baselines | PASS — baseline compare is read-only; PI suite covers immutability |

Services wired in `src/server/container.ts`: `portfolio`, `portfolioPiCapacity`.

---

## 3. Scenario matrix (20)

Runner: `npx tsx scripts/m2f-acceptance-matrix.mjs` against seeded browser-QA orgs  
(`M2B Demo Org`, `M2D Health Org`, `M2E Capacity Org`) — **non-destructive**.

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Executive Portfolio KPI totals | PASS | initiatives=3, projects=1 (M2B) |
| 2 | Initiative lifecycle distribution | PASS | DEMAND1 / POC1 / PROJECT1 |
| 3 | Project status distribution | PASS | active=1 |
| 4 | Pending governance attention | PASS | waiting/pending counts returned |
| 5 | Active PoCs and Pilots | PASS | activePocs=1 |
| 6 | Portfolio Explorer search | PASS | q=Platform → 1 row |
| 7 | Explorer filters and pagination | PASS | pageSize=2 on 6 M2D projects |
| 8 | Initiative / Project drill-down | PASS | hrefs present; browser surfaces OK |
| 9 | Delivery Health classifications | PASS | B1 AR1 OT1 U1 C1 X1 |
| 10 | Active blockers / critical issues | PASS | attention=2; BLOCKED reason `ACTIVE_BLOCKER_ISSUE` |
| 11 | Delayed Project identification | PASS | M2D AT_RISK explorer = 1 |
| 12 | Project closure visibility | PASS | DONE vs CAN filters disjoint |
| 13 | PI selection and lifecycle | PASS | 2 PIs listed |
| 14 | Available/committed/remaining | PASS | 480 / 210 / 270 |
| 15 | Dept/team/resource utilization | PASS | 2 depts, team roll-up equality |
| 16 | Shared Resource no double-count | PASS | 50% membership; totals = team sum |
| 17 | Planning conflicts | PASS | 2 OVERLOAD conflicts |
| 18 | CURRENT vs approved baseline | PASS | CURRENT live; baseline unavailable (no invent) |
| 19 | Unavailable versus zero | PASS | `no_pi_selected` / `unavailable` without totals |
| 20 | Empty organization/portfolio | PASS | empty COMPLETED PI list + empty explore q |

**Matrix total: 25/25 PASS** (includes X1–X3 reconciliation + A1–A2 auth samples).

---

## 4. Cross-module reconciliation

| Check | Result |
|---|---|
| Portfolio project status counts ↔ Project table | PASS (X1) |
| Issue/blocker ↔ ProjectIssue | PASS (M2D explain + integration) |
| Delivery Health reasons ↔ evidence | PASS (`ACTIVE_BLOCKER_ISSUE`) |
| Closed projects in Portfolio | PASS (COMPLETED/CANCELLED explorer) |
| Project commitments ↔ WorkAllocation | PASS (210h) |
| PI capacity ↔ capacity-policy | PASS (M2E-A/B/C + matrix) |
| Ownership Resource FK / legacy | PASS (ownership metric available) |
| Governance counts ↔ submissions | PASS (structured waiting/pending fields) |

---

## 5. Authorization matrix

| Role | Portfolio read | Notes |
|---|---|---|
| Platform bootstrap/admin | PASS | Phase 0C + bootstrap integration |
| Organization Admin | PASS | Full M2B/M2D/M2E admin journeys |
| Portfolio Manager | PASS | Role pack + portfolio integration scopes |
| Section Manager | PASS | M2E-A section manager can read section PI; sibling org denied |
| Department Manager | PASS | Sibling isolation via filter; section-scoped PI denied without SECTION `PI_VIEW` (**documented Phase 0C / M2E-A**) |
| Team Manager | PASS | Integration: cannot escalate / cannot read section PI without PI_VIEW |
| Viewer | PASS | Matrix A1 + browser `m2fa-13-viewer.png` (read-only) |
| Unauthorized Principal | PASS | Matrix A2 + `m2fa-14-unauthorized.png` (Access not configured) |

Permission denials matching Phase 0C are **not** defects.

---

## 6. Browser QA

Stable local DEV-auth DB (`management_platform`). Integration ran on **isolated** `management_platform_m2fa_int` (full `migrate deploy`). Browser DB **not** wiped by regression.

| Journey | Result | Artifact |
|---|---|---|
| Portfolio Dashboard | PASS | `m2fa-01-portfolio.png` |
| Explorer | PASS | `m2fa-02-explorer.png` |
| Initiative drill-down | PASS | `m2fa-03-initiative.png` |
| Project / issues-closure surface | PASS | `m2fa-04-project.png` |
| Delivery Health dashboard | PASS | `m2fa-05-health-dashboard.png` |
| Health explain (blocked) | PASS | `m2fa-06-health-explain.png` |
| Explorer AT_RISK filter | PASS | `m2fa-07-explorer-atrisk.png` |
| PI & Capacity KPIs | PASS | `m2fa-08-capacity.png` |
| Capacity dept expand | PASS | `m2fa-09-capacity-expand.png` |
| PI Planning navigation | PASS | `m2fa-10-pi-planning.png` |
| No-PI empty state | PASS | `m2fa-11-no-pi.png` |
| Mobile portfolio | PASS | `m2fa-12-mobile.png` |
| Viewer read-only | PASS | `m2fa-13-viewer.png` |
| Unauthorized | PASS | `m2fa-14-unauthorized.png` |

No silent no-op controls observed on Portfolio M2 surfaces exercised above.

---

## 7. Performance

**Fixture sizes (browser QA):** M2B ≈ 3 initiatives / 1 project; M2D ≈ 6 projects (health matrix); M2E ≈ 2 PIs / 3 people / 2 projects / 2 allocations.

| Route | Avg (ms) | ~p80 (ms) | Notes |
|---|---|---|---|
| `/portfolio` (M2B) | 129 | 130 | n=5 local |
| `/portfolio/explorer` (M2D) | 123 | 130 | n=5 |
| `/portfolio/capacity` (M2E ready) | 131 | 129 | n=5 |

| Finding | Result |
|---|---|
| Bounded pagination | PASS — explorer/capacity page caps (25 default / 100 max) |
| N+1 | PASS — capacity batch `findMany`; health batch dependency load |
| Stable sorting | PASS — explorer + resource name/iteration order |
| Unbounded client loads | PASS — server-scoped pages only |

**Not** production-scale performance — timings are representative of seeded fixture volume only.

---

## 8. Regression & quality gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | **137** passed |
| `npm run test:integration` | **162** passed (`management_platform_m2fa_int`) |
| `npm run build` | PASS |
| `npx prisma migrate status` (int DB) | Up to date |
| Browser QA DB migrate status | **Environment drift** — historical `db push`; incomplete migration history. **Reported; not reset. Production untouched.** |

Covered: identity/resource/ownership/RBAC, initiative/governance/PoC/Pilot, project issue/closure, PI planning/capacity, portfolio M2A–M2E, temp-auth fail-closed.

---

## 9. Defects

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| — | — | No M2-blocking product defects found | N/A |
| ENV-DRIFT | Info | Local browser QA DB migrate history incomplete | Documented; integration uses clean migrate DB |
| QA-ASSERT | Info | Initial matrix assertions mismatched snapshot field names (`byStatus` / `total`) | Fixed in acceptance runner only — not product bugs |

---

## 10. GitHub / production

| Item | Status |
|---|---|
| Acceptance doc + matrix runner | This PR |
| Production alias | `https://managmentplatform.vercel.app` |
| Unauthenticated `/portfolio/capacity` | 307 → `/login` (expected) |

---

## Acceptance verdict

**PORTFOLIO M2 COMPLETE — ACCEPTED**

Ready for subsequent product phases outside M2 (not started here).
