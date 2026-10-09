# Project Platform — M4E-D Portfolio / Explorer / Capacity / PI Integration UX

**Status:** M4E-D COMPLETE (presentation / navigation only)  
**Date:** 2026-10-09  
**Starting main SHA:** `603a127` (M4E-C merged)  
**Branch:** `cursor/m4e-d-portfolio-integration-ux-60bb`  
**Prerequisites:** M4E-A, M4E-B, M4E-C merged and accepted

---

## 1. Objective

Make Portfolio, Explorer, Delivery Health, Capacity, and PI Planning feel like one connected management experience — without new product features, duplicate Capacity/Explorer surfaces inside Portfolio, or AuthZ / capacity-policy / domain changes.

| Page | Purpose (unchanged product intent) |
|---|---|
| **Portfolio** | What needs attention? |
| **Explorer** | Find and inspect work |
| **Delivery Health** | Why is delivery at risk? |
| **Capacity** | Where are resources committed? |
| **PI Planning** | Change planning commitments |
| **Home Attention** | Attention-first entry into the above |

---

## 2. Before → After

| Journey / surface | Before (M4E-C) | After (M4E-D) |
|---|---|---|
| `/portfolio/health` without `projectId` | Dead-end EmptyState (“select a project”) | **Hub mode**: scope form, classification counts, attention list, Explain links |
| Portfolio Level 2 health | Embedded full attention list | **Summary panel** + “Open delivery health” CTA (hub owns the list) |
| KPI / attention destinations | Mixed Explorer vs Health | Blocked / At risk / Delayed → Health hub with `healthFocus`; Active projects → Explorer; Critical deps → Capacity |
| Home “Projects at risk” | Generic health URL | Org-scoped `/portfolio/health?…&healthFocus=ATTENTION` |
| Home quick links | Some unscoped | Portfolio / Explorer / Health / Capacity carry `organizationId` |
| Capacity chrome | Duplicate page H1 risk; weak Portfolio return | Purpose copy + **Portfolio** (return-context) + **Open PI Planning** |
| PI `/capacity` | PI-local only | **Portfolio Capacity** CTA with org + PI |
| Health classification chips | Could imply Portfolio ownership | `buildHealthHubHref` keeps chips on the Health hub |
| Capacity empty filter | Silent / weak feedback | `EmptyState` for no departments / no match |
| Touch targets | Partial | `min-h-11` on primary cross-page CTAs / links |

---

## 3. Workflow continuity

| Flow | Behavior |
|---|---|
| Home Attention → Project / Health | Attention rows + “Projects at risk” → Health hub (org preserved); project links keep return context where applicable |
| Portfolio → Explorer → Project | Active projects KPI / header Explorer → Explorer with `organizationId` + `from=portfolio` |
| Delivery Health → underlying issue | Hub → Explain (`projectId`) → reason evidence / project links (existing M2D paths) |
| Capacity → PI Planning | “Open PI Planning” with return-context (`from=capacity`, org, PI) |
| PI Planning → Portfolio Capacity | PI Capacity header CTA → `/portfolio/capacity?organizationId=&piId=` |
| Department → Team → Resource | Unchanged M4E-B hierarchy expand / inspect |
| Project commitment → Project detail | Unchanged commitment `href` from M2E rows |

URL context (`organizationId`, `departmentId`, `from` / `fromOrg` / `fromDept` / `fromPi`) and Phase 0C AuthZ scope are preserved — no new grants.

---

## 4. Consistency checklist

| Element | Approach |
|---|---|
| Page headings | Single `PageHeader` per route; Capacity dashboard no longer fights page H1 |
| KPI cards | Shared accent rail / StatusBadge patterns from M4B |
| Status badges | M4B `StatusBadge` on Portfolio summary + Health hub |
| Capacity bars | Unchanged M4B `CapacityBar` |
| Empty states | `EmptyState` on Health hub empty attention, Capacity filter miss, org-required |
| Loading / error | Existing Alert patterns; health load failure surfaced on Portfolio |
| Search / filter | Capacity search → explicit empty match; Health `healthFocus` + Clear |
| Action hierarchy | Primary CTA = open the owning workspace (Health / Explorer / Capacity / PI) |
| Navigation context | Return-context helper + org query on cross-links |

---

## 5. Avoided duplication

- Portfolio does **not** embed full Delivery Health tables or Capacity hierarchy.
- Capacity does **not** become a second Portfolio dashboard (purpose copy + Portfolio link out).
- PI Capacity remains commitment editing; portfolio coordination lives on `/portfolio/capacity`.

---

## 6. Accessibility (bounded)

- Forward `data-testid` / HTML attrs on `Panel` for reliable targets.
- `min-h-11` touch targets on key CTAs.
- Empty / clear-focus / permission explanations remain visible text (not silent).
- Comprehensive WCAG acceptance deferred to **M4F**.

---

## 7. Performance

- No new caching.
- Health hub uses existing server actions / query service (same as Portfolio previously embedded).
- Portfolio attention preview capped (pageSize 5) — full list on hub only.

---

## 8. Tests

| Suite | Coverage |
|---|---|
| `delivery-health-ux.test.tsx` | Hub href builder, classification → hub, empty focus, Explain `projectId` |
| `portfolio-dashboard-ux.test.tsx` | Attention → Health, health summary panel, KPI destinations |
| `portfolio-capacity-dashboard-ux.test.tsx` | Portfolio / PI Planning links, empty filter EmptyState |
| `home-experience.test.ts` | Org-scoped Portfolio / Explorer / Health / Capacity quick links |
| Existing M4E-B/C + M2E integration | AuthZ / capacity / sibling isolation unchanged |

---

## 9. Browser QA

Script: `scripts/m4ed-browser-qa.mjs`  
Evidence: `docs/acceptance-assets/m4ed/` and `artifacts/m4ed-qa/`

| # | Scenario | Result |
|---|---|---|
| 1 | Org admin login | _(filled after QA run)_ |
| 2 | Home → Health (org context) | |
| 3 | Portfolio health summary only | |
| 4 | Portfolio → Explorer | |
| 5 | Health hub + focus | |
| 6 | Health → Explain / Explorer | |
| 7 | Capacity workspace + Portfolio link | |
| 8 | Capacity → PI Planning | |
| 9 | PI Capacity → Portfolio Capacity | |
| 10 | Mobile Portfolio / Capacity / Health | |
| 11 | AuthZ / URL context note | |

---

## 10. Quality gates

| Gate | Result |
|---|---|
| typecheck | _(filled after run)_ |
| lint | |
| unit | |
| integration | |
| build | |
| browser QA | |

---

## 11. Remaining UX issues / M4E acceptance readiness

**Ready for M4E acceptance on integration UX** when gates + browser QA are green.

Deferred / remaining (not M4E-D blockers):

- Full WCAG audit → **M4F**.
- Dept Manager / Viewer browser principals still share temp-auth owner fixture; AuthZ behavior covered by unit/integration (same as M4E-C).
- Explorer / PI board deep visual polish beyond cross-link continuity → out of M4E-D.
- Do **not** start **M4E-FINAL** here.

`M4E-D COMPLETE — STOP BEFORE M4E-FINAL`
