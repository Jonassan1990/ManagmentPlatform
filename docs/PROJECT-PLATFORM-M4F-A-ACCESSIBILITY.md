# Project Platform — M4F-A Accessibility & Keyboard Interaction Hardening

**Status:** M4F-A COMPLETE (presentation / a11y only)  
**Date:** 2026-10-10  
**Starting main SHA:** `13a906a25d18cd0d7fd7660f6ccdb4b5f1f082df`  
**Branch:** `cursor/m4fa-accessibility-keyboard-60bb`  
**Prerequisites:** M4A–M4E merged and accepted ([M4E-FINAL](./PROJECT-PLATFORM-M4E-FINAL-ACCEPTANCE.md))

---

## 1. Objective

Improve keyboard and assistive-technology usability across critical workflows toward **WCAG 2.2 AA**, without changing domain rules, AuthZ, capacity engine, or portfolio calculations.

---

## 2. Changes (summary)

| Area | Fix |
|---|---|
| **App shell** | Skip link → `#main-content`; route-change focus on `<main>`; mobile nav Escape restores menu button focus; initial focus in drawer; `aria-hidden` on page chrome while drawer open; nav link focus rings + min touch height |
| **Route focus** | `RouteFocusMain` client helper after client navigations |
| **DataTable** | Sort buttons expose full `aria-label` with sort state/direction |
| **PI tabs** | Horizontal scroll (`overflow-x-auto`, nowrap) — UX-011 partial; min-h-11 tab targets |
| **Forms** | `FormField` required/error semantics; `useActionForm` assertive error Alert + focus move |
| **Button** | Global `focus-visible` ring |
| **Portfolio Explorer** | `role="search"`, `type="search"`, table `caption` + `scope="col"`, Apply filters label |
| **Delivery Health** | Attention table `caption` + `scope="col"` |
| **Scenario Compare** | Team table `caption` + `scope="col"`; utilization mini-bar `role="img"` + text label |

**Out of scope (unchanged):** Prisma, RBAC, capacity-policy, Auth, business validation rules.

---

## 3. WCAG 2.2 AA assessment (bounded)

| Criterion | Result | Notes |
|---|---|---|
| 1.3.1 Info and Relationships | **PASS** (touched tables/forms) | `scope`, captions, search role |
| 1.4.1 Use of Color | **PASS** (existing + compare bar text) | StatusBadge / overload text retained |
| 2.1.1 Keyboard | **PASS** (critical paths QA) | Shell, explorer, capacity inspect, PI tabs |
| 2.1.2 No Keyboard Trap | **PASS** | Radix dialogs; mobile nav Escape |
| 2.4.1 Bypass Blocks | **PASS** | Skip link |
| 2.4.3 Focus Order | **PARTIAL** | Route focus helps; not audited on every form |
| 2.4.7 Focus Visible | **PASS** | Global `:focus-visible` + component rings |
| 3.3.1 Error Identification | **PARTIAL** | FormField error role; not all forms wired |
| 3.3.2 Labels or Instructions | **PARTIAL** | Explorer labels; initiative forms incremental |
| 4.1.2 Name, Role, Value | **PARTIAL** | Sort buttons, capacity/compare visuals |
| Full 2.2 AA certification | **NOT VERIFIED** | Manual audit incomplete — **M4F-B** |

Legend: **PASS** = evidenced on touched surfaces; **NOT VERIFIED** = not fully audited.

---

## 4. Keyboard / browser QA

Script: `scripts/m4fa-browser-qa.mjs`  
Evidence: `docs/acceptance-assets/m4fa/`

| Step | Result |
|---|---|
| Skip to main | PASS |
| Mobile nav focus + Escape | PASS |
| Explorer search + Apply filters | PASS |
| PI tabs focusable | PASS |
| Capacity Inspect keyboard | PASS |
| Mobile capacity | PASS (screenshot) |

**Verdict:** PASS (6/6 steps) — `docs/acceptance-assets/m4fa/qa-result.json`

Principal: Org Admin temp-auth (`owner`). Desktop 1440 + mobile 390.

---

## 5. Tests

| Suite | Coverage |
|---|---|
| `route-focus-main.test.tsx` | Main focus on pathname change |
| `ui-data-table-a11y.test.tsx` | Sort `aria-label` + click |
| Existing `ui-dialog.test.tsx` | Focus trap / Escape / error alert |
| Existing `ui-data-table.test.tsx` | Caption / columnheader |

**Counts (this verification):** unit **43** files / **280** tests PASS.

---

## 6. Quality gates

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | _(run at merge)_ |
| unit | PASS — 280 tests |
| integration | _(run at merge)_ |
| build | _(run at merge)_ |

---

## 7. Remaining M4F-B scope

- Full WCAG 2.2 AA manual audit + optional axe CI on key routes
- Wire `aria-describedby` / `aria-invalid` on all initiative/project/governance form controls
- PI Planning Board grid keyboard model (cell roving tabindex)
- Live-region strategy for async filter/sort results
- Multi-role browser personas (Viewer, Dept Manager)
- Color-contrast spot check on sidebar + warning tones
- Complete `aria-describedby` wiring for `FormField` children (pattern doc + adoption)

Do **not** start M4F-B in this phase.

`M4F-A COMPLETE — STOP BEFORE M4F-B`
