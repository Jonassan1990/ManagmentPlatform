# M4B-C Adoption Inventory

**Baseline:** `b71c26fa2742597a214c9f3d3c86d10842c4ca0e`

## Safe replacements chosen

1. PI Review promote / approve / baseline → `ConfirmDialog`
2. Scenario + approval status chips → `StatusBadge` (+ `status-adapters`)
3. PI Capacity utilization cells → `CapacityBar`
4. Portfolio Capacity department tracks → `CapacityBar`
5. Delivery Health + Explorer delivery/status → `StatusBadge`
6. Initiatives list stage → `StatusBadge`
7. Review panel feedback → `Alert`

## Explicitly deferred

- Explorer / Compare → `DataTable` (custom paging / diff semantics)
- Portfolio resource-row bars (dense layout)
- Governance inbox chips
- Navigation / workflow redesign (M4C+)
