# Project Platform — Navigation Architecture (M4C-A / M4C-B)

**Status:** M4C-A workflow navigation + M4C-B breadcrumbs & context preservation  
**Date:** 2026-10-09  
**Baseline main SHA (M4C-B start):** `a357c300196252228dd6ee54f997c56f20471ad9`  
**Related:** [M4 UX Audit](./PROJECT-PLATFORM-M4-UX-AUDIT.md), [Design System](./PROJECT-PLATFORM-DESIGN-SYSTEM.md)

---

## 1. Principles

1. **Workflow hubs over module inventory** — users navigate by work, not by service name.
2. **No invented routes** — every nav destination maps to an existing App Router page.
3. **Hiding ≠ authorization** — server `assertCan` remains authoritative.
4. **One definition** — desktop sidebar and mobile drawer share `NAV_GROUPS`.
5. **Contextual PI tools stay in PiTabs** — Board / Compare / Review / Baseline require a PI id.

---

## 2. Navigation tree

```
Home                         → /
Portfolio                    → /portfolio
  · Executive overview       → /portfolio
  · Explorer                 → /portfolio/explorer
  · Delivery health          → /portfolio/health
  · PI & capacity            → /portfolio/capacity
Initiatives                  → /initiatives
  · All initiatives          → /initiatives
  · Create initiative        → /initiatives/new          [canCreateInitiative]
PI Planning                  → /pi
  · Program increments       → /pi
  · Create PI                → /pi/new                   [canCreatePi]
Governance
  · Approvals                → /approvals                [canViewApprovals]
  · Decisions                → /decisions                [canViewDecisions]
  · Governance policy        → /organization/{org}/governance-policy  [canManageGovernancePolicy]
Organization                 → /organization
  · Organizations            → /organization
  · Access & roles           → /organization/{org}/access [canManageAccess]
```

**Omitted (no safe global route):** My attention inbox (metrics live on Home/Portfolio), standalone Lifecycle details, global Planning Board / Scenarios / Compare / Review / Baselines, top-level Sections/Departments/Teams/Resources (live under Organization hierarchy).

---

## 3. Role / capability visibility

Shell flags are OR-ed across organizations the principal can list (`resolveShellNavContext`).

| Flag | Permission | Typical roles |
|---|---|---|
| `canViewApprovals` | `approval.review` | Governance reviewers, managers |
| `canViewDecisions` | `decision.make` | Decision makers |
| `canManageGovernancePolicy` | `governance.policy.manage` | Org admin / portfolio admin |
| `canManageAccess` | `role.manage` | Organization Admin |
| `canViewPi` | `pi.view` | PI planners, managers, many viewers |
| `canCreatePi` | `pi.create` | PI planners / admins |
| `canViewInitiatives` | `initiative.view` | Most authenticated users |
| `canCreateInitiative` | `initiative.create` | Managers |

Viewer example: Home, Portfolio (+ children), Initiatives (list), PI Planning (list), Organization — **no** Governance / Access / Create actions when flags are false.

---

## 4. Active-route rules

Implemented in `matchNavPath`:

| Match | Behavior |
|---|---|
| `exact` | Path equals destination |
| `prefix` | Path equals or is nested under destination |
| `prefixExclude` | Prefix match minus listed prefixes/segments |
| `includesSegment` | Path contains a segment (e.g. `access`) |

Examples:

- `/portfolio/health` → Delivery health active; Portfolio hub not active.
- `/pi/{id}/review` → Program increments active (PI workspace).
- `/organization/{id}/access` → Access & roles active; Organizations hub not active.

Active items use `aria-current="page"`.

---

## 5. Workflow hub responsibilities

| Hub | Route | Responsibility |
|---|---|---|
| Home | `/` | Attention metrics + workflow destination strip |
| Portfolio | `/portfolio` | Executive dashboard + links to Explorer / Health / Capacity |
| Initiatives | `/initiatives` | List + create entry |
| PI Planning | `/pi` | PI list; deep links into PiTabs for board/compare/review |
| Organization | `/organization` | Org list → hierarchy, resources, access, policy |
| Governance | (no single hub page) | Approvals + Decisions inboxes + policy when permitted |

---

## 6. Implementation map

| File | Role |
|---|---|
| `src/modules/navigation/types.ts` | Typed model |
| `src/modules/navigation/nav-definition.ts` | Tree, matching, resolve |
| `src/modules/navigation/resolve-shell-nav.ts` | Capability OR across orgs |
| `src/components/shell/authenticated-shell.tsx` | Resolves nav context server-side |
| `src/components/shell/app-shell.tsx` | Sidebar + mobile drawer UI |
| `tests/unit/navigation.test.ts` | Matching + filtering |

---

## 7. Breadcrumbs & context preservation (M4C-B)

### 7.1 Contracts

| Module | Role |
|---|---|
| `src/modules/navigation/breadcrumbs.ts` | Typed trail builders (`buildPortfolioTrail`, `buildInitiativeTrail`, `buildPiTrail`, `buildOrganizationTrail`) |
| `src/modules/navigation/return-context.ts` | Allowlisted `from` tokens, explorer/capacity filter packing, PI query preserve, open-redirect-safe return hrefs |
| `src/components/ui/page.tsx` → `Breadcrumbs` | Shared placement, truncation, `aria-current`, mobile middle-collapse |

Crumbs are `{ label, href? }`. The last crumb is always the current page (no `href`). Pages must not redefine ad-hoc Overview→… trails for covered workflows.

### 7.2 Entity label resolution

- Labels come from **already-authorized** application/service payloads on the page (initiative `referenceKey`, PI `referenceKey`/`name`, org/dept/resource `name`, etc.).
- `entityLabel(preferred, fallback)` never surfaces a UUID-shaped string; missing/denied entities use a generic fallback (`Initiative`, `Program Increment`, …).
- No separate breadcrumb lookup DB and no N+1 label fetches.
- Unauthorized entities still fail at the page AuthZ boundary (`notFound` / redirect); breadcrumbs never invent titles for data the principal cannot read.

### 7.3 Context parameters (shareable, non-sensitive)

| Param | Meaning |
|---|---|
| `from` | Allowlisted return token: `explorer` \| `capacity` \| `health` \| `approvals` \| `decisions` \| `portfolio` \| `pi-list` |
| `fromOrg` / `fromDept` / `fromPi` | UUID-validated scope for reconstructing return URLs |
| `fx_*` | Packed Explorer filters (`q`, `kind`, stages/status, sort, page, …) — M2C contract keys only |
| `revisionId` / `revs` / `ref` | PI scenario context preserved across Board / Compare / Review via `appendPreservedQuery` |

Browser storage is **not** used for return or AuthZ decisions. Arbitrary external URLs are never accepted as return targets (`isSafeInternalPath`).

### 7.4 Return-link validation

- `appendReturnContext` only attaches params to relative internal paths.
- `resolveReturnHref` maps tokens → fixed route templates (`/portfolio/explorer`, `/portfolio/capacity`, …).
- Invalid UUIDs, oversized filter values, and unknown `from` tokens are dropped; deep links without context still render trails from hubs.

### 7.5 Authorization boundaries

- Shell capability OR flags (M4C-A) remain **visibility only**.
- Destination pages continue to enforce server-side AuthZ; breadcrumbs and return crumbs are not an access grant.
- Cross-org isolation: non-UUID / foreign org ids in query params are ignored when reconstructing returns; entity pages still `assertCan` on load.

### 7.6 Known limitations

- Initiative Documents/Risks/Demand trails do not yet pack Explorer return context (detail + Project do).
- Scenario panel Compare link preserves return/PI query keys but does not rewrite business promotion flows.
- Mobile breadcrumbs collapse middle ancestors visually; full trail remains available from `sm` breakpoint and in the accessibility tree for shown links.
---

## 8. Home experience & navigation acceptance (M4C-C)

### 8.1 Home attention

- `HomeAttentionPanel` leads Home with delivery-health summary + top attention rows from existing `PortfolioQueryService` APIs (no new scoring engine).
- Also surfaces initiative / approval / PI attention counts already computed for overview metrics.
- Deep-links to `/portfolio/health` and related hubs.

### 8.2 Capability-aware quick links

- Home resolves `resolveShellNavContext` (same OR flags as the shell).
- `buildHomeQuickLinks` / `buildHomeFooterLinks` hide Approvals, Decisions, Create, Access, Policy, and PI entry when flags are false.
- Metric tile `href`s are similarly gated. **Visibility ≠ AuthZ.**

### 8.3 Authorized PI entry

- `selectAuthorizedPiEntry` prefers latest **ACTIVE**, else latest **REVIEW**, from AuthZ-filtered PI lists.
- Home shows a “Continue PI planning” card → Board (ACTIVE) or Review (REVIEW).
- Portfolio Capacity auto-selects that PI when `piId` is absent (redirect preserves org/dept query).

### 8.4 Acceptance evidence

- Unit: `tests/unit/home-experience.test.ts`
- Browser: `docs/acceptance-assets/m4cc/`

### 8.5 Deferred (M4D+)

- Collapsed “Organize / Work / Govern” super-groups if density requires.
- PI Board / Review workflow simplification (M4D).
- Capacity scenario-admin progressive disclosure beyond auto-select.
