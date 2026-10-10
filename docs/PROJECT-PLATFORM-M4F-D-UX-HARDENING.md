# PROJECT PLATFORM — M4F-D
## Final Cross-Application UX, Accessibility & Interaction Hardening

**Status:** Implementation complete — local gates + browser QA PASS  
**Base:** `origin/main` @ `0f4f8595e0cf3dd14fcabff9bb0c50182cf07ad2` (M4F-C merged)  
**Branch:** `cursor/m4fd-ux-hardening-60bb`

---

## 1. Objective

Resolve remaining verified usability and accessibility defects from M4F-B/C that block a coherent V1 experience. Defect-driven only — no product-wide redesign, no AuthZ/Prisma/domain rule changes.

---

## 2. Defect inventory

| ID | Sev | Source | Finding | Disposition |
|---|---|---|---|---|
| **M4F-D-01** | P2 | M4F-C-02 class | Org hub/detail/section/department/resources showed mutate forms to read-only viewers | **FIXED** — gate on `ORG_STRUCTURE_MANAGE`; polite read-only `Alert` |
| **M4F-D-02** | P2 | M4F-B 2.5.5 PARTIAL | `Button` `sm`/`md` were `<44px` (`min-h-9` / `min-h-10`) | **FIXED** — both use `min-h-11` |
| **M4F-D-03** | P2 | M4F-B touch | Initiative `FilterChip` + workspace tabs lacked `min-h-11` | **FIXED** |
| **M4F-D-04** | P2 | M4F-B touch | Home quick links, attention CTAs, Approvals/Decisions links, PI Review Links, org header actions under target | **FIXED** — `inline-flex min-h-11 items-center` |
| **M4F-D-05** | P2 | M4F-A/B table pattern | Initiatives, PI hub, capacity team/resource, compare project/resource, portfolio ownership tables missing caption/`scope` | **FIXED** |
| **M4F-D-06** | P2 | M4F-B contrast | `#74848e` (~3.86:1) on scenario compare UI including Reference control | **FIXED** — `text-[var(--muted)]` |
| **M4F-D-07** | P2 | M4F-C permissions PARTIAL | Capability-blocked PI board hid Allocate with no near-board reason | **FIXED** — polite `Alert` when `canAllocatePi === false` |
| **M4F-D-08** | P2 | M4F-B status PARTIAL | `ConfirmDialog` raw `role="alert"`; baseline label not `FormField` | **FIXED** — `Alert live="assertive"`; baseline uses `FormField` + `fieldClassName` |
| **M4F-D-09** | P2 | M4F-A focus | Skip link after sidebar + Strict Mode `RouteFocusMain` focused main on first load, so first Tab missed skip | **FIXED** — skip first in shell; Strict Mode-safe route focus |
| M4F-C-03 | P3 | Persona IA | PI Planner / Governance Reviewer lack dedicated `ROLE_KEYS` | **DOCUMENTED** — persona→pack table in `ROLES-AND-PERMISSIONS.md` |
| M4F-B grid | MEDIUM | Keyboard | PI board cell roving tabindex | **DEFERRED** — Move/Allocate forms remain keyboard path |
| axe CI / full AA | — | M4F-B/C | Full WCAG 2.2 AA certification / axe CI | **OUT OF SCOPE** — not claimed |
| OIDC multi-user | — | M4F-C-04 | Multi-credential personas | **OUT OF SCOPE** — ADR-026 fixture swap retained |

No P0. No AuthZ weakenings. Business rules (lifecycle, governance immutability, scenario isolation, promotion, baseline, portfolio CURRENT-only, RBAC) unchanged.

---

## 3. Root causes (summary)

1. **Visibility vs enforcement mismatch** — server denied org mutations; UI still rendered forms (same class as Viewer “New initiative”).
2. **Incomplete touch-target rollout** — field controls hit 44px; Button and many Links did not.
3. **Partial a11y pattern adoption** — caption/`scope`, FormField, and Alert live regions applied on newer surfaces only.
4. **Hardcoded muted hex** — pre-token compare styling used failing contrast.

---

## 4. Fixes (code)

| Area | Change |
|---|---|
| Org pages | Capability-gate create/edit panels; read-only notice |
| `button.tsx` | `sm`/`md` → `min-h-11` |
| Initiatives / Home / Approvals / Decisions / Review / Org | Touch-target classes on primary links/chips/tabs |
| Tables | `sr-only` caption + `scope="col"` + focusable overflow region where needed |
| Scenario compare | Replace `#74848e` with `--muted`; caption on project/resource tables |
| Planning board | Permission explanation `Alert` |
| ConfirmDialog / PlanApproval | Shared `Alert`; baseline `FormField` |
| Roles doc | Persona → pack mapping |

---

## 5. Regression evidence

### Unit

| Test | Coverage |
|---|---|
| `ui-button.test.tsx` | `min-h-11` on sm/md |
| `planning-board-cell-ux.test.tsx` | allocate-permission notice |
| `ui-dialog.test.tsx` | ConfirmDialog still exposes `role="alert"` on failure (via `Alert`) |
| Existing FormField / LiveRegion / DataTable suites | Retained |

### Browser QA

Script: `scripts/m4fd-browser-qa.mjs`  
Artifacts: `artifacts/m4fd-qa/`, `docs/acceptance-assets/m4fd/`

Checks:

- Cross-module routes: Home, Initiatives, Portfolio, Capacity, PI board/review/compare, Organization, Approvals
- Viewer: org mutate forms hidden + notice; no New initiative
- Admin: Edit organization visible
- Filter chip height ≥40px; initiatives table caption present
- Viewports 360 / 390 / 768 / 1024 / 1440 — no essential horizontal overflow on home, capacity, org, review
- Skip link focus on Home

---

## 6. Accessibility retest (fixed issues)

| Topic | Result |
|---|---|
| Form error semantics (ConfirmDialog) | PASS — assertive `Alert` |
| Status announcements (board permission) | PASS — polite live |
| Table accessibility (named hubs) | PASS — caption + scope |
| Touch targets (Button + named CTAs) | PASS — min-h-11 |
| Contrast (compare interactive muted) | PASS — token muted |
| Dialog focus | Unchanged Radix model (retained from M4F-A/B) |
| Keyboard board ops | PASS via Details/Move (roving tabindex deferred) |

---

## 7. Responsive regression

| Viewport | Home | Capacity | Organization | PI Review |
|---|---|---|---|---|
| 360 | **PASS** | **PASS** | **PASS** | **PASS** |
| 390 | **PASS** | **PASS** | **PASS** | **PASS** |
| 768 | **PASS** | **PASS** | **PASS** | **PASS** |
| 1024 | **PASS** | **PASS** | **PASS** | **PASS** |
| 1440 | **PASS** | **PASS** | **PASS** | **PASS** |

Browser QA verdict: **PASS** (`scripts/m4fd-browser-qa.mjs`, report in `docs/acceptance-assets/m4fd/qa-report.json`).



---

## 8. Remaining issues

- PI board cell **roving tabindex** (MEDIUM architectural)
- Full WCAG 2.2 AA manual audit + optional axe CI
- Multi-user OIDC personas (ADR-026)
- Dedicated `ROLE_KEYS` for PI Planner / Governance Reviewer (documented interim packs)
- Universal touch-target audit of every decorative text link outside named journeys

---

## 9. Quality gates

| Gate | Result |
|---|---|
| typecheck | **PASS** |
| lint | **PASS** (0 errors; 3 pre-existing warnings) |
| unit | **PASS** — 49+ files / **295** tests |
| integration | **PASS** — **190** tests |
| build | _(run)_ |
| browser QA | **PASS** — cross-module + 5 viewports + viewer org RO |

---

## 10. Final acceptance readiness

When gates and browser QA are green and this branch is merged to `main` with Vercel Production success:

`M4F-D COMPLETE — READY FOR M4F-FINAL`

Do **not** start M4F-FINAL in this phase.
