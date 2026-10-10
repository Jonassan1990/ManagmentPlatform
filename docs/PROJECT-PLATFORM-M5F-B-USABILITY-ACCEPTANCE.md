# Project Platform — M5F-B Usability & Accessibility Acceptance

**Status:** `M5F-B COMPLETE — READY FOR M5-FINAL`  
**Verdict:** **PASS**  
**Date:** 2026-10-10  
**Role:** Principal UX Researcher / Enterprise QA Architect / Accessibility Reviewer  
**Nature:** Verification + acceptance documentation. Narrow persona-harness alias only (`employee`/`contributor` → `organization.viewer`). No AuthZ rule, schema, or domain changes.

| Field | Value |
|---|---|
| Starting main SHA | `5a47e86` (M5F-A / PR #81) |
| Branch | `cursor/m5fb-usability-acceptance-60bb` |
| Prerequisites | [M5F-A](./PROJECT-PLATFORM-M5F-A-VISUAL-POLISH.md), [M4F-C Role UX](./PROJECT-PLATFORM-M4F-C-ROLE-UX-ACCEPTANCE.md), [M5E Final](./PROJECT-PLATFORM-M5E-FINAL-ACCEPTANCE.md) |

---

## 1. Executive summary

Scripted, RoleBinding-swapped browser acceptance confirms that intended M5 personas can start from Home, see My Work and authorized Quick Start, reach Initiative / Project / PI / Resource Planning / Reports destinations with scope-preserving URLs, recover from unauthorized report scopes without silent crashes, and use keyboard + mobile controls. All **10** personas and **14/14** acceptance checks **PASS**.

**This is not a real-user study.** No human participants were recruited. Results are **BROWSER VERIFIED** (Playwright) with scripted timings/step counts, plus **INTEGRATION VERIFIED** AuthZ regressions retained from prior suites.

---

## 2. Method

| Mechanism | Purpose |
|---|---|
| Temp-auth `owner` | Single credential (ADR-026) |
| `scripts/m4fc-switch-persona.mjs` | Soft-swap real RoleBindings; restore after |
| `scripts/m5fb-browser-qa.mjs` | Acceptance matrix + persona smoke + measurements |
| `scripts/m5ec-reconcile.mts` | Seed org/PI/capacity fixtures for QA DB |
| Integration suites | Cross-org, unbound, Viewer create denial (prior + this run) |

**Evidence labels:** **BROWSER VERIFIED** vs **INTEGRATION VERIFIED**. Navigation visibility ≠ authorization; server `assertCan` remains authoritative.

**Fixtures:** QA DB `management_platform_m3d_qa`; seed written to `artifacts/m5fb-qa/seed.json`.

---

## 3. Persona matrix

| Persona | RoleBinding / pack | Browser | Notes |
|---|---|---|---|
| Portfolio Manager | `portfolio.manager` @ ORGANIZATION | **PASS** | Home + Reports reachable |
| Department Manager | `department.manager` @ DEPARTMENT | **PASS** | Scoped Home/Reports |
| Team Manager | `team.manager` @ TEAM | **PASS** | Scoped Home/Reports |
| Project Manager | `project.manager` @ DEPARTMENT | **PASS** | Scoped Home/Reports |
| PI Planner | *persona* → `section.manager` @ SECTION | **PASS** | No dedicated ROLE_KEY; board reachable |
| Governance Reviewer | *persona* → `organization.admin` on QA org | **PASS** | No dedicated ROLE_KEY; Approvals path smoked |
| Employee/Contributor | *persona* → `organization.viewer` | **PASS** | No dedicated ROLE_KEY; create CTA hidden |
| Organization Admin | `organization.admin` @ ORGANIZATION | **PASS** | Full journey owner |
| Viewer | `organization.viewer` @ ORGANIZATION | **PASS** | Create hidden; Reports workspace present |
| Unbound Principal | no bindings | **PASS** | `/access-not-configured` |

Screenshots: `docs/acceptance-assets/m5fb/screenshots/persona-*.png`.

---

## 4. Acceptance criteria

Script: `scripts/m5fb-browser-qa.mjs` → `artifacts/m5fb-qa/qa-result.json`

| Criterion | Result | Evidence |
|---|---|---|
| Clear Home starting point | **PASS** | `#home-quick-start` / `#home-my-work` / `#home-attention` |
| Correct My Work | **PASS** | `#home-my-work` present for Admin |
| Authorized Quick Start | **PASS** | Quick Start section with authorized action links |
| Initiative lifecycle clarity | **PASS** | Initiatives hub operable; create visible for Admin |
| Project delivery clarity | **PASS** | Portfolio Explorer reachable |
| PI planning usability | **PASS** | `/pi` list + `/pi/{id}/board` |
| Resource capacity clarity | **PASS** | Resource Planning + `organizationId`/`piId` preserved |
| Actionable KPIs | **PASS** | Portfolio dashboard content |
| Report preview/export | **PASS** | `reports-workspace`, `report-as-of`, CSV + Print controls |
| Role-based visibility | **PASS** | 10/10 personas |
| Mobile usability | **PASS** | 390×844 Home + Reports filters |
| Keyboard accessibility | **PASS** | Skip link first Tab; Report type focusable (`outline` 2px) |
| No silent failures | **PASS** | Cross-org report recovers with alert/empty; no crash |
| Error recovery (cross-org) | **PASS** | Unauthorized scope does not blank the app |

Full WCAG 2.2 AA certification: **NOT CLAIMED**.

---

## 5. Usability measurements (scripted)

These are **instrumented browser timings/step counts**, not lab study statistics.

| Measurement | Value (Admin run) | Meaning |
|---|---|---|
| Task completion — Home | 1 step; **1350 ms** to interactive Home | Sign-in already established; open `/` |
| Time to find next action (Quick Start) | 1 step; **13** authorized action links | Destinations visible in Quick Start section |
| Navigation context preservation | Capacity URL retains `organizationId` + `piId` | Scope-preserving filters |
| Error recovery | Cross-org report → alert/empty, app usable | No silent failure |
| Visible control density (Reports) | **26** interactive controls (desktop) | Filters + export/print + nav |
| Responsive | Mobile 390×844 Reports filters OK; tablet 820 Resource Planning OK | No blocking overflow for primary tasks |

Raw measurements: `artifacts/m5fb-qa/qa-result.json` → `measurements[]`.

---

## 6. Accessibility spot-checks

| Check | Result |
|---|---|
| Skip to main content (first Tab) | **PASS** (BROWSER) |
| Report type control focus-visible | **PASS** (BROWSER) |
| Mobile Reports labels (`Report type`) | **PASS** (BROWSER) |
| Reduced-motion foundation | Retained from M5F-A / globals |
| Full axe / WCAG audit | **NOT VERIFIED** this milestone |

---

## 7. Defect register

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| M5F-B-01 | P3 | Employee/Contributor & PI Planner / Governance Reviewer lack dedicated ROLE_KEYs | **ACCEPTED** — documented pack mappings (same pattern as M4F-C) |
| M5F-B-02 | P3 | Single temp-auth username requires RoleBinding swap for multi-persona browser | **ACCEPTED** — ADR-026 fixture approach |

No P0/P1 product defects found in this acceptance pass. Initial Quick Start link-count miss was a **QA selector bug** (heading id vs section), corrected in `m5fb-browser-qa.mjs`.

---

## 8. Quality gates

| Gate | Result |
|---|---|
| Typecheck | **PASS** (`tsc --noEmit`) |
| Lint | **PASS** (0 errors; pre-existing script warnings only) |
| Unit | **PASS** (57 files / 363 tests) |
| Integration | **PASS** (23 files / 217 tests) |
| Build | **PASS** (`next build`) |
| Browser QA | **PASS** — 14/14 acceptance; 10/10 personas (`scripts/m5fb-browser-qa.mjs`) |

---

## 9. Evidence index

| Path | Contents |
|---|---|
| `docs/acceptance-assets/m5fb/screenshots/` | Admin journeys + persona + mobile/tablet |
| `artifacts/m5fb-qa/qa-result.json` | Machine-readable verdict + measurements |
| `scripts/m5fb-browser-qa.mjs` | Acceptance harness |
| `scripts/m4fc-switch-persona.mjs` | Persona packs (+ `employee`/`contributor` aliases) |

---

**STATUS:** `M5F-B COMPLETE — READY FOR M5-FINAL`
