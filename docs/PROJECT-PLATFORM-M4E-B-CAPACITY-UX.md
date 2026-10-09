# Project Platform — M4E-B Resource & Capacity UX

**Status:** M4E-B COMPLETE (presentation only)  
**Date:** 2026-10-09  
**Starting main SHA:** `b7f8a9b` (M4E-A merged)  
**Branch:** `cursor/m4e-b-capacity-resource-ux-60bb`  
**Prerequisites:** M4E-A merged and accepted ([M4E-A](./PROJECT-PLATFORM-M4E-A-PORTFOLIO-UX.md))

---

## 1. Objective

Make `/portfolio/capacity` understandable for Department Managers, Team Managers, Portfolio Managers, and PI Planners — using real M2E capacity contracts and the navy/teal patterns from `docs/ui-reference/resource-overview.html`.

Users should quickly see available / committed / remaining capacity, overloaded teams, individual resource allocations, project commitments, and planning conflicts.

---

## 2. Information hierarchy

| Section | Content |
|---|---|
| **A. Planning context** | Selected PI + lifecycle badge, planning period, CURRENT live revision, baseline comparison (or unavailable reason) |
| **B. Capacity summary** | Available, committed, remaining, utilization, overloaded teams, planning conflicts (+ portfolio StatusBadge) |
| **D. Management attention** | Overloaded teams (Inspect), shortages & missing data, planning conflicts — elevated before hierarchy for scan speed |
| **C. Hierarchy** | Department → Team → Resource expand/collapse, search, team filter, overloaded-only, project commitments, shared-resource policy note |

Inspiration: `docs/ui-reference/resource-overview.html` (KPI accent bars, expandable dept cards, allocation bars, search/filters). **No mock names, percentages, or fake actions.**

---

## 3. Visual comparison vs reference

| Reference pattern | M4E-B implementation |
|---|---|
| Navy/teal enterprise chrome | App shell navy + `#087f78` accents / KPI bars |
| KPI cards | Six summary KPIs from M2E totals |
| Expandable department cards | `DepartmentCard` with `aria-expanded` / `CapacityBar` |
| Horizontal allocation bars | `CapacityBar` + committed-load track; StatusBadge for band |
| Capacity status indicators | `StatusBadge` (not color-only) |
| Search & filters | Search, team select, overloaded-only (3 controls) |
| Period / PI selector | M4C-C authorized PI select — never overrides explicit choice |
| Cross-functional commitments | Shared-resource policy panel + membership % display |
| Dependency panels | Replaced with Project commitments + Planning conflicts |

**Not copied:** mock FTE/workstream legend, Export/Plan toasts, fake stacked workstream segments.

Screenshots: `docs/acceptance-assets/m4eb/screenshots/`

---

## 4. Before / after usability

| Metric | Before (pre-M4E-B) | After |
|---|---|---|
| Steps to find overloaded team | ~4 (scan KPIs → scroll hierarchy → expand → spot band) | **1** (“Inspect team” in Management attention) |
| Steps to inspect Resource allocation | ~3 (find dept → expand → scan row) | **1–2** (Inspect / expand toggle) |
| Hierarchy controls | 3 | **3** (unchanged count; clearer grouping) |
| Hierarchy readability | Flat KPIs + dept grid | A/B/D/C landmarks + StatusBadge + CapacityBar |
| Mobile interaction effort | Scroll + expand; cramped resource columns | Same expand path; stacked resource rows; overflow measured |

---

## 5. Capacity accuracy

- Hours rendered from `PortfolioPiCapacityResult` only.
- No capacity formulas in React; display helpers sum returned hours for hierarchy presentation.
- Shared Resources: membership % from canonical capacity-policy; UI states that full capacity is not counted independently per team.
- Zero committed ≠ unavailable; missing inputs use data-quality notes.
- CURRENT live vs approved baseline labels; draft scenarios never shown as authoritative.

**Unchanged:** CapacityService, capacity-policy, WorkAllocation, ResourceMembership, PiBaseline, Prisma, Authorization, portfolio query semantics.

---

## 6. Authorization

Server actions remain Phase 0C scoped. UI renders only returned rows. PI selection preserves M4C-C authorized selection (no override of explicit `piId`).

---

## 7. Accessibility

- Landmark sections with A/B/C/D labels + `h2` ids
- Department expand: `aria-expanded`, `aria-controls`, focus-visible rings, min 44px touch targets
- CapacityBar / committed-load: `role="img"` labels
- StatusBadge for overload / near / conflicts (not color-only)
- Mobile: stacked resource rows; no horizontal-only interactions required

---

## 8. Browser QA

Script: `scripts/m4eb-browser-qa.mjs`  
Evidence: `artifacts/m4eb-qa/`

| # | Scenario | Result |
|---|---|---|
| 1 | Org Admin login | PASS |
| 2 | A/B/C/D sections | PASS |
| 3 | CURRENT / baseline labels | PASS |
| 4 | Overloaded path | PASS |
| 5 | Resource hierarchy | PASS |
| 6 | Hierarchy controls | PASS |
| 7 | Shared resource copy | PASS |
| 8 | Project commitments | PASS |
| 9 | Tablet | PASS |
| 10 | Mobile | PASS |
| 11 | Keyboard expand focus | PASS |

Viewer / Department Manager destructive fixtures: covered by unit empty/unavailable states + existing AuthZ integration (browser remains limited to temp-auth principal — same as M4E-A).

---

## 9. Quality gates

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS (0 errors; 2 pre-existing warnings) |
| unit | PASS — **39** files / **259** tests |
| integration | PASS — **20** files / **190** tests |
| build | PASS |
| browser QA | PASS — `scripts/m4eb-browser-qa.mjs` (11/11) |

---

## 10. Known limitations

- Per-resource stacked project/workstream segments are **not** in the M2E-A contract — project load is shown via Project commitments.
- Resource rows are a bounded M2E page; total may exceed visible rows.
- Browser QA Viewer / Department Manager personas share the same temp-auth principal as prior milestones.

---

## 11. Remaining M4E-C scope

- Do **not** start M4E-C in this change set.
- Expected M4E-C themes (from roadmap): further portfolio/capacity progressive defaults and any UX-006 follow-ups outside this capacity workspace slice.

`M4E-B COMPLETE — STOP BEFORE M4E-C`
