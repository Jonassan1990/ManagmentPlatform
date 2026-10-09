# Portfolio Dashboard (M2B)

**Phase:** M2B — Executive Portfolio Dashboard  
**Route:** `/portfolio`  
**Data boundary:** Server Action `getPortfolioSnapshotAction` (M2A)  
**Scope options:** `listPortfolioDepartmentOptionsAction`

## Intent

Present an authorization-aware executive dashboard that visualizes M2A portfolio metrics without duplicating domain calculations in the browser.

## UI sections → M2A fields

| UI section | M2A source |
|---|---|
| KPI: Initiatives | `initiatives.value.total` |
| KPI: Active projects | `projects.value.active` |
| KPI: Delayed projects | `delayedProjects.value.delayedProjects` |
| KPI: Active blockers | `issues.value.activeBlockers` |
| Initiative lifecycle | `initiatives.value.byStage` / `byStatus` |
| Project status | `projects.value.*` |
| Attention: pending governance | `governance.value.*` |
| Attention: critical issues | `issues.value.criticalOpenIssues` |
| Attention: critical dependencies | `dependencies.value.criticalOpenDependencies` |
| Experimentation | `experimentation.value.*` |
| PI capacity | `piCapacity` (available or unavailable) |
| Ownership table | `ownership.value[]` |
| Scope banner | `scope` + asOf |

## States

| State | Behavior |
|---|---|
| Loading | Next.js server render of `/portfolio` (force-dynamic) |
| Empty org list | Empty state → organization setup |
| Empty portfolio (authorized zeros) | Explicit empty copy; KPIs show `0` |
| Unavailable metric | Renders “Unavailable” + reason — never coerced to `0` |
| FORBIDDEN snapshot | Alert with access-denied messaging |
| Action error | Alert with server error message |

## Navigation (truthful)

- `/initiatives` (+ stage filters for Demand/Requirements/Pre-study)
- `/approvals`, `/decisions`
- `/pi`
- `/organization/{organizationId}`

No invented per-project issue deep links (M2A aggregates do not return project ids for drill-down).

## Non-goals (M2C+)

- Interactive drill-down workspaces
- Portfolio edit/mutation flows
- Cached KPI store
- New REST APIs
