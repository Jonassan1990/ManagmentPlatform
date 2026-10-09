# Portfolio PI & Capacity UI (M2E-B)

**Route:** `/portfolio/capacity`  
**Reference:** `docs/ui-reference/resource-overview.html`  
**Data:** M2E-A `listPortfolioProgramIncrementsAction` + `getPortfolioPiCapacityAction`

## Visual mapping

| Reference | Implementation |
|---|---|
| Navy header / teal accents | Existing app shell (`--sidebar` navy) + teal `#087f78` KPI/dept accents |
| KPI cards | Available / Committed / Remaining / Utilization / Overloaded teams / Conflicts |
| Expandable department cards | Department → teams → resources |
| Stacked allocation bars | Committed-load bar vs available hours (truthful). No invented workstream % |
| Search | Department / team / resource text filter (client, authorized rows only) |
| Dependency panels | Replaced with **Project commitments** + **Planning conflicts** from M2E-A |

## Explicit non-copies

- Mock people, FTE figures, workstream legend (Programme/Asset/…)
- Fake Export / Plan allocation toasts
- Standalone header/sidebar from the HTML reference

## Empty / unavailable

| State | UI |
|---|---|
| No PI selected | Context strip + PI chips; KPIs hidden |
| Unavailable capacity | Reason text; never shown as `0` |
| Zero committed | KPI shows `0h` with “valid empty load” note |
| Missing capacity inputs | Amber data-quality banner from M2E-A |
| No conflicts | “No conflicts.” |

## Authorization

Server actions enforce Phase 0C scope. The UI only renders returned rows (no org-wide client fetch).
