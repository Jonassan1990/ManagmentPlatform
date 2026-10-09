# Portfolio Query Contract (M2A)

**Phase:** M2A — Enterprise Portfolio Management (query layer only)  
**Status:** Accepted  
**Module:** `src/modules/portfolio/`  
**API:** Server Action `getPortfolioSnapshotAction` → `PortfolioQueryService.getPortfolioSnapshot`

## Intent

Provide a **server-side, authorization-aware, read-only** portfolio snapshot for later UI (M2B+).  
No Portfolio tables, no KPI cache, no second capacity engine.

## Input

| Field | Required | Meaning |
|---|---|---|
| `organizationId` | Yes | Organization to aggregate |
| `departmentId` | No | Narrow to one department (must already be visible) |
| `asOf` | No | Point-in-time for delayed classification (default: now) |

## Scope enforcement (Phase 0C)

| Principal binding | Visible portfolio data |
|---|---|
| `ORGANIZATION` + `initiative.view` or `project.view` | All non-archived initiatives/projects in the org |
| `SECTION` + view | Departments under that section |
| `DEPARTMENT` + view | That department only |
| `TEAM` + view | Parent department of that team |
| `PLATFORM` only | **Does not** grant org portfolio aggregates (ADR-022) |
| Initiative ownership alone | **Does not** expand portfolio visibility |

Cross-organization access is denied. Department managers never receive unrelated department rows.

Applied scope is returned on every snapshot as `scope.mode` = `organization` | `departments`.

## Metric catalogue

Each metric is either:

```ts
{ available: true, value: T }
{ available: false, reason: string }
```

Empty-but-authorized organizations return **available zeros**, not unavailable.

### 1. Initiatives (`initiatives`)

| Field | Source | Definition |
|---|---|---|
| `total` | `Initiative` | Count where `status ≠ ARCHIVED` in scope |
| `byStage.*` | `Initiative.currentStage` | DEMAND / REQUIREMENTS / PRE_STUDY / POC / PILOT / PROJECT |
| `byStatus.*` | `Initiative.status` | ACTIVE / ON_HOLD / CANCELLED (ARCHIVED excluded) |

### 2. Projects (`projects`)

| Field | Source | Definition |
|---|---|---|
| `active` | `Project.status` | ACTIVE |
| `onHold` | `Project.status` | ON_HOLD |
| `completed` | `Project.status` | COMPLETED (includes closed DELIVERED / PARTIALLY_DELIVERED) |
| `cancelled` | `Project.status` | CANCELLED |
| — | — | ARCHIVED excluded |

Closure evidence remains on `ProjectClosure`; status counts use Project status only.

### 3. Governance pending (`governance`)

Aligned with existing governance overview semantics:

| Field | Source | Definition |
|---|---|---|
| `waitingForApproval` | `GovernanceSubmission` | status ∈ {SUBMITTED, IN_REVIEW} |
| `waitingForDecision` | `GovernanceSubmission` | status = APPROVALS_COMPLETE |
| `pendingApprovalRequests` | `ApprovalRequest` | status = PENDING |

### 4. Experimentation (`experimentation`)

| Field | Source | Definition |
|---|---|---|
| `activePocs` | `PoC` | status ∈ {DRAFT, READY, IN_PROGRESS, EVALUATION} on in-scope initiatives |
| `activePilots` | `Pilot` | same active statuses on in-scope initiatives |

COMPLETED PoC/Pilot are excluded.

### 5. Issues (`issues`)

Uses Phase 1C issue-policy helpers:

| Field | Definition |
|---|---|
| `openIssues` | Issue status not RESOLVED/CLOSED |
| `criticalOpenIssues` | open + severity CRITICAL |
| `activeBlockers` | `isBlocker && !terminal` (`isActiveBlockerIssue`) |

### 6. Delayed projects (`delayedProjects`)

**Definition (explicit):** Project status ∈ {ACTIVE, ON_HOLD} AND (

- any `ProjectMilestone.status === MISSED`, **or**
- `plannedEnd != null && plannedEnd < asOf`

).

COMPLETED / CANCELLED / ARCHIVED are never delayed.  
No invented schedule engine beyond milestone status + project plannedEnd.

### 7. Ownership (`ownership`)

References only (Resource FKs — ADR-021):

- Initiative `businessOwnerResourceId`
- Project / PoC / Pilot `ownerResourceId`

Returns resource id, display name, and per-role counts. Name snapshots are not identity keys.

### 8. Dependencies (`dependencies`)

| Field | Source | Definition |
|---|---|---|
| `openDependencies` | `PlanningDependency` | status = OPEN in org |
| `criticalOpenDependencies` | same | criticality = CRITICAL |

Department-scoped views include a dependency only when source or target resolves to an in-scope Project (`PROJECT`) or Work Item on an in-scope Project (`WORK_ITEM`). Subjects are schema-limited to those types.

### 9. PI capacity (`piCapacity`)

| When available | Live aggregation via `capacity-policy` for PIs in PLANNING / REVIEW / BASELINED / ACTIVE where principal has `pi.view` |
|---|---|
| When unavailable | No such PI, or no in-scope participating teams with a **current** planning revision |

Does **not** read immutable `PiBaseline` payloads (historical snapshots).  
Overloaded = utilization band `overload` from existing thresholds.

## Non-goals (M2A)

- Portfolio UI / dashboards → delivered in M2B (`docs/PORTFOLIO-DASHBOARD.md`, route `/portfolio`)
- Portfolio tables or cached KPIs
- REST endpoints
- Weakening Phase 0C
- Inventing missing domain fields

## Server Action

```ts
getPortfolioSnapshotAction({ organizationId, departmentId?, asOf? })
→ ActionResult<PortfolioSnapshot>
```

## Limitations

- Initiative list-style org helpers elsewhere may still over-fetch by org; **this service** enforces department filters for aggregation.
- Capacity rows can be large for many PIs × iterations × teams; M2A returns full team-iteration rows for the in-scope set (UI should paginate later).
- Dependencies involving unattributable endpoints are excluded under department mode rather than approximated.
