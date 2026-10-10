# PROJECT PLATFORM — M5B-C

## Premium Home Dashboard — UX, Data & Role-Based Acceptance

**Status:** M5B COMPLETE — READY FOR M5C INITIATIVE & PROJECT WORKSPACES  
**Verdict:** **PASS**  
**Date:** 2026-10-10  
**Role:** Principal Product UX Architect / Enterprise QA Architect / Accessibility Reviewer / Senior Frontend Architect  
**Nature:** Verification + acceptance documentation. No new product features. No unrelated redesigns.

| Field | Value |
|---|---|
| Starting main SHA | `92f71c890c62ea77a420498125ea740562725cbb` (M5B-B / PR #69) |
| Expected minimum ancestor | `92f71c8` — **verified** |
| Branch | `cursor/m5bc-home-acceptance-60bb` |
| Prerequisites | [M5A Design](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md), [M5B-A Contract](./PROJECT-PLATFORM-M5B-HOME-CONTRACT.md), [M5B-B UI](./PROJECT-PLATFORM-M5B-HOME-UI.md), [Design System](./PROJECT-PLATFORM-DESIGN-SYSTEM.md) |
| Production deploy (baseline) | Vercel Production deployment for `92f71c8` — **success** |

---

## 1. Executive Summary

Home provides an intuitive, role-aware starting point for managers, employees, mixed-role users, and viewers. One server composition path (`getHomeDashboardAction` → `HomeDashboardQueryService`) feeds a single presentation component (`HomeDashboardView`). KPIs reconcile to Portfolio / Delivery Health / PI Capacity sources. My Work uses `Resource.linkedPrincipalId` + ownership FKs only. Quick Start renders only authorized `availableActions`. Unavailable metrics are never coerced to zero.

**Acceptance:** **PASS** — no P0/P1 defects. Ready for M5C Initiative & Project Workspaces.

---

## 2. Baseline

| Check | Result |
|---|---|
| Latest `origin/main` at start | `92f71c8` Merge PR #69 (M5B-B) |
| M5A Product Experience Design | Present |
| M5B-A Home Dashboard Query Contract | Merged PR #68 (`86a64dd`) |
| M5B-B Premium Home UI | Merged PR #69 (`92f71c8`) |
| Working tree (tracked product files) | Clean at baseline SHA |
| Vercel Production for `92f71c8` | Success |

---

## 3. Architecture Verification

### Trace

```
src/app/page.tsx
  → getHomeDashboardAction (src/app/actions/home.ts)
    → HomeDashboardQueryService.getHomeDashboard
      → PortfolioQueryService / PortfolioPiCapacityQueryService
      → InitiativeService / PlanningService / GovernanceService
      → OrganizationService / AuthorizationService
      → Prisma
  → HomeDashboardView (presentation only)
```

| Requirement | Result | Evidence |
|---|---|---|
| One Home query composition path | **PASS** | Single action call in `page.tsx`; one service composer |
| No duplicate KPI engine | **PASS** | Metrics keyed from snapshot / health / capacity services |
| No client-side capacity calculations | **PASS** | UI passes server totals into `CapacityBar`; no domain formulas in React |
| No fabricated assignments | **PASS** | My Work via `linkedPrincipalId` + ownership FKs; free-text decoys excluded |
| No unauthorized data fetching | **PASS** | Preferred org must be listable; cross-org → `FORBIDDEN` |
| No new business logic in React | **PASS** | `HomeDashboardView` is presentational |
| Respects `authorizedScope` / `sourceOfTruth` / `availability` / `drillDown` / `asOf` | **PASS** | Contract sections carry meta; UI gates on `availability.state` |

**INTEGRATION VERIFIED:** `tests/integration/home-dashboard-m5b.test.ts` — 16/16 passed.  
**HARNESS VERIFIED:** `scripts/m5bc-kpi-reconcile.mts` — 32/32 checks on `management_platform_m5bc_accept`.

---

## 4. Persona Matrix

| Persona | Mode | Browser | Integration / harness | Notes |
|---|---|---|---|---|
| Manager (Org Admin, no Resource) | `manager` | **BROWSER VERIFIED** | PASS | Attention + Quick Start create; My Work `no_linked_resource` |
| Employee (Viewer + linked Resource) | `employee` | **BROWSER VERIFIED** | PASS | My Work first; create hidden |
| Mixed (Portfolio Manager + Resource) | `mixed` | **BROWSER VERIFIED** | PASS | Attention ∥ My Work; no duplicate KPIs/work |
| Viewer (no Resource) | `employee` packaging | **BROWSER VERIFIED** | PASS | Read-only Quick Start; no create/manage/governance |
| Principal without linked Resource | `manager` | **BROWSER VERIFIED** | PASS | Clear no-link explanation; no fabricated ownership |
| Unbound (no RoleBindings, orgs exist) | n/a | INTEGRATION (empty world) | PASS | With orgs present: `FORBIDDEN` (no fabricated dashboard) |
| Multi-org Admin | `manager` | **BROWSER VERIFIED** | PASS | `MULTI_ORG_SCOPE` warning; preferred-org metrics |

Navigation visibility ≠ authorization. Server `assertCan` remains authoritative.

---

## 5. My Work Correctness

| Check | Result | Evidence |
|---|---|---|
| Attribution via `Resource.linkedPrincipalId` | **PASS** | Integration + reconcile harness |
| Initiative / Project ownership FKs | **PASS** | Employee sees `INIT-M5BC-1`, `PRJ-M5BC-1` |
| No free-text name matching | **PASS** | `INIT-DECOY` excluded |
| No duplicate work items | **PASS** | Mixed harness `no_duplicate_work` |
| Correct reference / title / status / drill-down | **PASS** | Browser My Work → initiative project tab |
| Governance queues via RoleBinding permissions | **PASS** | Contract: `listMyApprovals` / `listMyDecisions` |
| No fabricated work without Resource | **PASS** | Manager `no_linked_resource` reason text |

---

## 6. KPI Reconciliation

Isolated DB: `management_platform_m5bc_accept`.  
Source comparison: Home metrics vs `getPortfolioSnapshot` / `getDeliveryHealthSummary`.

| Home metric | Source | Expected | Home | Result |
|---|---|---|---|---|
| Active Initiatives | `getPortfolioSnapshot.initiatives.value.total` | 4 | 4 | **PASS** |
| Active Projects | `getPortfolioSnapshot.projects.value.active` | 2 | 2 | **PASS** |
| Delayed Projects | `getPortfolioSnapshot.delayedProjects.value.delayedProjects` | 0 | 0 | **PASS** |
| Pending Governance | snapshot governance waiting sums | 0 | 0 | **PASS** |
| Blocked / at-risk | `getDeliveryHealthSummary.attentionCount` → `needsAttention.counts` | 0 | 0 | **PASS** |
| Overloaded Teams | `getPortfolioSnapshot.piCapacity…` | `null` (unavailable) | `null` | **PASS** |
| Capacity (no PI) | `getPiCapacityOverview` path | empty; totals null | empty; totals null | **PASS** |

Unavailable overloaded-teams rendered as null / unavailable reason — **not** zero.  
Empty org: active initiatives `0` when available; unavailable capacity stays null.

Current PI / utilization / available-committed-remaining: verified on browser fixture org (M2E Capacity Org) via capacity drill-down; Home Capacity section uses CURRENT-revision overview when a PI entry exists.

---

## 7. Attention & Quick Start

### Needs Attention

| Check | Result |
|---|---|
| Items from real delivery/overview/PI signals | **PASS** |
| Severity / status understandable | **PASS** (blocker/warning/info + labels) |
| Actionable destinations valid | **BROWSER VERIFIED** → `/portfolio/health` |
| No fake notifications | **PASS** |
| Empty state honest when no attention | **PASS** (contract empty availability) |

### Quick Start (`availableActions` only)

| Action | Manager | Employee / Viewer | Route check |
|---|---|---|---|
| Create Initiative | Shown | Hidden | **BROWSER** `/initiatives/new?from=home…` |
| Projects / Portfolio | Shown | Shown (read) | **BROWSER** `/portfolio` |
| PI Planning | Shown | Shown when permitted | **BROWSER** `/pi` |
| Resource Planning / Capacity | Shown | Shown (view) | **BROWSER** `/portfolio/capacity…` |
| Governance | Shown when permitted | Hidden for Viewer | Integration + UI |

No unauthorized create/manage actions for Viewer/Employee packaging.

---

## 8. Empty / Unavailable States

| Scenario | Result |
|---|---|
| Empty organization | **PASS** — zeros when available; not unavailable-as-zero |
| No active Initiative / Project | **PASS** (empty org metrics) |
| No assigned work / no linked Resource | **PASS** — `no_linked_resource` copy |
| No current PI / capacity | **PASS** — capacity `empty`; totals null |
| Missing permissions | **PASS** — Viewer create hidden; forbidden sections null |
| Temporary query failure | Contract: `unavailable` + null values (UI em dash) — no silent zero |
| Unbound with orgs present | **PASS** — `FORBIDDEN` (secure fail closed) |

---

## 9. Multi-Org Authorization

| Check | Result | Evidence |
|---|---|---|
| Selected / preferred organization context | **PASS** | Harness + browser multi-org |
| Scoped metrics / attention / Quick Start | **PASS** | Preferred org only |
| `MULTI_ORG_SCOPE` warning | **PASS** | Harness + browser signal |
| Cross-org preferred scope denied | **PASS** | Integration + harness `FORBIDDEN` |
| No client-side security filtering | **PASS** | Server org listability gate |

---

## 10. Browser QA

**Fixture:** isolated PostgreSQL `management_platform_m3d_qa`, org **M2E Capacity Org** (`f6b317a2-…`), PI `c9cf896f-…`.  
**Method:** Playwright + RoleBinding persona swap (`scripts/m5bc-switch-persona.mjs`, `scripts/m5bc-browser-qa.mjs`). Non-destructive.  
**Base URL:** `http://127.0.0.1:43152`  
**Evidence:** `artifacts/m5bc-acceptance/`, `docs/acceptance-assets/m5bc/screenshots/`

| Journey | Result |
|---|---|
| 1. Manager Home | **PASS** |
| 2. Employee Home | **PASS** |
| 3. Mixed Home | **PASS** |
| 4. Viewer Home | **PASS** |
| 5. No-linked-Resource Home | **PASS** |
| 6. Quick Start | **PASS** |
| 7. My Work navigation | **PASS** |
| 8. Attention navigation | **PASS** |
| 9. Portfolio KPI drill-down | **PASS** |
| 10. Current PI | **PASS** |
| 11. Resource Capacity | **PASS** |
| 12. Empty / unavailable | **PASS** |
| 13. Multi-org scope | **PASS** |
| 14. Mobile (390×844) | **PASS** — no horizontal overflow |
| 15. Tablet (768×1024) | **PASS** |
| 16. Desktop (1280×800) | **PASS** |

Screenshots: `01-manager-home` … `11-empty-unavailable` (reproducible fixture descriptions in `browser-qa-result.json`).

HTTP 200 alone was **not** treated as acceptance — DOM assertions, navigation targets, persona visibility, and overflow checks were required.

---

## 11. Usability Measurements

Structural step counts from first Home paint (not a human user study). **Do not treat as proof of real-user success.**

| Goal | Path | Steps |
|---|---|---|
| Find Create Initiative | Quick Start → Create Initiative | **1** |
| Find My Work | Employee first-screen section | **0** |
| Open assigned Project | My Work item link | **1** |
| Locate blocked / attention | Needs Attention → Delivery health | **1** |
| Open PI Planning | Quick Start / PI link → `/pi` | **1** |
| Inspect Resource Capacity | Capacity → PI & capacity | **1** |
| Find pending Governance | Home governance / Approvals link | **1** |

| Qualitative | Observation |
|---|---|
| First-screen clarity | Manager: Attention + Quick Start; Employee: My Work; Mixed: both without role switcher |
| Visual hierarchy | Mode headline + teal accents; KPI left rails |
| Control density | Acceptable; primary Quick Start subset emphasized |
| Unnecessary clicks | Core tasks ≤ 1 click from Home |
| Navigation continuity | `from=home&fromOrg=` return context preserved |
| Readability | Status text + labels; unavailable as em dash |

30-second discoverability remains a **usability goal**, not measured with representative users in this acceptance.

---

## 12. Accessibility

| Check | Result |
|---|---|
| Semantic heading hierarchy | **PASS** — single `h1`; section `h2`s (`a11y.desktop-manager` / mobile) |
| Keyboard navigation | **PASS** — Tab reaches focusables (41 on desktop Home) |
| Focus visibility | Design-system focus rings on interactive controls |
| Accessible card / link names | KPI `aria-label`; Quick Start / My Work link text |
| Status text | StatusBadge + availability panels |
| KPI labels | Visible label + unavailable aria |
| CapacityBar text alternatives | `role="img"` + `aria-label` with hours / utilization |
| Alert semantics | Unavailable sections expose `role="status"` (sr-only) where applicable |
| Mobile touch targets | Primary links / CTAs use `min-h-11` |
| No unintended horizontal overflow | **PASS** desktop / tablet / mobile |

### Remaining WCAG 2.2 AA gaps (honest)

1. Full automated axe / WCAG suite not re-executed as a gate in M5B-C (smoke only).
2. Some dense KPI grids may still challenge 1.4.10 Reflow at extreme zoom beyond tested viewports.
3. Live region announcements for async Home reload are limited (Server Component; full page navigation).
4. Color is not the sole status channel, but contrast of muted secondary text should remain under M4F-A monitoring.

No new AA regressions identified versus M4F-A / M5B-B baseline in this smoke.

---

## 13. Performance

| Measurement | Value | Notes |
|---|---|---|
| Home load (browser, median) | **1186 ms** | domcontentloaded → main/h1/h2; fixture org |
| Manager Home | 1347 ms | First persona after login/session |
| Employee / Mixed / Viewer | 1089–1170 ms | Persona swaps |
| Multi-org | 1306 ms | |
| Server composition harness | **1740 ms** | Full seed + multi-persona reconcile wall time |
| Data requests per Home paint | **1** action | `getHomeDashboardAction` only |
| Duplicate client fetching | **None** | No client SWR/refetch loop on Home |
| Client bundle | Server Component Home | No Home-specific client KPI engine |
| N+1 | Contained in composer | Uses existing portfolio/PI services; no second KPI engine |

Representative fixture: M2E Capacity Org (initiatives, projects, PI, capacity data). Not a synthetic 200-item stress bench (covered historically in M3E).

---

## 14. Regression

| Area | Result | Evidence |
|---|---|---|
| Authentication / temp-auth session | **PASS** | Browser session + login redirect behavior |
| Phase 0C RBAC | **PASS** | Cross-org deny; Viewer create hidden |
| Organization scoping | **PASS** | Preferred org + multi-org warning |
| Portfolio M2 snapshot / health | **PASS** | KPI reconciliation |
| PI Capacity | **PASS** | Capacity empty/available contract + browser drill-down |
| Initiative / Project navigation | **PASS** | Quick Start + My Work |
| Governance entry points | **PASS** | Authorized actions only |
| M4 Navigation shell | **PASS** | Primary nav present across personas |
| M5B-A query contract | **PASS** | 16/16 integration tests |

---

## 15. Defect Register

| ID | Severity | Description | Disposition |
|---|---|---|---|
| — | — | No P0/P1/P2 defects confirmed in M5B-C acceptance | — |

P3 observations (non-blocking):

| ID | Severity | Description | Disposition |
|---|---|---|---|
| M5BC-P3-1 | P3 | Full axe suite not re-run this phase | Track under ongoing a11y; M4F-A remains baseline |
| M5BC-P3-2 | P3 | Unbound principal with existing orgs fails closed via `FORBIDDEN` rather than a dedicated Home empty state | Secure; empty-world `no_organization` remains integration-covered |

No narrowly scoped product fixes required for acceptance.

---

## 16. Remaining M5C Work

**STOP — do not implement in M5B-C.**

Recommended M5C scope (Initiative & Project Workspaces):

1. Initiative workspace IA aligned with M5A (overview, demand, governance, delivery tabs continuity).
2. Project workspace depth (work items, milestones, health) with return-context from Home My Work / Active Projects.
3. Consistent empty/unavailable patterns already proven on Home.
4. Preserve single query composition — no parallel KPI engines on Initiative/Project surfaces.
5. Persona-aware primary actions (create vs read) without role-switcher UX.

---

## 17. Evidence Appendix

| Artifact | Path |
|---|---|
| KPI reconcile report | `artifacts/m5bc-acceptance/kpi-reconcile.json` |
| Browser QA result | `artifacts/m5bc-acceptance/browser-qa-result.json` |
| Browser QA log | `artifacts/m5bc-acceptance/browser-qa-log.txt` |
| Home integration log | `artifacts/m5bc-acceptance/home-integration.log` |
| Screenshots | `docs/acceptance-assets/m5bc/screenshots/` |
| Harness scripts | `scripts/m5bc-kpi-reconcile.mts`, `scripts/m5bc-browser-qa.mjs`, `scripts/m5bc-switch-persona.mjs` |
| Contract / UI docs | M5B-A / M5B-B docs above |

### Quality gates (pre-merge)

Recorded in PR checks / local run:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration` (isolated DBs)
- `npm run build`

### Final statement

**M5B COMPLETE — READY FOR M5C INITIATIVE & PROJECT WORKSPACES**
