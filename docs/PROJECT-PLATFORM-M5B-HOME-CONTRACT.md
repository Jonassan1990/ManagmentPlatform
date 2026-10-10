# PROJECT PLATFORM — M5B-A

## Home Dashboard Query Contract

**Status:** IMPLEMENTED (query foundation only)  
**Phase:** M5B-A — Role-Aware Home Dashboard Architecture & Data Contracts  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `f21b2196e2944e51478b8111f03d13798b2006ba`

**STOP:** This change set does **not** implement M5B-B (premium Home UI).

---

## 1. Purpose

Establish a single typed Home dashboard response that composes **existing** Portfolio, Initiative, PI Planning, Governance, and Organization services into one role-aware Home query.

Manager and employee experiences share one contract and one route. Composition switches by persona resolution — there are not two disconnected dashboard systems.

---

## 2. Entry points

| Surface | Location |
|---|---|
| Domain types | `src/modules/portfolio/domain/home-dashboard.ts` |
| Query composer | `src/modules/portfolio/application/home-dashboard-query-service.ts` |
| Container | `createServices().homeDashboard` |
| Server action | `getHomeDashboardAction` in `src/app/actions/home.ts` |
| Tests | `tests/integration/home-dashboard-m5b.test.ts` |

```ts
const { homeDashboard } = createServices();
const dash = await homeDashboard.getHomeDashboard(principal, {
  organizationId?: string;   // must be authorized
  myWorkLimit?: number;      // default 25, max 50
  attentionLimit?: number;   // default 5, max 20
});
```

---

## 3. Dashboard response model

`HomeDashboardResponse` sections (each carries `authorizedScope`, `sourceOfTruth`, `availability`, `drillDown`, `asOf`):

| Section | Role |
|---|---|
| `userContext` | Principal, mode, caps, orgs, RoleBindings, linked Resource |
| `availableActions` | Authorized Quick Start actions with real routes |
| `myWork` | Proven ownership + role-permission governance queues |
| `needsAttention` | Delivery health + overview/PI attention signals |
| `portfolioSummary` | Snapshot metrics (initiatives, projects, governance, delayed, overload) |
| `activeProjects` | Bounded attention-ranked project sample + active count |
| `currentPi` | `selectAuthorizedPiEntry` + executive PI metrics |
| `resourceCapacity` | CURRENT-revision PI capacity overview summary |
| `warnings` | Multi-org labeling, partial unavailability, etc. |

### Availability states

| State | Meaning |
|---|---|
| `available` | Section has authorized data (zeros allowed when truly empty counts) |
| `empty` | Authorized, but nothing to show (e.g. no PI for capacity) |
| `unavailable` | Authorized path failed transiently / data source error — **value is null, never coerced to 0** |
| `forbidden` / `no_permission` | Missing permission |
| `no_linked_resource` | My Work ownership cannot be attributed |
| `no_organization` | Principal has no accessible organizations |

**Rule:** unavailable ≠ empty ≠ zero. Metrics use `{ available, value: number \| null }`.

---

## 4. Persona resolution

Resolved from **Principal + RoleBindings + Resource.linkedPrincipalId + shell capabilities**.

**Never** inferred from display name, email, or Resource title.

### Manager signals

True when any of:

- Shell caps: create initiative/PI, approvals, decisions, access manage, governance policy manage
- Active RoleBinding role key ∈  
  `organization.admin`, `portfolio.manager`, `section.manager`, `department.manager`, `team.manager`, `project.manager`, `platform.bootstrap_admin`

### Linked Resource

`Resource` where `linkedPrincipalId = principal.id` and `status = ACTIVE`.

Not every Principal has a linked Resource (ADR-020/021).

### Mode (`HomeDashboardMode`)

| Mode | When |
|---|---|
| `manager` | Manager signals, no linked Resource |
| `employee` | No manager signals (Viewer / unbound contributor packaging) |
| `mixed` | Manager signals **and** linked Resource |

Multiple RoleBindings are supported; each org lists its `roleKeys` in `userContext.organizations`.

---

## 5. Manager / Employee semantics

Same response shape:

- **Manager emphasis:** Needs Attention, Portfolio Summary, Resource Capacity, Quick Start creates
- **Employee emphasis:** My Work first; quieter create CTAs (absent when unauthorized)
- **Mixed:** both My Work and manager KPI sections populated

UI layout choice is **M5B-B**. This contract only supplies flags + section availability.

---

## 6. KPI sources (no second engine)

| Home metric | Source |
|---|---|
| Active Initiatives | `PortfolioQueryService.getPortfolioSnapshot` → `initiatives` |
| Active Projects | snapshot → `projects.active` |
| Blocked / at-risk | `getDeliveryHealthSummary.attentionCount` + attention rows |
| Pending Governance | snapshot → `governance.waitingForApproval + waitingForDecision` |
| Delayed Projects | snapshot → `delayedProjects` |
| Overloaded teams | snapshot → `piCapacity.overloadedTeamIterations` **or** `getPiCapacityOverview` overloadedTeams |
| PI capacity utilization | `getPiCapacityOverview` CURRENT revision totals |
| Overview supplements | `InitiativeService.getOverviewMetrics`, `PlanningService.getExecutivePiMetrics` |

All metrics are preferred-organization scoped when org-specific. Multi-org principals get a `MULTI_ORG_SCOPE` warning; aggregates are **not** silently combined across organizations.

---

## 7. My Work attribution

### Proven sources only

| Relationship | Basis |
|---|---|
| Initiative business owner / requester / sponsor | `*ResourceId` FK on Initiative |
| Project owner | `Project.ownerResourceId` |
| Work items / milestones | `ownerResourceId` |
| PoC / Pilot / Risk owners | `ownerResourceId` |
| Planning dependencies | `ownerResourceId` |
| Pending approvals / decisions | `listMyApprovals` / `listMyDecisions` via RoleBinding permissions |

### Explicit non-sources

- Free-text `businessOwnerName` / `requesterName`
- Email or displayName string match
- Resource title

Self-linked ownership is read with bounded queries (`take ≤ 50`) for the Resource where `linkedPrincipalId` matches the caller — identity is the FK link, not structure-admin privilege.

When no linked Resource: `myWork.availability.state = no_linked_resource` (governance role queues may still appear).

---

## 8. Quick Start authorization

Only **authorized** actions are returned. Each includes `authorizationBasis` and a real href:

| Action id | Route | Basis |
|---|---|---|
| `create-initiative` | `/initiatives/new` | `initiative.create` |
| `view-projects` | `/portfolio/explorer?organizationId=` | `initiative.view` |
| `open-pi-planning` | PI entry or `/pi` | `pi.view` |
| `review-governance` | `/approvals` or `/decisions` | `approval.review` / `decision.make` |
| `open-portfolio` | `/portfolio` | shell portfolio |
| `manage-resources` | `/organization/{id}/resources` | `org.structure.manage` |
| `view-resources` | same | `org.structure.read` |

Additional shell links may appear (health, capacity, access, policy) via `buildHomeQuickLinks`, still capability-gated. Destination pages remain authoritative for AuthZ.

---

## 9. Multi-organization scope

- `listOrganizations` defines authority boundary.
- Requesting `organizationId` outside that set → `FORBIDDEN` (cross-org denial).
- Preferred org = input `organizationId` else shell preferred (`resolveShellNavContext`).
- Manager sections use **preferred org only**.
- `userContext.organizations[]` labels every accessible org with role keys.
- Warning `MULTI_ORG_SCOPE` when `organizations.length > 1`.

---

## 10. Performance

- Parallel `Promise.all` / `Promise.allSettled` for independent sections
- Bounded My Work (`myWorkLimit`) and attention sample (`attentionLimit`)
- Ownership queries use `take` limits — no full portfolio fetch for Home
- Capacity loads **one** selected PI CURRENT overview (not full hierarchy UI payload for every PI)
- Reuses existing services; no N+1 per KPI formula

---

## 11. Authorization

- Persona mode flags are **not** grants
- Portfolio / health / capacity still enforce Phase 0C visibility (`resolvePortfolioVisibility`)
- Quick Start visibility ≠ mutate permission
- Cross-org preferred id always denied when not listable

---

## 12. M5B-B UI requirements (out of scope here)

M5B-B must consume `HomeDashboardResponse` without inventing parallel fetches:

1. Compose manager vs employee layout from `userContext.mode` (one route).
2. Render section availability states distinctly (empty / unavailable / no linked resource / forbidden).
3. KPI cards click through `metric.href` / section `drillDown` only.
4. My Work lists use `attribution` badges; never display free-text owner as identity proof.
5. Quick Start uses `availableActions.actions` only.
6. Multi-org: show preferred org label + warning when present.
7. Align visual language with M5A / `resource-overview.html` (navy/teal KPI rails).
8. Do not add schema, new KPI formulas, notifications, or assignment tables.

---

## 13. Scope exclusions (M5B-A)

- Dashboard UI redesign
- New KPI formulas / score engines
- New assignment tables
- New notifications
- New role packs
- Prisma schema changes
- Authentication changes
- R1 infrastructure work

---

## 14. Quality gates

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
