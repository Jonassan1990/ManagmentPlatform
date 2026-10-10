# PROJECT PLATFORM — M5D-A

## Premium PI Planning & Allocation Workspace

**Status:** IMPLEMENTED  
**Phase:** M5D-A — PI Planning language + planning chrome (presentation only)  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `4e42a5d` (M5C-D merged)  
**Branch:** `cursor/m5da-pi-workspace-60bb`

**STOP:** Does **not** implement M5D-B (Review UX polish beyond existing M4D-B stepper).

**Related:** [M5 Design §8](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md), [M5C Final Acceptance](./PROJECT-PLATFORM-M5C-FINAL-ACCEPTANCE.md), [M4D-A Board UX](./PROJECT-PLATFORM-M4D-PI-BOARD-UX.md), [Design System](./PROJECT-PLATFORM-DESIGN-SYSTEM.md)

---

## 1. Workspace architecture

### Trace

```
/pi/[piId]/board
  → PiPlanningContextHeader (PI, period, current plan/scenario, capacity rollup)
  → PiTabs (Plan board · Compare · Capacity · …)
  → ScenarioPanel (switcher + progressive Manage scenarios)
  → PlanningBoard (iterations × teams, DnD + Allocate/Move forms)

/pi/[piId]/capacity
  → PiPlanningContextHeader
  → CapacityKpiStrip (available / committed / remaining / overload / conflicts)
  → CapacityPanels (existing tables + CapacityBar)
```

No new ledger, CapacityService formulas, conflict engine, or client-side utilization policy. Rollups sum existing `getCapacityViews` / board capacity rows.

### Vocabulary (primary UI)

| Avoid | Prefer |
|---|---|
| CURRENT / CURRENT plan | **Current plan** |
| Active revision | **Scenarios** / Active plan |
| Create from CURRENT | **Create from current plan** |
| Planning board (tab) | **Plan board** |
| Selected for review | **Selected scenario** |
| Promoted | **Applied to current plan** |

Technical revision UUIDs remain in URLs (`revisionId`) and Settings/audit only.

---

## 2. Planning context

| Field | Source |
|---|---|
| PI reference / title | ProgramIncrement |
| PI status | `StatusBadge` via `mapPiStatusBadge` |
| Planning period | `startDate` → `endDate` |
| Active plan | Current plan vs Scenario · {label} |
| Teams | Participating team slot count from capacity views |
| Available / committed / remaining | Sum of service hours |
| Editability | Current / draft / read-only / viewer permission copy |
| Readiness | Overload slots + blocker conflicts from existing views |

---

## 3. Plan board

- Shared header answers: which PI, period, current vs scenario, capacity, what can be edited.
- Scenario chips use human labels; Compare / Review stay primary.
- **Manage scenarios** disclosure (default collapsed on current plan): create, clone, rename, archive (`ConfirmDialog`).
- Planning grid unchanged: drag-and-drop + keyboard Allocate/Move forms preserved.

---

## 4. Capacity

- Same planning context header (always current-plan identity on this route).
- KPI strip: Available, Committed, Remaining, Overloaded, Blocker conflicts.
- Detail tables + per-row `CapacityBar` unchanged.
- Links to Plan board and Portfolio Capacity.

---

## 5. Scenario actions

| Action | Where |
|---|---|
| Switch | Scenario chips |
| Compare | Primary link + header CTA |
| Review | Primary link |
| Create / Clone / Rename / Archive | Progressive disclosure |
| Apply to current plan | Review flow (labels; existing promotion service) |

---

## 6. Screenshots

`docs/acceptance-assets/m5da/screenshots/` via `scripts/m5da-browser-qa.mjs`:

| File | Journey |
|---|---|
| `01-plan-board.png` | Planning context + scenarios |
| `02-manage-scenarios.png` | Progressive disclosure |
| `03-capacity.png` | Capacity KPIs |
| `04-compare.png` | Compare entry |
| `05-planner-editable.png` | Planner edits |
| `06-viewer.png` | Viewer mode |
| `07-mobile.png` / `08-desktop-capacity.png` | Responsive |

---

## 7. Role-aware UX

| Persona | Behavior |
|---|---|
| Planner / Org Admin | Editable current plan or draft; manage scenarios when permitted |
| Viewer | Readable board/capacity; manage actions disabled with permission copy |
| Read-only scenario (SELECTED/PROMOTED) | Allocation forms disabled; explicit read-only status |

---

## 8. Tests & QA

| Suite | Coverage |
|---|---|
| `tests/unit/pi-planning-presentation-m5da.test.ts` | Vocabulary, editability, capacity rollup |
| `tests/unit/scenario-panel-board-ux.test.tsx` | Updated Current plan copy |
| `tests/unit/status-adapters.test.ts` | Scenario badge labels |
| Browser | `scripts/m5da-seed-browser.mts` + `m5da-browser-qa.mjs` |

---

## 9. M5D-B handoff

**M5D-B** should:

- Polish Review stepper copy (Select → Apply to current plan → Approve → Baseline)
- Keep M5D-A board/capacity chrome and vocabulary
- Not reopen capacity-policy or scenario lifecycle semantics

---

## 10. Quality gates

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
- `node scripts/m5da-browser-qa.mjs`
