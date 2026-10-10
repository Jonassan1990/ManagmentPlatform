# Project Platform — M5F-A Visual Polish

**Status:** `M5F-A COMPLETE — READY FOR M5F-B`  
**Date:** 2026-10-10  
**Baseline main SHA (pre-merge):** `839d8c061ca8ae993cf59f23a38e3e7964615983` (M5E-C)  
**Branch:** `cursor/m5fa-visual-polish-60bb`  
**Related:** [PROJECT-PLATFORM-DESIGN-SYSTEM.md](./PROJECT-PLATFORM-DESIGN-SYSTEM.md), [PROJECT-PLATFORM-M5E-FINAL-ACCEPTANCE.md](./PROJECT-PLATFORM-M5E-FINAL-ACCEPTANCE.md)

---

## 1. Objective

Make major workspaces visually coherent and professional using the existing navy/teal design system—without a new component library, reporting warehouse, or business-logic changes.

## 2. Scope reviewed

| Workspace | Primary surfaces polished |
|---|---|
| Home | `home-dashboard-view.tsx`, `src/app/page.tsx` |
| Initiative | `initiative/workspace.tsx`, initiative stage pages |
| Governance | `governance-workspace.tsx`, governance/decisions/approvals pages |
| Project | `project-workspace.tsx`, project stage page |
| PI Planning | workspace, compare, selection, promotion, approval panels |
| Resource Planning | `portfolio-capacity-dashboard.tsx`, capacity route |
| Portfolio | dashboard, explorer, delivery health |
| Reports | `reports-workspace.tsx`, reports route |
| Organization | org hub EmptyState CTAs / focus |

## 3. Improvements shipped

### 3.1 Token coherence (hex debt)

- Replaced reference hex chrome (`#e2e8eb`, `#74848e`, `#89969e`, `#98a5ad`, `#087f78` literals, `rounded-[11px]`, ad-hoc elevation shadows) with semantic tokens: `--line`, `--muted`, `--color-accent`, `--radius-lg`, `--shadow-md`, `--surface`, `--bg`, `--accent-soft`.
- Chart/band fills on capacity and compare tracks map to `--color-error` / `--color-warning` / `--color-info` / `--color-accent` instead of one-off oranges/reds/blues.
- Resource Planning (largest residual from M5E) fully tokenized.

### 3.2 Typography & hierarchy

- Shared `.ds-eyebrow` utility for section eyebrows (accent, uppercase, tracking).
- Page titles continue on display font via `PageHeader` / workspace headers.
- KPI labels stay muted; values use sidebar/ink emphasis with tabular nums where present.

### 3.3 Cards, spacing, action hierarchy

- Elevated panels use `rounded-lg` + `border-[var(--line)]` + `bg-[var(--surface)]` + `shadow-[var(--shadow-md|sm)]`.
- `Panel` gains subtle `--shadow-sm` for consistent card weight.
- Reports KPIs use `.ds-kpi-rail` (left accent rail).
- Empty-state primary CTAs standardized to `min-h-11`, `--color-primary`, hover brightness, focus-ring.

### 3.4 Status, charts, states

- Existing `StatusBadge` / `CapacityBar` / `EmptyState` / `Alert` / `LiveRegion` retained—no new kit.
- Chart tracks use token borders/fills; `.ds-chart-track` / `.ds-chart-fill` available for incremental adoption.
- Empty/error paths unchanged in meaning; presentation uses tokenized Alert/EmptyState surfaces.

### 3.5 Interaction & accessibility

- Unified `focus-visible` outline to `--color-focus-ring` across shell links and workspace CTAs.
- Home links that only had `hover:underline` now include focus-visible rings.
- `.ds-link` / `.ds-interactive` utilities with `prefers-reduced-motion` disable.
- Global reduced-motion rule unchanged; polish utilities respect it.

### 3.6 What we did **not** change

- No new component library.
- No KPI formulas, AuthZ, schema, or reporting warehouse.
- No excessive gradients or decorative motion.
- Domain status enums untouched.

## 4. Before / after evidence

| Pair | Before | After |
|---|---|---|
| Resource Planning | `docs/acceptance-assets/m5fa/before/01-resource-planning.png` (M5E-C baseline) | `docs/acceptance-assets/m5fa/after/01-desktop-resource-planning.png` |
| Reports (capacity) | `docs/acceptance-assets/m5fa/before/02-report-capacity.png` | `docs/acceptance-assets/m5fa/after/01-desktop-reports.png` |
| Mobile reports | `docs/acceptance-assets/m5fa/before/03-mobile.png` | `docs/acceptance-assets/m5fa/after/04-mobile-reports.png` |
| Additional after set | — | Home, Portfolio, PI, Initiatives, Organization, tablet, reduced-motion, viewer under `docs/acceptance-assets/m5fa/after/` |

Browser QA script: `scripts/m5fa-browser-qa.mjs` → `artifacts/m5fa-qa/qa-result.json`.

## 5. Quality gates

| Gate | Result |
|---|---|
| Typecheck | (recorded in PR CI / local run) |
| Lint | (recorded in PR CI / local run) |
| Unit | (recorded in PR CI / local run) |
| Integration | (recorded in PR CI / local run) |
| Build | (recorded in PR CI / local run) |
| Browser QA | `scripts/m5fa-browser-qa.mjs` — desktop/tablet/mobile, reduced motion, focus, viewer persona, hex-debt scan |

## 6. Business behavior preservation

- Routes, AuthZ, report contracts, capacity query CURRENT-only rules, and KPI sources unchanged.
- Viewer persona still reaches authorized Reports workspace; mutate CTAs remain role-gated by existing logic.

## 7. Residual / follow-ups (M5F-B)

- Optional: migrate remaining custom util bars to `CapacityBar` where density allows.
- Optional: adopt `DataTable` on selected hubs (explicitly deferred).
- Usability copy / IA refinements belong in **M5F-B**.

---

**STATUS:** `M5F-A COMPLETE — READY FOR M5F-B`
