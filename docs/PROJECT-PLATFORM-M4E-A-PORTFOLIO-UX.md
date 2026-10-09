# Project Platform — M4E-A Executive Portfolio Dashboard UX

**Status:** M4E-A COMPLETE (presentation only)  
**Date:** 2026-10-09  
**Starting main SHA:** `5eebfe7070186e8799e891c1dcffd1069d5f50e9`  
**Branch:** `cursor/m4e-a-portfolio-dashboard-ux-60bb`  
**Prerequisites:** M4A–M4D merged and accepted ([M4D-FINAL](./PROJECT-PLATFORM-M4D-FINAL-ACCEPTANCE.md))

---

## 1. Objective

Transform `/portfolio` into a clear executive management workspace with three information levels, without inventing metrics or changing PortfolioQueryService / Delivery Health / capacity engines.

---

## 2. Information hierarchy

| Level | Section | Content (existing contracts only) |
|---|---|---|
| **1** | Executive summary | Active initiatives, Active projects, Delayed projects, Blocked projects (health BLOCKED when available), Pending governance, PI capacity status badge |
| **2** | Management attention | Blocked / At-risk CTAs, Pending approvals & decisions, Critical dependencies, Delayed slips, Delivery health counts + attention list |
| **3** | Portfolio insights | Lifecycle & project status distributions, PoC/Pilot summary, Capacity overview (`CapacityBar` preview), Ownership behind `<details>` |

Inspiration: `docs/ui-reference/resource-overview.html` (teal accent bars, compact KPI chrome) — **no mock data**.

---

## 3. Implementation decisions

- **No domain changes** — rearrange and label `PortfolioSnapshot` + delivery-health payloads only.
- **Blocked KPI** prefers `healthSummary.counts.BLOCKED`; falls back to snapshot active blockers if health unavailable.
- **Return context** — Approvals / Decisions / Initiatives / PI / Capacity links use `from=portfolio`.
- **Scope form** preserves `healthFocus` when applying org/dept.
- **Progressive disclosure** — Ownership collapsed by default; capacity shows top 6 teams.
- **Missing metrics (reported, not invented):** trends, scores, budgets, section rollups on hub, per-issue deep links from aggregates.

---

## 4. Before / after usability

| Metric | Before (pre-M4E-A) | After |
|---|---|---|
| KPI cards immediately visible | 4 equal cards | **6** prioritized executive KPIs with accent bars + action labels |
| Steps to find blocked projects | Scan health section mid-page | **1** click “Filter blocked” / “Review blocked” |
| Steps to open attention project | Scroll to list | **1** click row (when rows exist) |
| Steps to pending governance | Find card mid-page | **1** click “Open approvals” (with return context) |
| Scope banner primary links | 5 (Explorer, Capacity, Org, Initiatives, PI) | **3** (Explorer, Capacity, Delivery health) |
| Ownership density | Always-open table | Collapsed disclosure |
| Mobile | Long undifferentiated stack | Same 3 levels; measured overflow flagged if >40px |

Screenshots: `docs/acceptance-assets/m4ea/screenshots/`

---

## 5. Authorization

Unchanged: `getPortfolioSnapshotAction` / delivery-health actions remain server-scoped. UI does not filter unauthorized rows client-side. Empty/FORBIDDEN states preserved on the page.

---

## 6. Accessibility

- Landmark sections with Level labels + `h2` ids
- KPI / attention links: min touch height + focus-visible rings
- StatusBadge for capacity / attention signals (not color-only)
- Ownership `summary` keyboard operable
- CapacityBar `role="img"` labels reused

---

## 7. Browser QA

Script: `scripts/m4ea-browser-qa.mjs`  
Evidence: `artifacts/m4ea-qa/`

| # | Scenario | Result |
|---|---|---|
| 1 | Org Admin dashboard | PASS |
| 2 | Three-level hierarchy | PASS |
| 3 | Executive KPIs | PASS |
| 4 | Blocked focus | PASS / SKIP if empty |
| 5 | Pending governance + return | PASS |
| 6 | Drill-down project + return | PASS / SKIP if no rows |
| 7 | Capacity status | PASS |
| 8 | Ownership disclosure | PASS |
| 9 | Tablet | PASS |
| 10 | Mobile | PASS |

Viewer / empty-portfolio destructive fixtures: covered by unit empty state + existing AuthZ integration (browser Viewer persona remains limited to single temp-auth principal — same as M4D).

---

## 8. Quality gates

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS (0 errors; 2 pre-existing warnings) |
| unit | PASS — **38** files / **246** tests |
| integration | PASS — **20** files / **190** tests |
| build | PASS |
| browser QA | PASS |

---

## 9. Remaining M4E-B scope

- Resource & Capacity workspace redesign (UX-006 progressive PI default)
- Richer stacked capacity visuals vs reference
- Dept/resource progressive disclosure on Capacity page
- Do **not** expand into capacity engine or RBAC changes here

`M4E-A COMPLETE — READY FOR M4E-B RESOURCE & CAPACITY UX`
