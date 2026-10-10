# Project Platform — M4F-B Responsive UX & Accessibility Hardening

**Status:** M4F-B COMPLETE (presentation / a11y / responsive only)  
**Date:** 2026-10-10  
**Starting main SHA:** `1adf80592432f7a59362c4ee5200e8011f06c00a`  
**Branch:** `cursor/m4fb-responsive-a11y-60bb`  
**Prerequisites:** [M4F-A Accessibility](./PROJECT-PLATFORM-M4F-A-ACCESSIBILITY.md), [M4E-FINAL](./PROJECT-PLATFORM-M4E-FINAL-ACCEPTANCE.md)

---

## 1. Objective

Improve mobile/tablet usability and close bounded accessibility gaps from M4F-A toward **WCAG 2.2 AA**, without changing domain rules, AuthZ, Prisma, capacity engine, scenario semantics, or portfolio query contracts.

**Full WCAG 2.2 AA certification: NOT VERIFIED** — evidence is bounded to touched surfaces and automated/manual smoke QA.

---

## 2. Responsive changes

| Surface | Change |
|---|---|
| **Form controls** | `fieldClassName` gains `min-h-11` + focus-visible ring (touch targets) |
| **Portfolio Explorer** | Unified filter control height; horizontal scroll regions labeled; pagination min-h-11; mobile cards retained |
| **DataTable** | Focusable scroll region + label; responsive `min-w`; sort live announcement |
| **Dialog** | Viewport-bounded width (`max-w-[calc(100vw-1rem)]`), `90dvh` max height, tighter mobile padding |
| **PI Board** | Scrollable matrix region labeled; reduced min widths on small/medium; keyboard hint callout |
| **Scenario compare** | Diff/team tables: captions, `scope`, scroll region labels, softer min-width |
| **Capacity hierarchy** | Live filter result announcement (presentation only) |
| **App shell** | Sidebar muted text opacities raised for contrast (`white/75`–`white/85`) |

---

## 3. Accessibility changes

| Area | Fix |
|---|---|
| **FormField** | Clones single control child → `aria-invalid`, `aria-describedby` (hint/error), `aria-required` (from prop or HTML `required`); visual `*` for required |
| **Initiative forms** | `AddCriterionForm` + `CreateRelationForm` labeled via FormField + ErrorAlert |
| **LiveRegion** | Polite `role="status"` helper for explorer results, table sort, capacity filters, scenario compare summary, board filter status |
| **WorkCard** | `Details / Move` control with `aria-expanded` + conflict text alternative |
| **PI Board keyboard** | Essential allocate/move remain form-based (no new DnD). Hint documents keyboard path. **Cell roving tabindex deferred** (see gaps) |
| **Contrast** | Measured token pairs (see §5); sidebar muted labels brightened; disabled tokens remain N/A per inactive UI |

**Unchanged:** validation rules, RBAC, Prisma, capacity-policy math, Auth.

---

## 4. Viewport matrix

Script: `scripts/m4fb-browser-qa.mjs`  
Evidence: `docs/acceptance-assets/m4fb/`

| Width | Home | Explorer | Capacity | Notes |
|---|---|---|---|---|
| 360 | PASS | PASS | PASS | Screenshots `vp-360-*` |
| 390 | PASS | PASS | PASS | Mobile nav Escape |
| 768 | PASS | PASS | PASS | Tablet |
| 1024 | PASS | PASS | PASS | Sidebar appears (`lg`) |
| 1440 | PASS | PASS | PASS | Desktop |

Checks: no unintended **page-level** horizontal overflow; Apply filters reachable; dense tables use labeled overflow regions.

---

## 5. Color contrast spot check

| Pair | Ratio | Result |
|---|---|---|
| `--muted` `#5b6b7c` on `--bg` `#f4f6f8` | ~5.05 | **PASS** (AA normal text) |
| `--muted` on `--surface` | ~5.47 | **PASS** |
| `--sidebar-ink` on `--sidebar` | ~11.2 | **PASS** |
| White on `--accent` button | ~9.5 | **PASS** |
| Warning / error on soft surfaces | ≥6.3 | **PASS** |
| Disabled FG on disabled BG | ~2.2 | **N/A** (inactive component exception) |
| Sidebar group labels (raised to ~white/80) | ≥4.5 | **PASS** (post-fix) |

Semantic status meanings unchanged.

---

## 6. WCAG 2.2 AA matrix (bounded)

| Criterion | Result | Notes |
|---|---|---|
| 1.3.1 Info and Relationships | **PASS** (touched) | FormField / captions / scope |
| 1.4.1 Use of Color | **PASS** | StatusBadge + CapacityBar text; conflict labels |
| 1.4.3 Contrast (Minimum) | **PARTIAL** | Spot-checked tokens; not full UI inventory |
| 1.4.10 Reflow | **PARTIAL** | 360–1440 smoke; dense tables scroll intentionally |
| 2.1.1 Keyboard | **PASS** (critical paths) | Shell, explorer, capacity, Move forms |
| 2.1.2 No Keyboard Trap | **PASS** | Radix dialogs; mobile nav Escape |
| 2.4.1 Bypass Blocks | **PASS** | Skip link (M4F-A) |
| 2.4.3 Focus Order | **PARTIAL** | Route focus + forms; not every page audited |
| 2.4.7 Focus Visible | **PASS** | Global + field + nav rings |
| 2.5.5 Target Size | **PARTIAL** | min-h-11 on key controls; not universal |
| 3.3.1 Error Identification | **PASS** (FormField / useActionForm) | Pattern rolled out; not every field-level error wired |
| 3.3.2 Labels or Instructions | **PASS** (touched forms) | Criterion / relation labeled |
| 4.1.2 Name, Role, Value | **PARTIAL** | Sort, live regions, board Move; grid cells not arrow-navigable |
| 4.1.3 Status Messages | **PARTIAL** | LiveRegion on explorer/capacity/sort/compare |
| Full 2.2 AA certification | **NOT VERIFIED** | → **M4F-C** / later audit |

---

## 7. Keyboard QA

| Step | Result |
|---|---|
| Mobile nav open + Escape | PASS |
| Explorer live region after filter URL | PASS |
| PI board keyboard hint + Details/Move (when cards exist) | PASS |
| Capacity hierarchy live region | PASS |
| Main landmark present | PASS |

**PI Planning grid:** Essential operations use **Allocate** / **Move** forms (keyboard). HTML5 DnD remains pointer-optional. Full cell **roving tabindex** not implemented — **severity MEDIUM**, architectural (would need careful focus model across sticky headers + drag sources). Deferred to M4F-C backlog or later specialized milestone.

---

## 8. Tests

| Suite | Coverage |
|---|---|
| `ui-form-field-a11y.test.tsx` | aria-required / describedby / invalid |
| `ui-live-region.test.tsx` | polite status |
| `ui-data-table-a11y.test.tsx` | sort announce + scroll region |
| `ui-dialog-responsive.test.tsx` | viewport-bounded dialog classes |
| `work-card-keyboard-ux.test.tsx` | Details/Move + conflict text |
| `planning-board-cell-ux.test.tsx` | keyboard hint |
| `move-work-form-ux.test.tsx` | updated label matchers |

Unit count at verification: **287** tests PASS.

---

## 9. Quality gates

| Gate | Result |
|---|---|
| typecheck | **PASS** |
| lint | **PASS** (0 errors; 2 pre-existing warnings) |
| unit | **PASS** — 47 files / 287 tests |
| integration | _(in progress / at merge)_ |
| build | _(in progress / at merge)_ |

---

## 10. Remaining gaps → M4F-C handoff

**M4F-C — Role-based UX acceptance (do not start here):**

- Multi-role browser acceptance (Viewer, Dept Manager, Team Manager, Project Manager) against responsive + a11y surfaces
- Capability-filtered shell smoke per persona
- Confirm no AuthZ leakage in UI affordances (presentation only)
- Optional: axe CI on key routes; fuller contrast inventory
- Optional: PI board cell roving tabindex (if product prioritizes grid keyboard parity)

Also remaining from M4F-A/B:

- Wire `FormField` `error=` prop from server field errors where domain returns field maps (still form-level ErrorAlert today — no validation rule changes)
- Universal 44×44 target audit outside touched controls

Do **not** start M4F-C in this phase.

`M4F-B COMPLETE — READY FOR M4F-C ROLE-BASED UX ACCEPTANCE`
