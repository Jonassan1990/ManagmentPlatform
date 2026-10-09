# Portfolio Delivery Health UI (M2D-B)

**Routes**
- `/portfolio` — Delivery Health counts + attention list on the Executive Dashboard
- `/portfolio/health?organizationId=&projectId=` — explanation / drill-down
- `/portfolio/explorer?deliveryHealth=` — Explorer filter (server-side)

**Data boundary:** Server Actions only  
`getDeliveryHealthSummaryAction` · `listDeliveryHealthAttentionAction` · `getProjectDeliveryHealthAction` · `explorePortfolioAction` (`deliveryHealth`)

## Dashboard → M2D-A

| UI | Source |
|---|---|
| Health count cards | `DeliveryHealthSummary.counts.*` |
| Attention badge | `attentionCount` (BLOCKED + AT_RISK) |
| Attention table | `listDeliveryHealthAttention` rows + `reasons` |
| Primary reason | Highest severity reason from returned `reasons` (display sort only) |
| Owner / department | Attention row `owner`, `departmentName` |
| Explain | `/portfolio/health` → `getProjectDeliveryHealth` |

Classification is **never** recalculated in React.

## Explorer

| Param | Behavior |
|---|---|
| `deliveryHealth` | Server filter via M2D-A classifier; projects only |
| Existing `delivery` | M2C signal filter; composable with `deliveryHealth` |
| Pagination / sort / search | Unchanged |

## Explanation links

| Source type | Navigation |
|---|---|
| `PROJECT_ISSUE` | Project `#issues` section |
| `PROJECT_MILESTONE` | Project `#milestones` section |
| `PLANNING_DEPENDENCY` / other | Project detail (no invented dependency URL) |

## States

Empty attention, loading (server render), FORBIDDEN/error alerts, UNKNOWN ≠ On track (explicit labels).

## Non-goals

No classification policy changes, no new Issue/Risk workflows, no M2D-C workspaces.
