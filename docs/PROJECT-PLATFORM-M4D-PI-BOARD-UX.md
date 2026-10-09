# Project Platform — M4D-A PI Planning Board & Scenario Management UX

**Status:** M4D-A COMPLETE (presentation / IA only)  
**Date:** 2026-10-09  
**Starting main SHA:** `ec89271aeac13c14fa12dfd986bbec67c18638e3`  
**Branch:** `cursor/m4d-a-pi-board-ux-60bb`  
**Related:** [PROJECT-PLATFORM-M4-UX-AUDIT.md](./PROJECT-PLATFORM-M4-UX-AUDIT.md) (UX-002), [PROJECT-PLATFORM-DESIGN-SYSTEM.md](./PROJECT-PLATFORM-DESIGN-SYSTEM.md), [PROJECT-PLATFORM-NAVIGATION-ARCHITECTURE.md](./PROJECT-PLATFORM-NAVIGATION-ARCHITECTURE.md)

**Scope:** Reduce cognitive load on `/pi/[piId]/board` without changing Prisma, capacity formulas, scenario lifecycle rules, AuthZ, promotion/approval/baseline semantics, or Review workflow (M4D-B).

---

## 1. Before / after UX

### Before (baseline on `ec89271`)

| Area | Behavior |
|---|---|
| Hierarchy | ScenarioModeBanner + always-open ScenarioPanel (create/clone/rename/lifecycle grids) above the board |
| Scenario admin | Three form columns + lifecycle list always visible — competed with allocation |
| Status | Plain text `· DRAFT` / `CURRENT` chips; no StatusBadge |
| Capacity cells | Ad-hoc thin bar + hours text; `conflictCount` unused |
| Allocation forms | Short labels; no cancel; mobile backlog missing `revisionId` |
| Navigation | Compare link only when ≥2 scenarios; no Board → Review shortcut |

### After (M4D-A)

| Area | Behavior |
|---|---|
| **A. Planning context** | Strip with PI status badge, revision badge (CURRENT vs scenario), capacity summary via `CapacityBar`, conflict/overload/read-only alerts |
| **B. Planning workspace** | Unchanged DnD MIME types + Server Actions; CapacityBar + conflict chips + empty-cell hints |
| **C. Scenario management** | Compact revision chips + Compare/Review links; **Manage scenarios** disclosure (default collapsed on CURRENT) |
| Status | M4B `StatusBadge` + `mapScenarioStatusBadge` / `mapPiStatusBadge`; copy clarifies Selected/Promoted ≠ Approved |
| Allocation | Clearer labels/hints, cancel, client validation, loading disables duplicate submit; scenario `revisionId` on mobile backlog |

---

## 2. Component decisions

| Component | Decision |
|---|---|
| `ScenarioPanel` | Owns context strip + selector + disclosed admin; preserves all scenario Server Actions |
| `ScenarioModeBanner` | Kept/exported with Alert + StatusBadge; board page uses panel context instead of a second banner |
| `CapacityBar` | Used for board-total summary and per-cell capacity; `unavailable` when service capacity is null / no slots |
| `StatusBadge` | Presentation only via existing adapters |
| `PlanningBoard` `CellBody` | Replaced custom util bar; surfaces `conflictCount`; empty-state copy |
| `MoveWorkForm` / `AllocateWorkForm` | Label/hint/cancel/validation polish; same actions + Zod path |
| Board page | Aggregates `capacityViews` / `conflicts` for display totals only (no new formulas) |

**Not introduced:** new board framework, drag library, Prisma fields, RBAC changes, Review redesign.

---

## 3. Usability measurements (counted controls / steps)

Counts are for an Org Admin on CURRENT with ≥1 DRAFT scenario, desktop viewport, before interacting with “Manage scenarios”.

| Metric | Before | After | Notes |
|---|---|---|---|
| Visible primary controls above board (approx.) | ~14 (banner + chips + 3 forms × fields/buttons + lifecycle) | ~6 (context + chips + Compare + Review + Manage toggle) | Admin fields move behind disclosure |
| Steps to create a scenario | 1 (visible form) → fill → submit | 2 (open Manage) → fill → submit | +1 expand; frequent path still short |
| Steps to edit allocation (form path) | Expand card → Move → submit | Expand → Move → Save / Cancel | Cancel added; same depth |
| Steps to reach Compare | 1 click (if ≥2 scenarios) | 1 click | Still one click; pre-fills active scenario when possible |
| Steps to identify active scenario | Scan chips + banner | Context strip badge + ringed chip | Explicit “Planning context” landmark |
| Mobile navigation complexity | Scenario CRUD + filters + iteration/team selects + board | Same workspace; scenario admin collapsed; Compare/Review stay reachable | Less vertical CRUD stack |

**Claim basis:** measured control visibility and step counts above — not “looks cleaner” alone.

---

## 4. Accessibility

- Landmarks: `Planning context`, `Scenario management`, `Planning workspace`
- Scenario list is a real `<ul>`/`<li>` with links (link role preserved)
- Manage disclosure: `aria-expanded` / `aria-controls`
- Forms: labels via `FormField`; errors via `Alert` live regions
- Capacity: `CapacityBar` `role="img"` + text remaining/overload/unavailable
- Focus-visible outlines on scenario chips and nav links
- DnD alternatives unchanged (Allocate / Move forms)
- Read-only / viewer: mutating controls disabled with permission titles; selector + Compare/Review remain

---

## 5. Browser QA

Fixtures: isolated temp-auth Org Admin + Viewer where available. Evidence under `artifacts/m4da-qa/` (screenshots).

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | Open PI Planning board | Context + workspace + collapsed Manage on CURRENT | |
| 2 | Switch CURRENT / Scenario | Chip navigation keeps preserved query; context updates | |
| 3 | Create Scenario | Manage → create → lands on new DRAFT | |
| 4 | Clone Scenario | Manage → clone DRAFT | |
| 5 | Edit allocation | Move/Allocate save/cancel; no double submit | |
| 6 | Capacity / conflicts | CapacityBar + warnings; unavailable ≠ 0 | |
| 7 | Navigate Compare | Context preserved (`revs`/`ref`/`revisionId`) | |
| 8 | Return to Board | Deep link / tabs restore revision | |
| 9 | Archive scenario | Lifecycle archive; chip list updates | |
| 10 | Read-only revision | Non-DRAFT: allocate disabled + alert | |
| 11 | Viewer | No misleading enabled scenario mutations | |
| 12 | Mobile | Iteration/team selects; Manage accessible; limited tab wrap | |

---

## 6. Known limitations

- Board matrix still horizontal-scrolls on narrow desktop widths (workspace constraint, not redesigned).
- Capacity “board total” sums service team×iteration rows for display — not a new domain metric.
- Review / select / promote / approve / baseline choreography remains M4D-B.
- Compare still benefits from richer sticky multi-select (partially improved by active revision in `revs`).

---

## 7. Tests

| Suite | Coverage |
|---|---|
| `tests/unit/scenario-panel-board-ux.test.tsx` | Context, badges, disclosure, viewer, conflicts, nav context |
| `tests/unit/move-work-form-ux.test.tsx` | Labels, cancel, duplicate submit, validation, read-only, empty |
| `tests/unit/planning-board-cell-ux.test.tsx` | Empty board, conflict/CapacityBar, read-only |

Existing integration suites for scenarios / allocations remain the business-rule gate.

---

## 8. M4D-B handoff — Review workflow simplification

**In scope for M4D-B (do not start in M4D-A):**

1. Progressive disclosure of Select → Promote → Approve → Baseline on `/pi/[id]/review`
2. Singular next-action CTA per lifecycle stage
3. Carry Compare → Review selection context more explicitly
4. Reduce vertical panel stack cognitive load
5. Preserve governance semantics; presentation only

**Out of M4D-B unless separately chartered:** portfolio capacity redesign, initiative tab strip, AuthZ changes.

---

## 9. Quality gates

Run on the M4D-A branch:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
