# PROJECT PLATFORM — M5E-B

## Executive KPIs, Management Reports & Exportable Outputs

**Status:** IMPLEMENTED  
**Phase:** M5E-B — Reports composition + CSV/print exports  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `fcad7e8` (M5E-A merged)  
**Branch:** `cursor/m5eb-reports-60bb`

**STOP:** Does **not** implement M5E-C (final Resource/KPI/Reporting acceptance).

**Related:** [M5 Design §5A](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md), [M5E-A Resource Workspace](./PROJECT-PLATFORM-M5E-A-RESOURCE-WORKSPACE.md)

---

## 1. Objective

Give managers actionable, trustworthy reporting outputs by composing **existing** portfolio, capacity, and governance read models — with authorized CSV export and print-friendly preview.

---

## 2. KPI catalog (existing sources only)

| KPI | Definition | Source of truth | Scope | Filters | Availability | Timestamp | Drill-down |
|---|---|---|---|---|---|---|---|
| Active initiatives | Snapshot initiative total | `PortfolioQueryService.getPortfolioSnapshot` | Org / dept | org, dept | Metric unavailable reason | `snapshot.asOf` | Portfolio / Initiatives |
| Active projects | `projects.value.active` | same | Org / dept | org, dept | Metric | `asOf` | Explorer projects |
| Blocked / at-risk | Delivery health classifications | `listDeliveryHealthAttention` | Org / dept | org, dept | Empty list ≠ zero invent | `attention.asOf` | Project workspace |
| Delayed projects | Milestone missed or planned end past | snapshot `delayedProjects` | Org / dept | org, dept | Metric | `asOf` | Explorer DELAYED |
| Pending governance | waitingForApproval + waitingForDecision | snapshot `governance` | Org / dept | org, dept | Metric | `asOf` | Approvals / Decisions |
| PI capacity utilization | Team available/committed/remaining | `PortfolioPiCapacityQueryService` → capacity-policy | Org / dept + PI | org, dept, piId | `no_pi_selected` / unavailable | capacity `asOf` | Resource Planning |
| Overloaded teams | Overload band / overloadedTeamIterations | capacity overview + snapshot piCapacity | Org / dept (+ PI) | org, dept, piId | Metric / empty | `asOf` | Resource Planning |
| Work commitments | Project commitment hours | capacity `projectCommitments` | PI CURRENT | piId | Empty = zero committed | `asOf` | Project links |
| Resource allocation | Resource×team×iteration hours + segments | capacity resources + `projectSegments` | PI CURRENT | piId | Page-bounded | `asOf` | Resource Planning |
| Milestone progress | **Not bulk-exported** | Project workspace per id | — | — | Documented limitation | — | Project |

**Not invented:** forecasts, composite scores, FTE %, workstream shares, draft-scenario capacity as authoritative load.

---

## 3. Reports implemented

| Report type | Preview | CSV | Print | Notes |
|---|---|---|---|---|
| Portfolio Summary | Yes | Yes | Yes | KPIs + attention rows |
| Project Status | Yes | Yes | Yes | Explorer PROJECT rows + delivery signals |
| PI Capacity | Yes | Yes | Yes | Team hours CURRENT; requires `piId` |
| Resource Allocation | Yes | Yes | Yes | Resource rows + project segments |
| Risks & Blockers | Yes | Yes | Yes | BLOCKED / AT_RISK attention |
| Governance Decision Summary | Yes | Yes | Yes | **Principal queue only** (not org-wide dump) |

Route: `/portfolio/reports`  
Export: `GET /api/reports/export` (same AuthZ as preview)  
Service: `ManagementReportService`  
CSV: `report-csv.ts` (formula-injection neutralization, UNAVAILABLE cells, max 500 rows)

---

## 4. Limitations (documented, not fabricated)

- No reporting warehouse / ad-hoc BI.
- No PDF pipeline (browser print CSS only).
- Governance export is principal-scoped approvals/decisions — not org-wide.
- Capacity reports are CURRENT revision only.
- Explorer / attention / resource pages are bounded (≤500 export rows).
- Milestone detail dumps require Project workspace — not bulk CSV.

---

## 5. Security

- Server-side `authz.requirePrincipal()` on preview action and export route.
- Same portfolio / PI / governance visibility as on-screen queries.
- Cross-org export denied (FORBIDDEN / validation).
- CSV cells prefixed when starting with `= + - @` / tab / CR.
- Missing metrics rendered as `UNAVAILABLE`, never coerced to `0`.
- Explicit `asOf` in preview and CSV columns / response header.

---

## 6. Browser QA

Script: `scripts/m5eb-browser-qa.mjs`  
Evidence: `artifacts/m5eb-qa/` · `docs/acceptance-assets/m5eb/screenshots/`

| # | Scenario | Result |
|---|---|---|
| 1 | Login | PASS |
| 2 | Reports entry + nav | PASS |
| 3 | Preview + as-of | PASS |
| 4 | PI capacity report | PASS |
| 5 | Resource allocation | PASS |
| 6 | CSV export + injection safety | PASS |
| 7 | Cross-org denial | PASS |
| 8 | Print control | PASS |
| 9 | Viewer | PASS |
| 10 | Department manager | PASS |
| 11 | Mobile | PASS |

---

## 7. Quality gates

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS |
| unit (incl. CSV) | PASS |
| build | PASS |
| browser QA | PASS |

---

**STATUS:** `M5E-B COMPLETE — READY FOR M5E-C`
