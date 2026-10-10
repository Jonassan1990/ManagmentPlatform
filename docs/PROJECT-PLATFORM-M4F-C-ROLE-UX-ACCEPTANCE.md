# Project Platform — M4F-C Role-Based UX, Authorization Visibility & User Journey Acceptance

**Status:** M4F-C COMPLETE — ACCEPTED  
**Date:** 2026-10-10  
**Role:** Enterprise QA Architect / UX Researcher / Accessibility Reviewer / Security QA Engineer  
**Nature:** Verification + **narrowly scoped presentation fixes** only. No AuthZ rule, Prisma, or domain changes.

| Field | Value |
|---|---|
| Starting main SHA | `f6fc9a9cedd30abf08c66f01c6ff348bfb538d52` (M4F-B merged) |
| Branch | `cursor/m4fc-role-ux-acceptance-60bb` |
| Prerequisites | [M4F-A](./PROJECT-PLATFORM-M4F-A-ACCESSIBILITY.md), [M4F-B](./PROJECT-PLATFORM-M4F-B-RESPONSIVE.md), [M4E-FINAL](./PROJECT-PLATFORM-M4E-FINAL-ACCEPTANCE.md) |

---

## 1. Executive summary

M4F-C verifies that intended personas can find the right entry points, that navigation visibility matches RoleBindings without pretending to be authorization, and that seven end-to-end journeys remain operable for Organization Admin.

**Narrow fixes shipped (presentation only):**

1. Shell nav capability resolution now uses organization-local RoleBinding permission presence (`hasPermissionInOrganization`) so Section/Department/Team managers still see Initiatives / PI destinations they can open at their scope.
2. Initiatives hub (and empty Portfolio CTA) hide create actions when `initiative.create` is absent (Viewer).

`assertCan` / hierarchical scope matching **unchanged** (child scopes still cannot authorize ancestor writes).

---

## 2. Method

| Mechanism | Purpose |
|---|---|
| Temp-auth login `owner` | Single credential (ADR-026) |
| `scripts/m4fc-switch-persona.mjs` | Soft-swap **actual RoleBindings** on `TEMP_AUTH_PRINCIPAL_ID`, then restore |
| `scripts/m4fc-browser-qa.mjs` | Journeys A–G + persona nav/capability smoke |
| Integration suites | AuthZ regression (Viewer, dept isolation, cross-org, unbound, PI_REVIEW vs BASELINE) |
| Unit nav tests | Capability-shaped nav filtering |

**Fixtures:** org `f6b317a2-…` (M2E Capacity Org), PI `c9cf896f-…`, QA DB `management_platform_m3d_qa`.

**Evidence distinction:** Browser results below are **BROWSER VERIFIED**. AuthZ denials that are not exercised via RoleBinding swap remain **INTEGRATION VERIFIED**.

---

## 3. Role matrix

| Persona | RoleBinding / pack | Browser | Integration | Notes |
|---|---|---|---|---|
| Organization Admin | `organization.admin` @ ORGANIZATION | **BROWSER VERIFIED** | PASS | Journeys A–G |
| Portfolio Manager | `portfolio.manager` @ ORGANIZATION | **BROWSER VERIFIED** | PASS | Approvals nav hidden |
| Section Manager | `section.manager` @ SECTION | **BROWSER VERIFIED** | PASS | Initiatives + PI nav visible after fix |
| Department Manager | `department.manager` @ DEPARTMENT | **BROWSER VERIFIED** | PASS | Same |
| Team Manager | `team.manager` @ TEAM | **BROWSER VERIFIED** | PASS | PI list; no Approvals/Access |
| Project Manager | `project.manager` @ DEPARTMENT | **BROWSER VERIFIED** | PASS | No Approvals/Access |
| PI Planner | *persona* → `section.manager` pack | **BROWSER VERIFIED** | PASS | No dedicated ROLE_KEY; PI board reachable |
| Governance Reviewer | *persona* → `organization.admin` on QA org | **BROWSER VERIFIED** | PASS | No dedicated ROLE_KEY; Approvals visible |
| Viewer | `organization.viewer` @ ORGANIZATION | **BROWSER VERIFIED** | PASS | Create hidden; Approvals hidden |
| Unbound Principal | no bindings | **BROWSER VERIFIED** | PASS | `/access-not-configured` |

Navigation visibility ≠ authorization. Server `assertCan` remains authoritative.

---

## 4. Seven journey results (Org Admin)

Script: `scripts/m4fc-browser-qa.mjs`  
Evidence: `docs/acceptance-assets/m4fc/`

| Journey | Result | Evidence |
|---|---|---|
| **A — Initiative** | **PASS** (BROWSER) | Hub + create + detail (`A-*`) |
| **B — Governance** | **PASS** (BROWSER) | Approvals + Decisions (`B-*`) |
| **C — Project** | **PASS** (BROWSER) | Explorer → Project tab (`C-*`) |
| **D — PI Planning** | **PASS** (BROWSER) | Board + Compare + Review (`D-*`); mutate paths = INTEGRATION |
| **E — Portfolio** | **PASS** (BROWSER) | Home → Portfolio → Explorer → Health (`E-*`) |
| **F — Resource Planning** | **PASS** (BROWSER) | Capacity hierarchy + Inspect (`F-*`) |
| **G — Organization** | **PASS** (BROWSER) | Org → Access → Resources (`G-*`) |

Destructive lifecycle mutations (promote/approve/baseline, closure) remain **INTEGRATION VERIFIED** (M3D / project-closure suites) — not re-executed destructively in browser.

---

## 5. Authorization regression

| Check | Result | Evidence |
|---|---|---|
| Viewer read-only / no create CTA | **BROWSER VERIFIED** | persona viewer; create hidden |
| Viewer Access page not administrative | **BROWSER VERIFIED** | `/access` empty/denied presentation |
| Dept/Section isolation | **INTEGRATION VERIFIED** | `phase0c-authorization`, `portfolio-query`, `portfolio-pi-capacity` |
| Cross-org denial | **INTEGRATION VERIFIED** | same + PI suites |
| Unbound denial | **BROWSER + INTEGRATION** | access-not-configured; temp-auth / phase0c |
| PI_REVIEW vs PI_BASELINE | **INTEGRATION VERIFIED** | M3D approval/baseline suites |
| Project / Resource ownership | **INTEGRATION VERIFIED** | `phase0b-ownership` |
| No AuthZ code-path changes | **PASS** | `assertCan` / scope-policy untouched |

---

## 6. Accessibility (critical journeys)

| Check | Result |
|---|---|
| Skip → main (Admin) | **PASS** (BROWSER) |
| Mobile nav practical | **PASS** (BROWSER) |
| PI board keyboard Move path | Retained from M4F-B |
| Full WCAG 2.2 AA | **NOT VERIFIED** — no certification claim |

Remaining gaps → M4F-D / later: full axe CI, multi-credential OIDC personas, PI grid roving tabindex.

---

## 7. Defect register

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| M4F-C-01 | **P1** | Section/Dept/Team managers lost Initiatives/PI sidebar items because nav probed ORGANIZATION-only `can()` | **FIXED** — `hasPermissionInOrganization` for shell flags |
| M4F-C-02 | **P2** | Viewer saw “New initiative” on hub despite lacking `initiative.create` | **FIXED** — capability-gated CTAs |
| M4F-C-03 | **P3** | PI Planner / Governance Reviewer are product personas without dedicated ROLE_KEYs | **ACCEPTED** — mapped to section.manager / org.admin packs; document for M4F-D IA |
| M4F-C-04 | **P3** | Single temp-auth username (ADR-026) requires RoleBinding swap for multi-persona browser | **ACCEPTED** — fixture approach; OIDC multi-user later |

No P0. No AuthZ weakenings.

---

## 8. Usability acceptance (summary)

| Question | Verdict |
|---|---|
| Correct entry point? | **PASS** for Admin journeys; managers regain Initiatives/PI nav |
| Next action clear? | **PASS** on Review/Board/Capacity (M4D–E retained) |
| Lifecycle statuses understandable? | **PASS** (StatusBadge labels) |
| Permissions explained? | **PARTIAL** — disabled titles on mutating PI controls; Viewer create now hidden |
| Errors actionable? | **PASS** on FORBIDDEN portfolio messaging |
| Context preserved? | **PASS** return-context (M4E) |
| Forms understandable? | **PASS** FormField pattern (M4F-A/B) |
| Confirmations explicit? | **PASS** on review dialogs (prior) |
| Mobile practical? | **PASS** |
| Critical actions keyboard accessible? | **PASS** for Admin smoke; board Move forms |

---

## 9. Tests & gates

| Gate | Result |
|---|---|
| typecheck | **PASS** |
| lint | **PASS** (0 errors) |
| unit | **PASS** — 48 files / **291** tests |
| integration | **PASS** — **190** tests |
| build | **PASS** |
| browser QA | **PASS** — 7/7 journeys, 9 personas |

---

## 10. Remaining M4F-D scope

- Formal UX maturity re-score and release readiness checklist  
- Optional axe CI on key routes  
- Multi-user OIDC (or extended temp-auth) without RoleBinding swap  
- Dedicated ROLE_KEYs or documented persona→pack mapping for PI Planner / Governance Reviewer  
- PI board cell roving tabindex (from M4F-B backlog)  
- Production M3 migration readiness (separate track)

Do **not** start M4F-D in this phase.

`M4F-C COMPLETE — READY FOR M4F-D`
