# PROJECT PLATFORM — M5E FINAL ACCEPTANCE

## Resource Planning, KPI & Reporting Acceptance

**Status:** M5E COMPLETE — READY FOR M5F  
**Verdict:** **PASS**  
**Date:** 2026-10-10  
**Role:** Enterprise QA Architect / BI Data Quality Reviewer / Security Auditor  
**Nature:** Verification + acceptance documentation. No new product features beyond evidence harnesses.

| Field | Value |
|---|---|
| Starting main SHA | `8eabe5c` (M5E-B / PR #79) |
| Expected ancestors | M5E-A `fcad7e8` (PR #78), M5E-B `8eabe5c` (PR #79) — **verified** |
| Branch | `cursor/m5ec-resource-reporting-acceptance-60bb` |
| Prerequisites | [M5E-A](./PROJECT-PLATFORM-M5E-A-RESOURCE-WORKSPACE.md), [M5E-B](./PROJECT-PLATFORM-M5E-B-REPORTS.md), [M5 Design §5A/§9](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md) |

---

## 1. Executive summary

Resource Planning, executive KPIs, and Reports compose **existing** portfolio / capacity-policy / governance contracts. Service reconcile proves capacity hours match `CapacityService`, shared membership % prevents double-counting, portfolio KPIs match snapshot sources, report filters preserve department scope, CSV cells match preview, cross-org export is denied, formula injection is neutralized, unavailable metrics are not coerced to zero, and as-of timestamps are present. Browser QA covers Resource Planning + report preview/export/print for Admin, Viewer, and Department Manager, including mobile controls and keyboard focus.

**Acceptance:** **PASS** — no P0/P1 defects. Ready for M5F visual polish.

---

## 2. Baseline

| Check | Result |
|---|---|
| Latest `origin/main` at start | `8eabe5c` Merge PR #79 (M5E-B) |
| M5E-A Resource Planning | Merged PR #78 (`fcad7e8`) |
| M5E-B Reports / CSV / print | Merged PR #79 (`8eabe5c`) |
| Vercel Production (M5E-A/B) | Deployed via merge pipeline |

---

## 3. Acceptance matrix

| Criterion | Evidence | Result |
|---|---|---|
| Resource capacity reconciles with CapacityService | `m5ec-reconcile` availΔ=0 commitΔ=0 | **PASS** |
| Shared Resources not double-counted | membership % ≤50 on shared rows (4 rows) | **PASS** |
| Portfolio KPIs reconcile with source services | active initiatives / delayed match snapshot | **PASS** |
| Report filters match UI filters | dept project rows ≤ org rows | **PASS** |
| CSV values match report preview | first preview cell present in CSV | **PASS** |
| Scope isolation holds | department filter + cross-org deny | **PASS** |
| No unauthorized export | export API 400/403 for foreign org | **PASS** |
| CSV injection safely handled | `=1+1` → `'=1+1`; browser CSV safe | **PASS** |
| Missing data not represented as zero | UNAVAILABLE / null KPIs; no coercion | **PASS** |
| As-of timestamps visible | snapshot / report / capacity + UI `report-as-of` | **PASS** |
| Print layouts usable | print control + `@media print` CSS | **PASS** |
| Responsive and accessible controls | mobile filters; report type focusable | **PASS** |

---

## 4. Reconcile summary

Script: `scripts/m5ec-reconcile.mts`  
Artifact: `artifacts/m5ec-qa/reconcile.json`

| Check id | Result |
|---|---|
| capacity-ready | PASS |
| capacity-reconciles-capacity-service | PASS |
| shared-resources-present | PASS |
| shared-resources-not-full-per-team | PASS |
| project-segments-bounded-by-committed | PASS |
| kpi-active-initiatives-reconcile | PASS |
| kpi-delayed-reconcile | PASS |
| report-filters-department-scope | PASS |
| csv-matches-preview-first-cell | PASS |
| csv-includes-as-of-in-service-path | PASS |
| unavailable-not-coerced-zero | PASS |
| csv-injection-neutralized | PASS |
| as-of-snapshot / as-of-report / as-of-capacity | PASS |
| cross-org-report-denied | PASS |

**Reconcile verdict:** PASS (16/16)

---

## 5. Browser QA

Script: `scripts/m5ec-browser-qa.mjs`  
Evidence: `artifacts/m5ec-qa/` · `docs/acceptance-assets/m5ec/screenshots/`

| # | Scenario | Result |
|---|---|---|
| 0 | Service reconcile gate | PASS |
| 1 | Resource Planning workspace | PASS |
| 2 | Report preview / export / print | PASS |
| 3 | CSV export | PASS |
| 4 | CSV injection safe | PASS |
| 5 | Unauthorized export | PASS |
| Personas | viewer, department-manager | PASS |
| 6 | Mobile a11y controls | PASS |
| 7 | Keyboard focus report type | PASS |

---

## 6. Security review (export path)

| Topic | Finding |
|---|---|
| AuthZ | Preview action + `/api/reports/export` use `authz.requirePrincipal()` and underlying portfolio/PI/governance scopes — no separate export bypass |
| Bulk dump | CSV row cap 500; no audit/secret export |
| Injection | Leading `= + - @` / tab / CR neutralized with `'` prefix |
| Cross-org | Denied (FORBIDDEN / validation) |
| Governance | Principal queue only — documented limitation (not org-wide dump) |

---

## 7. Quality gates

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS (0 errors) |
| unit | PASS |
| integration (capacity suite; prior M5E-A) | PASS |
| build | PASS |
| reconcile | PASS |
| browser QA | PASS |

---

## 8. Defects

No P0/P1 opened. Residual P2/P3 (pre-existing): capacity dashboard residual hex tokens (M4-FINAL / M5 design debt); governance report is principal-scoped by design.

---

## 9. Evidence appendix

- `artifacts/m5ec-qa/reconcile.json`
- `artifacts/m5ec-qa/qa-result.json`
- `docs/acceptance-assets/m5ec/screenshots/01-resource-planning.png`
- `docs/acceptance-assets/m5ec/screenshots/02-report-capacity.png`
- `docs/acceptance-assets/m5ec/screenshots/03-mobile.png`
- `docs/acceptance-assets/m5ec/screenshots/persona-viewer.png`
- `docs/acceptance-assets/m5ec/screenshots/persona-department-manager.png`
- Prior: [M5E-A](./PROJECT-PLATFORM-M5E-A-RESOURCE-WORKSPACE.md), [M5E-B](./PROJECT-PLATFORM-M5E-B-REPORTS.md)

---

**STATUS:** `M5E COMPLETE — READY FOR M5F`
