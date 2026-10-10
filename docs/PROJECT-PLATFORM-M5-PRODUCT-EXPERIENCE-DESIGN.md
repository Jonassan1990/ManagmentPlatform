# PROJECT PLATFORM — M5A

## Product Experience Architecture & Enterprise UX Redesign

**Status:** DESIGN PROPOSAL — ACCEPTED FOR IMPLEMENTATION PLANNING  
**Phase:** M5A (documentation only — **no code or schema changes**)  
**Role:** Principal Product Designer / Enterprise UX Architect / Product Strategist / Senior Frontend Architect  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `5adc8450333a3b951213a168c34ff161cb00802a`  
**Date:** 2026-10-10  
**Amended:** 2026-10-10 — product priority realignment (R1 paused; M5 primary)

**References:** M4 Final Acceptance (maturity **3.6/5**), M4 UX Audit, Navigation Architecture, Design System, UX Principles, `docs/ui-reference/resource-overview.html`, R1-A/B/C ops docs.

### Product priority (binding)

**R1 infrastructure and production release preparation are paused.**  
**Primary product focus is M5 — Product Experience & Visual Redesign.**

M5 must make the Management Platform **visually professional, intuitive, and genuinely useful** for managers, planners, and employees. Reuse existing architecture, business logic, APIs, and design system. Do **not** invent new scoring engines. Do **not** implement M5B in this document’s change set; do **not** modify production infrastructure here.

---

## 1. Executive Summary

M4 made the platform **coherent and shippable**. M5 makes it **immediately understandable and premium to use**.

| Today (M4) | Target (M5) |
|---|---|
| Capability-aware module shell | **Task-first workspaces** |
| Attention Home still metric-dense | **Role-aware Home** with My Work + next actions |
| Initiative tabs + lifecycle rail | **One connected journey** Idea → Delivery |
| Project nested under initiative | **Clear Project workspace** with delivery focus |
| PI tabs expose revision mechanics | **Planning language** (scenarios → plan → baseline) |
| Capacity powerful but token-inconsistent | **Resource Planning** aligned to reference visual language |

**Recommended product experience:** One premium enterprise app with role-aware **manager and employee dashboards**, five primary workspaces — **Home**, **Initiatives**, **Projects** (delivery lens), **PI Planning**, **Resources** — plus Portfolio (executive), Governance, Organization, and a **Reports** surface for exportable management outputs. Users always see: where to start, what they own, what needs attention, and the next action.

**M5A deliverable:** This design proposal + roadmap M5B–M5F. **STOP — do not implement M5B in this change set.**

---

## 2. Current UX Assessment

### 2.1 Strengths (keep)

- Capability-gated shell navigation and return-context (`resolve-shell-nav`, M4C/D).
- Initiative LifecycleRail + next-action copy (`initiative-journey`).
- PI Review stepper: select → promote → approve → baseline (M4D-B).
- Portfolio attention / Delivery Health / Explorer (M4E).
- Design tokens + primitives (Button, Dialog, StatusBadge, FormField, CapacityBar).
- Practical a11y/responsive hardening (M4F).

### 2.2 Remaining confusion (fix in M5)

| Area | User confusion |
|---|---|
| **Home** | Competes between KPI grids and attention; unclear “what do *I* do first?” |
| **Navigation** | Still reads as modules (Initiatives / PI / Portfolio) more than jobs-to-be-done |
| **Initiative ↔ Project** | Project lives as a tab; users ask “where is my project?” |
| **PI language** | “Revision”, scenario IDs, CURRENT vs SELECTED leak into UI |
| **Capacity** | Strong data, weaker visual hierarchy vs `resource-overview.html`; residual hardcoded hex |
| **Roles** | No dedicated PI Planner / Governance Reviewer persona packaging (permissions exist) |
| **Quick create** | Create Initiative / PI exists but not framed as Quick Start on Home |

### 2.3 Maturity target

| Dimension | M4 FINAL | M5 target |
|---|---|---|
| Overall | 3.6 | **4.2+** after M5B–M5E |
| Role-based Home | Partial | First-class |
| Workflow clarity | 3.7 | 4.3 |
| Visual consistency | 3.6 | 4.2 (resource-overview alignment) |

---

## 3. Target Product Experience

### 3.1 Product promise

> Managers open the platform and immediately know **what needs them**, **what they own**, and **how to move work from idea to delivery** — without learning internal schema vocabulary.

### 3.2 Experience pillars

1. **Start here** — Role-aware Home with one primary next action.
2. **Own it** — My Work lists initiatives, projects, PIs, approvals tied to the principal / linked Resource where available.
3. **Fix attention** — Needs Attention uses existing delivery-health + overview metrics only.
4. **One journey** — Initiative workspace is the spine from Idea to Project.
5. **Plan with people language** — PI Planning hides revision mechanics behind Scenario / Current plan / Approved baseline.
6. **See capacity** — Resource Planning mirrors the reference: KPI strip → department cards → expandable resources.

### 3.3 Non-goals (M5A)

- New business scoring engines or invented KPIs.
- Schema / auth / RBAC redesign.
- Full WCAG certification claim (continue practical a11y).
- Replacing Portfolio Health contracts.

---

## 4. Persona Workspaces

Permissions remain RoleBinding-based. Personas below are **UX packaging**, not new ROLE_KEYs (unless later M5 introduces optional packs).

### 4.1 Portfolio Manager

| Aspect | Design |
|---|---|
| Landing | Home → Portfolio Summary + Needs Attention (org-wide) |
| Responsibilities | Cross-initiative health, PI readiness, capacity balance |
| Primary actions | Open Delivery Health, Explorer, Portfolio Capacity, current PI Review |
| Attention | Blocked/at-risk projects; PIs needing review; overload |
| Workflows | Attention → project/initiative; Capacity → PI board |
| Nav | Home, Portfolio (default open), PI Planning, Initiatives |

### 4.2 Department Manager

| Aspect | Design |
|---|---|
| Landing | Home scoped to department when capability/org context allows |
| Responsibilities | Demand intake, department capacity, team load |
| Primary actions | Create Initiative, open Resource Planning (dept), review approvals in scope |
| Attention | Department initiatives waiting gate; team overload |
| Nav | Home, Initiatives, Resources, Portfolio Capacity |

### 4.3 Team Manager

| Aspect | Design |
|---|---|
| Landing | Home → My Work (team initiatives/projects) + capacity warnings |
| Responsibilities | Team allocation, iteration load, blockers |
| Primary actions | Open PI board for team, resolve blockers, adjust allocations |
| Attention | Over-allocated resources; blocked work items |
| Nav | Home, PI Planning, Resources, Initiatives |

### 4.4 Project Manager

| Aspect | Design |
|---|---|
| Landing | Home → Active Projects + My Work |
| Responsibilities | Delivery progress, issues, milestones, closure |
| Primary actions | Open Project workspace, log issues, update milestones |
| Attention | Blocked issues; at-risk delivery health |
| Nav | Home, Initiatives (project tab), Portfolio Health |

### 4.5 PI Planner

| Aspect | Design |
|---|---|
| Landing | Home → Current PI card (Continue planning) |
| Responsibilities | Scenarios, capacity fit, selection, promotion |
| Primary actions | Board → Compare → Review |
| Attention | Conflicts; readiness NOT_READY |
| Nav | Home, PI Planning (primary), Resources |

### 4.6 Governance Reviewer

| Aspect | Design |
|---|---|
| Landing | Home → Needs Attention (waiting approval) + Governance Approvals |
| Responsibilities | Gate reviews, decisions, evidence |
| Primary actions | Approvals queue → Initiative Governance tab |
| Attention | Pending approvals/decisions |
| Nav | Home, Governance, Initiatives |

### 4.7 Organization Admin

| Aspect | Design |
|---|---|
| Landing | Home → Quick Start (org setup) + Access |
| Responsibilities | Structure, resources, role bindings, policy |
| Primary actions | Organization hub, Access & roles, Governance policy |
| Attention | Unassigned ownership; access requests (manual today) |
| Nav | Home, Organization, Governance (policy) |

### 4.8 Viewer

| Aspect | Design |
|---|---|
| Landing | Home read-only summary |
| Responsibilities | Observe portfolio/initiatives in scope |
| Primary actions | Navigate overview pages only |
| Attention | Visible but non-actionable (no mutate CTAs) |
| Nav | Home, Portfolio, Initiatives, PI (read paths); hide Create |

### 4.9 Employee (individual contributor)

Employees are not a separate permission pack today; UX packages the **linked Resource + Viewer/Team-scoped bindings** into a lighter dashboard.

| Aspect | Design |
|---|---|
| Landing | **My Work** first: assigned initiatives/projects, personal capacity load, open issues owned via Resource link where queryable |
| Responsibilities | See commitments, blockers affecting their work, PI iteration context |
| Primary actions | Open project/initiative; view PI board read-only unless allocate permission |
| Attention | Personal overload; blocked work items touching their Resource |
| Frequent workflows | Home → Project → Issues; Home → PI capacity (self row) |
| Nav | Home (employee layout), Initiatives, Projects, PI Planning (read), Resources (self) |
| Constraints | No invented personal score; reuse ownership/Resource link + capacity-policy rows; hide Create/Approve CTAs without permission |

### 4.10 Manager vs employee dashboard modes

| Mode | When | Emphasis |
|---|---|---|
| **Manager dashboard** | Org/Dept/Team/Portfolio/Project manage or PI/gov permissions | Needs Attention, team/dept KPIs, approvals, capacity overload, Quick Start creates |
| **Employee dashboard** | Limited mutate; Resource-linked principal | My Work, my load, my blockers; quieter portfolio summary |

Same Home route; **composition switches by capabilities** (`PrincipalCapabilities` / shell caps) — not a second app.

---

## 5. Home Design

### 5.1 Layout (desktop)

```
┌─────────────────────────────────────────────────────────────┐
│ Greeting + org context                                      │
├───────────────┬─────────────────────────┬───────────────────┤
│ Needs         │ My Work                 │ Quick Start       │
│ Attention     │ (initiatives/projects/  │ (capability-gated)│
│ (existing     │  PIs / approvals)       │                   │
│  health +     ├─────────────────────────┤ Portfolio Summary │
│  overview)    │ Current PI              │ (snapshot tiles)  │
│               │ Active Projects         │ Resource Capacity │
│               │                         │ (CURRENT-only)    │
└───────────────┴─────────────────────────┴───────────────────┘
│ Recent Activity (audit-backed, optional progressive)        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Sections → existing contracts

| Section | Data source (reuse only) |
|---|---|
| Needs Attention | `getDeliveryHealthSummary`, `listDeliveryHealthAttention`, overview/PI attention counts (`home-experience`, portfolio query) |
| My Work | Initiatives/projects filtered by ownership Resource link / principal display where already queryable; approvals list if `canViewApprovals` |
| Quick Start | `buildHomeQuickLinks` / capabilities — Create Initiative, Create PI, Open Approvals, Org setup |
| Portfolio Summary | `getPortfolioSnapshot` / overview metrics (counts already exposed) |
| Current PI | `selectAuthorizedPiEntry` + executive PI metrics |
| Active Projects | Portfolio explorer / overview project counts + deep links |
| Resource Capacity | `PortfolioPiCapacityQueryService` summary (CURRENT only) — progressive, not full hierarchy on Home |
| Recent Activity | Existing `AuditEvent` feed if/when listed for principal — **progressive disclosure**; omit if no safe list API yet |

### 5.3 Actionable management KPIs (Home & Portfolio)

KPI cards must be **actionable** (click → filtered list or workspace), not decorative.

| KPI (label) | Source contract | Click-through |
|---|---|---|
| Blocked / at-risk delivery | Delivery health summary counts | `/portfolio/health` |
| Initiatives needing attention | Overview metrics | `/initiatives` (filtered when UI supports) |
| Waiting approval | Overview / approvals capability | `/approvals` |
| PIs needing attention | Executive PI metrics | `/pi` or current PI Review |
| Capacity overload | Portfolio PI capacity conflicts | `/portfolio/capacity` |
| Active projects | Overview / portfolio snapshot | Projects index → project workspace |

**Rule:** every KPI value already exists in query services; M5 only improves presentation and affordances.

### 5.4 Principles

- **One hero next action** above the fold (e.g. “Review 3 approvals” or “Continue PI 2026.Q4”).
- KPI cards use resource-overview pattern (left rail color, large value, short note) — **no new formulas**.
- Manager mode: Attention + KPIs dominant; Employee mode: My Work dominant.
- Mobile: Attention → My Work → Quick Start stack; hide dense capacity until expand.

---

## 5A. Reports & exportable management outputs

There is **no first-class CSV/PDF export** in the product today. M5 introduces a **Reports** experience as composition + export of existing read models — still no new business calculations.

### 5A.1 Target reports (design)

| Report | Audience | Data basis | Export (implementation phase) |
|---|---|---|---|
| Portfolio attention | Portfolio / Dept managers | Delivery health attention list | CSV / print stylesheet |
| Initiative pipeline | Portfolio / Dept | Overview metrics + explorer rows | CSV |
| PI plan summary | PI Planner / Portfolio | Current plan allocations + readiness | CSV / print |
| Capacity & overload | Dept / Team managers | Portfolio PI capacity + conflicts | CSV |
| Approval queue | Governance reviewers | Approvals list | CSV |
| Project delivery status | Project / Portfolio managers | Health classification + milestones/issues counts | CSV / print |

### 5A.2 UX placement

- Shell: **Reports** under Portfolio (or top-level if capability `canViewPortfolio`-class).
- Each major workspace: **Export** affordance on list/table toolbars (Explorer, Health, Capacity, Approvals).
- Exports respect AuthZ (same scope as on-screen query); never bypass RoleBindings.
- Prefer **CSV + browser print** for M5; PDF generation is optional later — do not block M5 on PDF infra.

### 5A.3 Non-goals

- Ad-hoc BI warehouse, custom formula builder, or third-party BI embed in M5.
- Exporting secrets, auth tokens, or full audit dumps to end users.

---

## 6. Initiative Workspace

### 6.1 Spine

**Idea → Requirements → Pre-study → Governance → PoC → Pilot → Project**

Preserve domain stages; improve **orientation**, not state machine.

### 6.2 Workspace chrome

| Element | Behavior |
|---|---|
| Header | Name, StatusBadge, owner, org/dept breadcrumb |
| Lifecycle progress | Horizontal stage stepper (business labels only) |
| Current stage callout | Stage + gate status + blocked reason |
| Next action | Primary button from `describeInitiativeNextAction` |
| Pending decisions / approvals | Panel from existing governance lists |
| Evidence | Documents / readiness evidence links |
| History | Existing history tab / rail |

### 6.3 Information architecture

Keep tab **groups** (Overview · Discovery · Governance · Validation · Delivery · History) from M4D-C. Enhance Overview as the **situation page** (progress + next action + pending), not a blank summary.

### 6.4 Language

Prefer “Stage”, “Gate”, “Decision”, “Evidence” — avoid internal enum names in primary UI.

---

## 7. Project Workspace

### 7.1 Positioning

Project remains the Delivery stage of an Initiative **and** must feel findable as “a project.”

**M5 recommendation:**

1. Keep canonical route `/initiatives/[id]/project` (no schema move).
2. Add **Projects** entry in shell (capability-gated) that lists active projects (Portfolio Explorer filtered / overview) and deep-links into the initiative project workspace.
3. Optional breadcrumb: Portfolio → Project name → Initiative context.

### 7.2 Sections (align to existing chips)

| Section | Purpose |
|---|---|
| Overview | Health, owner, initiative link, next action |
| Delivery progress | Milestone + work completion signals already stored |
| Milestones | Existing milestone UI |
| Work items | Existing work items |
| Issues / Blockers | Issues list; surface blocked first |
| Risks | Existing risks |
| Team / Resources | Linked resources / allocations pointers (no new engine) |
| Closure | Existing closure flow |

### 7.3 Tone

Delivery-manager language: “Blockers”, “Milestones”, “Close project” — not schema table names.

---

## 8. PI Planning Workspace

### 8.1 User-facing vocabulary

| Avoid in primary UI | Prefer |
|---|---|
| PlanningRevision / CURRENT id | **Current plan** |
| SELECTED revision | **Selected scenario** |
| Promote revision | **Apply scenario to current plan** |
| Baseline versionNumber | **Approved baseline** |

Technical terms may remain in Settings / audit detail.

### 8.2 Workspace structure

Retain `PiTabs` routes; re-label and sequence for planners:

1. **Overview** — PI context, dates, owner, status, shortcut to Review if pending.
2. **Plan board** — iterations, work items, capacity bars, scenario switcher (progressive).
3. **Capacity** — team/resource load for this PI.
4. **Scenarios** — create/clone/rename/archive (today partly on board).
5. **Compare** — side-by-side scenarios.
6. **Review** — Select → Apply → Approve → Baseline stepper (M4D-B choreography).
7. **Baseline** — immutable snapshots.
8. **Dependencies / Settings** — secondary.

### 8.3 Planner mental model

```
Explore scenarios → Compare → Select → Apply to current plan → Approve → Baseline
```

Readiness classifications stay: READY / READY_WITH_WARNINGS / NOT_READY / UNAVAILABLE (`PI-SCENARIO-SELECTION-READINESS`).

---

## 9. Resource Planning Workspace

### 9.1 Visual target

Align to `docs/ui-reference/resource-overview.html`:

- Navy header / strong navy titles.
- Teal primary accent and active nav soft-fill.
- KPI strip with left color rails (ok / warn / critical).
- Department cards → expandable resource rows with utilization bars.
- Capacity pills: ok / high / over.
- Progressive disclosure for cross-project commitments.

### 9.2 Information architecture

| View | Content | Contract |
|---|---|---|
| Department overview | KPI + dept cards | Portfolio PI capacity + org hierarchy |
| Team capacity | Team util within dept | Capacity policy / PI capacity |
| Resource allocation | Per-resource load | Existing allocation + capacity engines |
| Overload warnings | Conflicts / over util | Existing conflict detection |
| Cross-project commitments | Stacked segments when data exists | Reference legend pattern; only if allocations expose sources |
| PI capacity context | Link to PI board/capacity | Return-context (M4E-D) |

### 9.3 Placement

- Shell: **Resources** group → Portfolio Capacity (primary) + Org Resources.
- Home: compact Capacity card linking here.
- Do **not** invent new utilization formulas — reuse `capacity-policy` / CURRENT-only rules.

### 9.4 Token debt

Replace residual hardcoded `#74848e` / `#087f78` on capacity surfaces with design tokens (`--muted`, reference teal or `--accent`) during M5E implementation.

---

## 10. Navigation Model

### 10.1 Proposed shell (task-first)

| Group | Items | Notes |
|---|---|---|
| **Home** | `/` | Manager or employee dashboard mode |
| **My work** (optional subgroup) | Shortcuts from Home | Or keep inside Home only for M5B |
| **Portfolio** | Overview, Explorer, Delivery health, Capacity, **Reports** | Executive + exports |
| **Initiatives** | All, Create | Journey spine |
| **Projects** | Active projects list | Deep-link to initiative project workspace |
| **PI Planning** | All PIs, Create PI | Planner primary |
| **Resources** | Capacity, Org resources | Resource planning |
| **Governance** | Approvals, Decisions, Policy | Reviewer |
| **Organization** | Hub, Access | Admin |

Keep capability filtering; empty groups hidden (M4C).

### 10.2 Contextual nav

- Initiative stage tabs / groups unchanged in spirit.
- PI tabs relabeled per §8.
- Always show breadcrumbs: Org → … → entity.

### 10.3 Quick Start

Home + empty states expose the same capability-gated creates — never dead-end.

---

## 11. Visual Design Direction

### 11.1 Palette (align design system + reference)

| Role | Value | Usage |
|---|---|---|
| Navy | `#102a43` | Navigation, headings |
| Teal accent | `#087f78` / system accent | Primary CTAs, active states, KPI rails |
| Surface | White / `#f3f6f7`–`#f4f6f8` | Cards, page bg |
| Muted | `#5b6b7c` / `#74848e` | Secondary text (tokenized) |
| Status | Existing StatusBadge semantic colors | Consistent badges |

### 11.2 Typography

Retain Source Sans 3 / Source Serif 4 (design system). Strong hierarchy: page title → section → card metric.

### 11.3 Components

- KPI cards with left rail (reference).
- Panels with light border; avoid heavy multi-shadow stacks.
- StatusBadge everywhere for lifecycle/health.
- CapacityBar + util tracks.
- ConfirmDialog for irreversible planning/governance actions.

### 11.4 Motion

Subtle only: nav active state, accordion expand, dialog enter — **no decorative gradients or gratuitous animation** (matches user frontend rules for enterprise surfaces; reference is calm).

### 11.5 Density

Enterprise-comfortable: 14px base, clear 8/12 spacing, KPI value ~24–28px.

### 11.6 Premium modern enterprise bar

“Premium” here means **clarity and craft**, not ornament:

- Consistent navy/teal system, generous whitespace, crisp KPI cards.
- Predictable hierarchy and status language across Home → Initiative → Project → PI → Resources.
- Polished empty/loading/error states using existing EmptyState / Alert / LiveRegion.
- Soft elevation only where it aids scanning (reference card shadow), not multi-layer glow.

---

## 12. Component Reuse

| Need | Reuse |
|---|---|
| Page chrome | `PageHeader`, `Breadcrumbs`, `Panel`, `EmptyState` |
| Actions | `Button`, `ConfirmDialog` |
| Status | `StatusBadge` + `status-adapters` |
| Tables | `DataTable` |
| Forms | `FormField` |
| Capacity | `CapacityBar` |
| Shell | `AppShell`, `AuthenticatedShell` |
| Home attention | `HomeAttentionPanel` patterns |
| Initiative | `LifecycleRail`, workspace tabs |
| PI | `PiTabs`, Review stepper |
| Portfolio | Dashboard / Explorer / Health / Capacity views |

**New UI (implementation phases):** Home “My Work” list composition; Projects index; Resource overview card density; PI glossary labels — mostly composition, not new primitives.

---

## 13. Accessibility

Carry M4F forward:

- Skip link + focus main.
- ≥44px primary controls.
- FormField labeling / errors.
- LiveRegion for async outcomes.
- Keyboard paths for board/dialogs (complete cell roving in M5C/D as needed).
- Do not claim WCAG 2.2 AA certification until audited.

Role-aware UI must **hide** unavailable actions without removing server AuthZ.

---

## 14. Responsive UX

| Breakpoint | Behavior |
|---|---|
| Desktop (≥1200) | Home 3-column; capacity dept grid 2-col |
| Tablet | 2-column Home; PI tabs scroll |
| Mobile (360+) | Single column; drawer nav; Attention first; sticky primary CTA |

Preserve M4F-B matrix expectations; Resource Planning collapses dept grid to 1-col like the HTML reference.

---

## 15. M5B–M5F Roadmap

R1 remains paused unless a critical production incident requires it. M5 sequence:

| Phase | Focus | Outcomes |
|---|---|---|
| **M5B** | Dashboards + navigation IA | Manager/employee Home modes; actionable KPI click-throughs; Projects + Resources nav; Quick Start |
| **M5C** | Initiative + Project workspaces | Situation Overview; Projects index; delivery section polish |
| **M5D** | PI Planning language + Review UX | Relabels; planner flow; hide revision jargon |
| **M5E** | Resource Planning + Reports | KPI/dept cards; token fix; reference density; CSV/print exports from existing lists |
| **M5F** | Hardening & acceptance | A11y/responsive/role QA (incl. employee mode); maturity re-score; UX gate for continued product work |

Dependencies: reuse existing contracts only; OIDC multi-user (R1-B) improves multi-persona QA but is **not** required to start M5B composition against capability flags / DEV personas.

---

## 16. Acceptance Criteria (for later implementation phases)

### M5A (this document)

- [x] Personas, Home, Initiative, Project, PI, Resource, Nav, Visual, Roadmap documented.
- [x] No code/schema changes.
- [x] Data contracts mapped without invented metrics.

### Future M5B+ (preview)

- [ ] Home shows Needs Attention + My Work + Quick Start using existing APIs.
- [ ] Manager vs employee dashboard compositions switch by capabilities.
- [ ] KPI cards click through to existing filtered workspaces.
- [ ] Shell exposes Projects + Resources (+ Reports) groupings as designed.
- [ ] Initiative Overview presents stage, owner, next action above the fold.
- [ ] PI UI copy uses Current plan / Scenario / Baseline in primary flows.
- [ ] Resource Planning matches reference hierarchy (KPI → dept → resource).
- [ ] At least CSV or print export for attention / capacity / approvals lists (AuthZ-scoped).
- [ ] No regression to M4F a11y/responsive gates.
- [ ] Viewer/employee cannot see mutate CTAs; AuthZ unchanged.

---

## 17. Evidence Appendix

| Evidence | Location |
|---|---|
| M4 maturity 3.6/5 | `docs/PROJECT-PLATFORM-M4-FINAL-ACCEPTANCE.md` |
| M4A audit | `docs/PROJECT-PLATFORM-M4-UX-AUDIT.md` |
| Navigation | `docs/PROJECT-PLATFORM-NAVIGATION-ARCHITECTURE.md`, `src/modules/navigation/*` |
| Design system | `docs/PROJECT-PLATFORM-DESIGN-SYSTEM.md`, `src/styles/design-tokens.css` |
| UX principles | `docs/UX-PRINCIPLES.md` |
| Visual reference | `docs/ui-reference/resource-overview.html` |
| Home implementation | `src/app/page.tsx`, `src/modules/navigation/home-experience.ts` |
| Initiative journey | `src/modules/initiative/application/initiative-journey.ts` |
| PI Review | `docs/PROJECT-PLATFORM-M4D-B-REVIEW-UX.md` |
| Capacity | `docs/PROJECT-PLATFORM-M4E-B-CAPACITY-UX.md` |
| Portfolio contracts | `docs/PORTFOLIO-QUERY-CONTRACT.md`, delivery-health contract |
| Baseline SHA | `5adc8450333a3b951213a168c34ff161cb00802a` |

---

## Top UX Improvements (priority)

1. **Manager & employee dashboards** — role-aware Home with clear starting points.
2. **Actionable KPIs** — every tile drills into real lists (health, approvals, capacity, PIs).
3. **Task-first nav** — Projects + Resources + Reports as first-class groups.
4. **Initiative situation Overview** — stage, owner, next action, pending gates.
5. **PI human language** — hide revision jargon in primary planner flows.
6. **Resource Planning visual system** — match `resource-overview.html` + tokenize capacity colors.
7. **Exportable management outputs** — CSV/print from existing portfolio/PI/governance queries.

---

**M5A COMPLETE — DESIGN PROPOSAL READY**

STOP. Do not implement M5B in this change set.
