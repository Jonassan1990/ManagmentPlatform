# Portfolio Delivery Health Contract (M2D-A)

**Status:** Implemented (query layer only — no UI)  
**Module:** `src/modules/portfolio/`  
**Classifier:** `application/delivery-health.ts` (pure)  
**Service:** `PortfolioQueryService`  
**Actions:** `getDeliveryHealthSummaryAction`, `listDeliveryHealthAttentionAction`, `getProjectDeliveryHealthAction`

Pre-implementation signal inventory: [M2D-A-SIGNAL-EVIDENCE.md](./M2D-A-SIGNAL-EVIDENCE.md).

---

## Purpose

Provide a **deterministic, explainable, read-only** delivery-health classification for Projects so management attention can be scoped without inventing a second status machine, numerical health score, or persisted health ledger.

---

## Classifications

| Classification | Meaning |
|---|---|
| `BLOCKED` | Non-terminal Project with ≥1 active blocker Issue |
| `AT_RISK` | Non-terminal Project with critical/open schedule or dependency adversity, no active blocker |
| `ON_TRACK` | Non-terminal Project with schedule/progress evidence and **no** adverse signals |
| `COMPLETED` | `Project.status === COMPLETED` (closure outcome preserved when present) |
| `CANCELLED` | `Project.status === CANCELLED` — **never** reported as COMPLETED |
| `UNKNOWN` | Non-terminal Project lacking sufficient schedule/progress evidence and no adverse signals |

`ARCHIVED` Projects are excluded from portfolio health (same as M2A).

---

## Precedence

Evaluated against a single `asOf` timestamp:

1. `CANCELLED` → **CANCELLED**
2. `COMPLETED` → **COMPLETED** (preserve `ProjectClosure.outcome` when present)
3. Active blocker (`isActiveBlockerIssue`) → **BLOCKED** (other adverse reasons still listed)
4. Critical open Issue **or** overdue critical milestone → contributes to **AT_RISK**
5. Other missed/overdue milestones, overdue `plannedEnd`, or attributable critical open dependency → **AT_RISK**
6. Sufficient schedule evidence + no adverse reasons → **ON_TRACK**
7. Otherwise → **UNKNOWN** (`INSUFFICIENT_SCHEDULE_DATA`)

`ACTIVE` and `ON_HOLD` share the non-terminal evaluation path.

---

## Reason codes

| Code | Severity | Typical source |
|---|---|---|
| `ACTIVE_BLOCKER_ISSUE` | blocker | `PROJECT_ISSUE` |
| `CRITICAL_OPEN_ISSUE` | critical | `PROJECT_ISSUE` (non-blocker critical open) |
| `OVERDUE_CRITICAL_MILESTONE` | critical | `PROJECT_MILESTONE` (`criticality` + MISSED or plannedDate < asOf) |
| `MISSED_MILESTONE` | warning | `PROJECT_MILESTONE` (non-critical overdue/MISSED) |
| `OVERDUE_PROJECT_END` | warning | `PROJECT` (`plannedEnd < asOf`) |
| `CRITICAL_DEPENDENCY` | critical | `PLANNING_DEPENDENCY` |
| `INSUFFICIENT_SCHEDULE_DATA` | info | `EVALUATION` |
| `SCHEDULE_EVIDENCE_PRESENT` | info | `EVALUATION` (ON_TRACK only) |
| `PROJECT_COMPLETED` | info | `PROJECT` / `PROJECT_CLOSURE` |
| `PROJECT_CANCELLED` | info | `PROJECT` / `PROJECT_CLOSURE` |

Each reason includes: `code`, `severity`, `message`, `sourceType`, `sourceId` (nullable), `relevantAt`, `relevantStatus`.

**No arbitrary numerical health score.** Missing evidence is never invented.

---

## Signal definitions (canonical reuse)

| Signal | Definition | Policy reused |
|---|---|---|
| Active blocker | `isBlocker && status ∉ {RESOLVED, CLOSED}` | Phase 1C `isActiveBlockerIssue` |
| Critical open issue | non-terminal + `severity === CRITICAL` (and not already counted solely as the active-blocker reason for the same row) | Phase 1C `isTerminalIssueStatus` |
| Missed / overdue milestone | `status === MISSED` **or** (`status ∈ {PLANNED, IN_PROGRESS, MISSED}` and `plannedDate < asOf`) | MilestoneStatus + M2A lateness style (`< asOf`) |
| Critical milestone | `ProjectMilestone.criticality === true` | schema |
| Overdue project end | `plannedEnd != null && plannedEnd < asOf` | M2A delayed |
| Critical dependency | `PlanningDependency.status === OPEN` and `criticality === CRITICAL`, attributable when a PROJECT endpoint is the project or a WORK_ITEM endpoint belongs to the project | Canonical `PlanningDependency` |
| Schedule evidence | `plannedEnd` or `plannedStart` set, **or** a non-cancelled milestone with plannedDate / IN_PROGRESS / COMPLETED / MISSED | Explicit sufficiency gate for ON_TRACK |
| Closure outcome | `ProjectClosure.outcome` | Phase 1D / ADR-025 |

Date comparisons use **strict less-than** `asOf` (same boundary as M2A delayed).

Resolved blockers (`RESOLVED` / `CLOSED`) never keep a Project in **BLOCKED**.

---

## Attention

`attentionCount = counts.BLOCKED + counts.AT_RISK`.

Default attention list returns Projects classified **BLOCKED** or **AT_RISK**. Callers may request other classifications explicitly.

---

## Query APIs

### `getDeliveryHealthSummary`

Returns `counts` for all six classifications, `attentionCount`, `totalProjects`, `asOf`, and applied `scope`.

### `listDeliveryHealthAttention`

Paginated Project rows with structured `reasons`, safe `href` (`/initiatives/{initiativeId}/project`), department/section labels, stable sort:

- Primary: `classification` | `name` | `updatedAt` | `plannedEnd`
- Tie-breakers: `referenceKey`, then `id`

Filters: `organizationId`, optional `departmentId`, optional `sectionId` (never expands Phase 0C visibility).

### `getProjectDeliveryHealth`

Single Project evaluation; 404 if outside scoped visibility.

---

## Authorization

Reuses Phase 0C `resolvePortfolioVisibility`:

- Organization Admin / org-wide Viewer: organization mode
- Section / Department / Team-scoped managers: department-narrowed mode
- Explicit department/section filters only **narrow**
- Cross-organization access denied
- Sibling-department isolation preserved
- Project ownership does **not** expand portfolio-wide visibility

---

## Data sources

Authoritative tables only:

- `Project`, `ProjectClosure`, `ProjectIssue`, `ProjectMilestone`
- `PlanningDependency`, `ProjectWorkItem` (for dependency attribution)
- `Department` / `Section` (labels + section filter)

No Portfolio tables, caches, or persisted scores.

---

## Limitations

- Does not run the PI conflict engine or capacity model for project health.
- Does not invent milestone lateness beyond `MISSED` status and `plannedDate < asOf`.
- Does not reclassify Issues, Milestones, or Project status.
- Dependencies are attributed only for PROJECT / WORK_ITEM subjects (schema-limited).
- ON_TRACK requires positive schedule/progress evidence; silence is UNKNOWN.
- UI for delivery health is out of scope for M2D-A (see M2D-B).
