# Portfolio Explorer (M2C)

**Phase:** M2C — Portfolio Explorer  
**Route:** `/portfolio/explorer`  
**API:** Server Action `explorePortfolioAction` → `PortfolioQueryService.explorePortfolio`

## Intent

Read-only discovery and navigation across Initiatives and Projects within Phase 0C scope.  
No Portfolio tables. No duplicate management UI. Business calculations remain on the server.

## Query contract

```ts
explorePortfolioAction({
  organizationId,          // required
  departmentId?, sectionId?,
  q?,                      // title/name or referenceKey (case-insensitive contains)
  entityKinds?: ['INITIATIVE'|'PROJECT'],
  initiativeStage?,
  projectStatus?,
  ownerResourceId?,        // structured Resource only
  delivery?: 'DELAYED'|'ACTIVE_BLOCKER'|'CRITICAL_ISSUE', // projects only
  sortBy?: 'name'|'updatedAt'|'status'|'targetDate',
  sortDir?: 'asc'|'desc',
  page?, pageSize?,        // page 1-based; pageSize default 25, max 100
  asOf?,
}) → ActionResult<PortfolioExplorerResult>
```

`PortfolioExplorerResult` includes `scope`, `total`, `page`, `pageSize`, `sortBy`, `sortDir`, and `rows[]`.

Each row includes truthful `href`:
- Initiative → `/initiatives/{id}`
- Project → `/initiatives/{initiativeId}/project`

## Delivery signals

Derived only from existing policies (same delayed definition as M2A; issue-policy blockers/critical):

| Signal | Applies to | Meaning |
|---|---|---|
| Delayed | Project | ACTIVE/ON_HOLD + missed milestone or plannedEnd &lt; asOf |
| Active blocker | Project | `isActiveBlockerIssue` |
| Critical open issue | Project | open + severity CRITICAL |
| Initiative rows | — | delivery columns show **Unavailable** (not invented) |

Setting a delivery filter excludes initiative rows.

## Authorization

Identical to M2A `resolvePortfolioVisibility`. Section filter intersects visible departments. Ownership of a single initiative never expands explorer visibility.

## Limitations

- Candidate set capped at 5000 rows per entity type before in-memory sort/page (documented ceiling; indexes used on org/dept/status).
- No health score (M2D).
- Delivery analytics dashboard is M2D.

## Filter URL persistence

Explorer filters are query-string driven so returning from detail pages can restore state via browser history / shared links.
