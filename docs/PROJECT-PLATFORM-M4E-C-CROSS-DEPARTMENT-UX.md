# Project Platform — M4E-C Cross-Department Capacity & Decision UX

**Status:** M4E-C COMPLETE (presentation only)  
**Date:** 2026-10-09  
**Starting main SHA:** `5c685ae` (M4E-B merged)  
**Branch:** `cursor/m4e-c-cross-department-ux-60bb`  
**Prerequisites:** M4E-B merged and accepted ([M4E-B](./PROJECT-PLATFORM-M4E-B-CAPACITY-UX.md))

---

## 1. Objective

Improve management visibility into cross-department planning constraints on `/portfolio/capacity` without exposing unauthorized Resource details or broadening RBAC.

Users should understand overloaded teams, project dependencies on other work, capacity conflicts needing coordination, departments with available capacity, and issues needing attention.

---

## 2. UX changes

| Surface | Behavior |
|---|---|
| **Conflict explanations** | What / affected / iteration / type / severity + authorized action (inspect team, open PI dependencies, open PI board) |
| **Cross-department coordination** | Departments with remaining capacity (from returned M2E rows) |
| **Planning dependencies** | Existing `PlanningDependency` list when ORGANIZATION `PI_VIEW` succeeds; otherwise scoped/unavailable + optional portfolio snapshot counts |
| **FORBIDDEN PI_VIEW** | Explicit explanation for Department Managers denied section/org PI capacity |
| **Navigation** | Real links to PI Dependencies, PI Board, project commitments — no fake destinations |

Navy/teal StatusBadge / Alert / CapacityBar patterns preserved from M4E-B.

---

## 3. Authorization & visibility limitations

| Scenario | Result |
|---|---|
| Org Admin / org-scoped `PI_VIEW` | Full capacity + dependency list |
| Section Manager with SECTION `PI_VIEW` | Capacity for section PI; dependency list still requires ORGANIZATION `PI_VIEW` → unavailable panel + snapshot counts when available |
| Department Manager (DEPARTMENT `PI_VIEW` only) | Capacity FORBIDDEN on section/org PI — explained in UI; no sibling dept leakage |
| Cross-organization | Denied by existing actions |
| Viewer (org `PI_VIEW`) | Read-only capacity/dependencies when authorized |

**Stop conditions honored:** no new reporting permission, no client-side unrestricted fetch, no new dependency domain logic, no second capacity engine.

---

## 4. Conflict & dependency presentation

- Conflicts: `explainConflict()` over M2E `PortfolioPiConflictRow` + team/resource labels.
- Dependencies: `DependencyService.listDependencies` (existing AuthZ). Fields: status, criticality, type, owner, needed-by, description, source/target labels (project keys when in commitments).
- Missing dependency list: Alert “Scoped / unavailable” with reason; snapshot open/critical counts when portfolio metric is available.

---

## 5. Shared Resource behavior

Unchanged from M4E-B: membership % from capacity-policy; UI does not double-count full capacity per team.

---

## 6. Tests

| Suite | Coverage |
|---|---|
| `portfolio-capacity-coordination.test.ts` | Available depts, dependency mapping, conflict explanations, forbidden message, empty deps |
| `portfolio-capacity-dashboard-ux.test.tsx` | Conflict actions, dependency ready/unavailable, FORBIDDEN PI view |
| Existing `portfolio-pi-capacity.test.ts` | Sibling isolation, Dept Manager FORBIDDEN, cross-org denial (unchanged) |

---

## 7. Browser QA

Script: `scripts/m4ec-browser-qa.mjs`  
Evidence: `docs/acceptance-assets/m4ec/`

| # | Scenario | Result |
|---|---|---|
| 1 | Portfolio Capacity | PASS |
| 2 | Overloaded department | PASS |
| 3 | Team details | PASS |
| 4 | Planning conflict | PASS |
| 5 | Dependency panel / navigation | PASS |
| 6 | Project commitment | PASS |
| 7–8 | Dept Manager / Viewer | Documented — unit/integration AuthZ; browser temp-auth principal |
| 9 | Mobile layout | PASS |

---

## 8. Quality gates

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS (0 errors; 2 pre-existing warnings) |
| unit | PASS — **40** files / **271** tests |
| integration | PASS — **20** files / **190** tests |
| build | PASS |
| browser QA | PASS — `scripts/m4ec-browser-qa.mjs` (11/11) |

---

## 9. Remaining M4E-D scope

- Do **not** start M4E-D here.
- Likely themes: broader executive reporting polish, progressive disclosure follow-ups outside this coordination slice, any AuthZ product decisions for section-participating dept reads (product/AuthZ — not silent UI invent).

`M4E-C COMPLETE — STOP BEFORE M4E-D`
