# Project Platform — Navigation Architecture (M4C-A)

**Status:** M4C-A workflow-oriented navigation  
**Date:** 2026-10-09  
**Baseline main SHA:** `9a2f54707a06aac73e3cbdb84d4cf87e7d41e099`  
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

## 7. Deferred (M4C-B+)

- Shared breadcrumb service aligned to workflow groups (M4C-B).
- Merged “Home attention” feed from portfolio attention cards (no new engine in M4C-A).
- Auto-select latest REVIEW/ACTIVE PI shortcuts in global nav.
- Capability-aware Home quick links (strip currently static; pages still AuthZ).
- Collapsed “Organize / Work / Govern” super-groups if density requires.
