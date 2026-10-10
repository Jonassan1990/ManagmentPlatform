# PROJECT PLATFORM — M5E-A

## Premium Resource Planning & Capacity Workspace

**Status:** IMPLEMENTED  
**Phase:** M5E-A — Resource Planning workspace (presentation + additive capacity enrichment)  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `d362c61` (M5D-C merged)  
**Branch:** `cursor/m5ea-resource-workspace-60bb`

**STOP:** Does **not** implement M5E-B (Reports / exports).

**Related:** [M5 Design §9](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md), [M4E-B Capacity UX](./PROJECT-PLATFORM-M4E-B-CAPACITY-UX.md), [UI reference](./ui-reference/resource-overview.html), [Portfolio PI Capacity Contract](./PORTFOLIO-PI-CAPACITY-CONTRACT.md)

---

## 1. Objective

Create a professional, understandable Resource Planning experience on `/portfolio/capacity` so managers see department/team/resource capacity, utilization, overload, available hours, project commitments, and PI planning context — without inventing FTE/workstream percentages or duplicating the Resource ledger.

---

## 2. Workspace architecture

### Trace

```
/portfolio/capacity
  → PageHeader "Resource Planning"
  → ScopeForm (org / department / PI)
  → A. Planning context (PI, period, CURRENT plan, baseline)
  → B. Executive capacity summary (KPIs)
  → D. Management attention (overload / conflicts / shortages)
  → C. Department → Team → Resource hierarchy
       · Stacked project commitment bars (real WorkAllocation hours)
       · Project legend · search · overloaded-only · team filter
  → Project commitments + Shared resource policy
  → Conflict / dependency panels (M4E-C)
```

Shell nav label: **Resource Planning** (was “PI & capacity”). Return-context crumb and Home quick links use the same label.

### Data path

| Concern | Source |
|---|---|
| Available / committed / remaining / band | `capacity-policy` via `PortfolioPiCapacityQueryService` (CURRENT only) |
| Membership % | Canonical policy — not project load |
| Stacked bar segments | CURRENT `WorkAllocation` → `Project` hours per resource×team×iteration |
| Project commitments panel | Same allocation breakdown (portfolio totals) |
| Conflicts | Existing conflict engine |
| Dependencies | `DependencyService` + portfolio snapshot counts (scoped) |

No client-side utilization formulas. No second Resource ledger. Draft scenarios never appear as authoritative load.

---

## 3. Target UX checklist

| Target | Implementation |
|---|---|
| Clear PI/period selection | Scope form PI select + planning context section |
| Executive capacity summary | KPI strip (available, committed, remaining, util, overloaded, conflicts) |
| Expandable Dept → Team → Resource | `DepartmentCard` with `aria-expanded` |
| Stacked allocation bars from real data | `projectSegments` + `buildProjectStackSegments` |
| Overloaded-only filter | Hierarchy checkbox |
| Search | Departments / people |
| Conflict & dependency panels | Management attention + M4E-C panels |
| Contextual nav to PI / Project | Open PI Planning + project commitment links |

**Not invented:** FTE %, workstream category shares, mock legend categories from the HTML reference.

---

## 4. Contract enrichment (additive)

`PortfolioPiResourceCapacityRow.projectSegments: PortfolioPiResourceProjectSegment[]`

- Populated from the same CURRENT allocations used for project commitments.
- Empty when no project load — UI falls back to the committed-load bar.
- Aggregation across iterations merges hours by `projectId`.

Unchanged: CapacityService formulas, capacity-policy, Authorization, Prisma schema, Resource membership semantics.

---

## 5. Authorization / scoped visibility

- Server actions remain Phase 0C scoped; UI renders only returned rows.
- Department / Team Managers may see forbidden or reduced hierarchy for org/section-scoped PIs — intentional isolation.
- Viewers remain read-only; no edit surfaces on this page.
- Shared Resources: membership % from policy; full capacity not counted independently per team.

---

## 6. Browser QA

Script: `scripts/m5ea-browser-qa.mjs` (seed: `scripts/m5ea-seed-browser.mts`)  
Evidence: `artifacts/m5ea-qa/` · `docs/acceptance-assets/m5ea/screenshots/`

| # | Scenario | Result |
|---|---|---|
| 1 | Org Admin login | PASS |
| 2 | Resource Planning branding | PASS |
| 3 | Nav label | PASS |
| 4 | Executive sections A/B/C/D | PASS |
| 5 | PI selection | PASS |
| 6 | Stacked bar policy copy | PASS |
| 7 | Overloaded-only filter | PASS |
| 8 | Search empty state | PASS |
| 9 | Conflict / dependency panels | PASS |
| 10 | Shared resource policy | PASS |
| 11–12 | Contextual nav to PI | PASS |
| 13 | Unavailable PI | PASS |
| 14 | Tablet / mobile | PASS |
| Personas | org-admin, department-manager, team-manager, viewer | PASS |

---

## 7. Quality gates

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS |
| unit | PASS |
| integration (`portfolio-pi-capacity`) | PASS |
| build | PASS |
| browser QA | PASS |

---

## 8. Acceptance

M5E-A delivers a branded Resource Planning workspace with real project-stacked commitment bars, executive summary, expandable hierarchy, filters, conflict/dependency visibility, and scoped persona coverage — ready for M5E-B Reports.

**STATUS:** `M5E-A COMPLETE — READY FOR M5E-B`
