# PROJECT PLATFORM — M5B-B

## Premium Role-Aware Home Dashboard UI

**Status:** IMPLEMENTED  
**Phase:** M5B-B — Premium Manager & Employee Home UI  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `86a64ddc98d79806e8f1f86f91e143b794cab96b`  
**Contract:** [PROJECT-PLATFORM-M5B-HOME-CONTRACT.md](./PROJECT-PLATFORM-M5B-HOME-CONTRACT.md)

**STOP:** This change set does **not** implement M5B-C (Home UX acceptance formalization beyond this doc’s acceptance checklist).

---

## 1. Design decisions

1. **One route, three compositions** — `/` calls `getHomeDashboardAction` once and renders `HomeDashboardView` ordered by `userContext.mode` (`manager` | `employee` | `mixed`).
2. **No second aggregation** — UI never recomputes KPIs, capacity, or ownership; it only presents `HomeDashboardResponse`.
3. **Unavailable ≠ zero** — unavailable metrics render an em dash and reason; zeros only when `available: true`.
4. **Quick Start is authorization-strict** — only `availableActions.actions` are rendered; no disabled fake shortcuts.
5. **Visual language** — navy headings, teal accents / KPI left rails, white panels, resource-overview-inspired density (aligned with design system + `docs/ui-reference/resource-overview.html`).
6. **Return-context safe links** — drill-downs use `appendReturnContext(..., { from: "home", organizationId })`.

---

## 2. Manager / Employee / Mixed layouts

| Mode | First-screen order |
|---|---|
| **manager** | Welcome → Needs Attention → Quick Start → Portfolio Summary → Active Projects → Current PI → Capacity → My Work (often no linked resource) |
| **employee** | Welcome → My Work → Quick Start → Active Projects → Current PI → Needs Attention → Portfolio → Capacity |
| **mixed** | Welcome → Attention ∥ My Work (2-col desktop) → Quick Start → Portfolio → Projects → PI → Capacity |

Role chips use RoleBinding keys (never email/title inference).

---

## 3. Component architecture

| File | Role |
|---|---|
| `src/app/page.tsx` | Server page: single `getHomeDashboardAction` call; auth / no-org empty states |
| `src/components/home/home-dashboard-view.tsx` | Presentational composition (Server Component) |
| `src/components/home/home-labels.ts` | Mode / attribution / role display labels |
| `src/components/home/home-attention.tsx` | Legacy M4 attention strip (superseded on Home; retained for reference) |
| `src/app/actions/home.ts` | M5B-A action (unchanged semantics) |

Client components are not required for Home; interactions are plain links.

---

## 4. Screenshots

Captured under `artifacts/m5bb-qa/` during browser QA:

| File | Scenario |
|---|---|
| `01-manager-home.png` | Manager / admin Home (attention + Quick Start) |
| `02-employee-or-mixed.png` | Contributor / mixed My Work emphasis |
| `03-quick-start.png` | Authorized Quick Start cards |
| `04-attention-my-work.png` | Needs Attention + My Work |
| `05-kpi-capacity.png` | Portfolio KPIs + CapacityBar |
| `06-mobile-home.png` | Mobile single-column Home |
| `07-viewer-home.png` | Viewer (no create shortcuts) when fixture available |

---

## 5. UX measurements (structural — not a user study)

Measured as **interaction steps from first Home paint** on fixture `http://127.0.0.1:43152` (Org Admin / manager mode). No invented user-study scores.

| Goal | Observed path (browser QA) | Steps |
|---|---|---|
| Create Initiative | Quick Start → Create Initiative → `/initiatives/new` | **1 click** |
| Open PI Planning | Quick Start → Open PI Planning → `/pi` | **1 click** |
| Find assigned work | My Work section (employee/mixed) / manager: no linked Resource empty state | **0 clicks** to see status |
| Locate blocked / attention | Needs Attention “Blocked / at risk” → `/portfolio/health` | **1 click** |
| First-screen clarity (1280×800) | Welcome + org/role chips + Needs Attention + Quick Start header | Visible without scroll |
| Mobile (390×844) | Single column; no horizontal overflow | PASS |

**30-second target:** Signed-in managers see attention signals and Quick Start on the first viewport; Create Initiative / PI Planning are one click.

---

## 6. Accessibility

- Semantic `h1` / section `h2` with `aria-labelledby`
- KPI links expose `aria-label` including value
- CapacityBar uses `role="img"` + derived `aria-label` (available/committed/remaining)
- Focus-visible rings on all interactive links
- Touch targets `min-h-11` (44px)
- Unavailable sections announce via `role="status"` / sr-only where relevant
- Breadcrumbs retained (M4C)

---

## 7. Known limitations

- Home does not yet offer org switcher UI for multi-org (shows preferred org + warning only).
- My Work for managers without Resource link correctly shows `no_linked_resource` — linking is an admin org workflow.
- Legacy `HomeAttentionPanel` is unused by `/` after M5B-B.
- Reports surface (M5A roadmap) not on Home.

---

## 8. M5B-C acceptance requirements

M5B-C should formalize acceptance against this UI + contract:

1. Persona matrix sign-off (Org Admin, Portfolio/Dept/Team/Project Manager, Viewer, unbound, no Resource, multi-org).
2. Screenshot diff vs M4 Home (attention-first vs role-aware).
3. Confirm no regression in Portfolio / PI / Capacity engines.
4. Optional: org switcher / progressive Recent Activity if audit list API is safe.
5. A11y spot-check (keyboard tab order through Quick Start + Attention).
6. Do **not** change `HomeDashboardQueryService` semantics without a new contract revision.

---

## 9. Quality gates

- `npm run typecheck`
- `npm run lint`
- `npm test` (includes `tests/unit/home-dashboard-view.test.tsx`)
- `npm run test:integration`
- `npm run build`
