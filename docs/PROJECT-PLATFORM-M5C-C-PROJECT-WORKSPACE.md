# PROJECT PLATFORM — M5C-C

## Premium Project & Delivery Workspace

**Status:** IMPLEMENTED  
**Phase:** M5C-C — Project / Delivery workspace UX (presentation only)  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `fb6208c` (M5C-B merged)  
**Branch:** `cursor/m5cc-project-workspace-60bb`

**STOP:** Does **not** implement M5C-D.

**Related:** [M5 Design](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md), [M5C-A Initiative Workspace](./PROJECT-PLATFORM-M5C-A-INITIATIVE-WORKSPACE.md), [M5C-B Governance UX](./PROJECT-PLATFORM-M5C-B-GOVERNANCE-UX.md), [Design System](./PROJECT-PLATFORM-DESIGN-SYSTEM.md)

---

## 1. Workspace architecture

### Trace

```
Initiative Overview (M5C-A)
  → Pilot / Decisions (M5C-B)
       → Convert to Project (existing authorized action)
  → Project workspace (M5C-C)
       A. Project header (ref, title, status, owner, initiative origin, dates, health)
       B. Delivery summary KPIs (milestones / work / issues / blockers / completion)
       C. Next action (authorized, with unavailable reasons)
       D. Management attention (critical / delayed / blockers / pending work)
       E. Sections: Overview · Delivery · Issues & Risks · Resources · Closure · History
```

No Prisma schema, RBAC, ProjectIssue, ProjectClosure, milestone/work-item, ownership, or audit semantics changes. No new delivery formulas — reuses `evaluateDeliveryHealth` and issue-policy counts.

### Presentation helpers

| Helper | Role |
|---|---|
| `resolveProjectOwnerDisplay` | Linked Resource → name snapshot → missing |
| `summarizeDeliveryProgress` | Counts from stored milestone / work / issue summary |
| `buildManagementAttention` | Blockers, critical issues, delayed milestones, pending work |
| `describeProjectNextAction` | Create / resolve blockers / delayed / close / plan work / idle |
| `evaluateProjectDeliveryHealth` | Thin wrapper over existing `evaluateDeliveryHealth` |

### Deep links preserved

Section anchors: `#overview`, `#delivery`, `#work`, `#milestones`, `#issues`, `#resources`, `#closure`, `#history`.  
Issue filter query params (`issueStatus`, `issueSeverity`, `issueBlocker`) unchanged.

---

## 2. Project header & delivery summary

| Field | Source |
|---|---|
| Reference / title | Project |
| Status | `StatusBadge` via `mapProjectStatusBadge` |
| Owner | `ownerResource` include + `ownerName` snapshot |
| Initiative origin | Link to initiative overview |
| Planned start / end | Project dates (or “Not set”) |
| Delivery health | Existing evaluator classification + first reason |
| Purpose | `objectives` or `description` |

KPI strip: milestones, work items, open issues, active blockers, completion label — not equal-priority marketing cards; completion is a secondary indicator from stored statuses.

---

## 3. Management attention & next action

**Attention** lists only recorded blockers, open CRITICAL issues, missed/past-due milestones, and open work remainder.

**Next action** uses `NextActionPanel`:

- No project → Pilot convert path
- Closed → view closure (read-only)
- Active blockers → resolve (blocked tone; permission note when viewer)
- Delayed milestones → open milestones
- Closure ready → review closure / permission denial made explicit
- Open work → plan work
- Else idle → check closure readiness

No silent controls: unavailable actions explain permission or readiness.

---

## 4. Closed projects

Closed when status is `COMPLETED` / `CANCELLED` or a `ProjectClosure` row exists.

| Shown | Hidden |
|---|---|
| `ClosedProjectSummary` + `ClosedProjectBanner` (outcome, date, actor, summary) | Create/Update project, work, milestone, issue, budget forms |
| Historical lists | Misleading editable submit controls |
| Closure section read-only | Close form |

---

## 5. Screenshots

Captured under `docs/acceptance-assets/m5cc/screenshots/` by `scripts/m5cc-browser-qa.mjs`:

| File | Journey |
|---|---|
| `01-active-overview.png` | Active project chrome |
| `02-blocked.png` | Active blockers |
| `03-delayed.png` | Delayed milestones |
| `04-completed-closed.png` | Completed read-only |
| `05-cancelled-closed.png` | Cancelled read-only |
| `06-missing-data.png` | Sparse / missing owner & dates |
| `07-no-project.png` | Empty convert path |
| `08-owner-editable.png` | Owner / manager mutations |
| `09-viewer.png` | Viewer mode |
| `10-tablet.png` / `11-mobile.png` / `12-desktop-blocked.png` | Responsive |

---

## 6. Before / after usability measurements

Structural counts from browser QA on seeded fixtures (not user-study claims):

| Metric | Before (dense project page) | After (M5C-C) |
|---|---|---|
| Steps to find blocker | 2–3 (scroll issues list / filters) | **0** — Next action + Management attention |
| Steps to find owner | 1–2 (scan update form) | **0** — Header field |
| Steps to find milestone status | 2 (scroll Delivery) | **0–1** — KPI strip / `#milestones` nav |
| Steps to find next action | 2 (sidebar / closure panel) | **0** — `NextActionPanel` above fold |
| Closed project clarity | Banner only; forms still rendered disabled | Banner + summary; mutation forms **hidden** |

---

## 7. Accessibility

| Check | Result |
|---|---|
| Semantic headings | Workspace `h1` + section `h2` / `h3` |
| Section nav | `nav[aria-label="Project sections"]` with `#` anchors |
| Status labels | `StatusBadge` + text |
| Closed state | Alert + explicit read-only copy |
| Mobile | QA tablet/mobile journeys (no horizontal overflow) |

---

## 8. Role-aware UX

| Persona | Behavior |
|---|---|
| Org Admin / Project editor | Header KPIs + mutation forms when project open |
| Project owner (capability) | Same as editor when `canEditProject` |
| Viewer | Readable header / attention / issues; next action may note missing edit permission |
| Closed project (any role) | Read-only summary; no create/update controls |
| No project yet | Empty state + Pilot CTA (conversion remains explicit) |

RBAC `assertCan` / capability flags unchanged.

---

## 9. Known limitations

- Delivery health still uses existing evaluator (empty critical-dependency list on this page — same as prior project surface).
- Closure confirm remains checkbox acknowledgement (existing Phase 1D pattern), not a new ConfirmDialog.
- Initiative risk register stays linked; issues do not invent risk KPIs.
- Sparse fixtures honestly show “Not set” / empty attention — no invented owners or dates.

---

## 10. Tests

| Suite | Coverage |
|---|---|
| `tests/unit/project-presentation-m5cc.test.ts` | Owner display, delivery counts, attention, next action, health wrap, closed detection |
| Existing project / issue / closure integration | Domain rules unchanged |

Browser: `scripts/m5cc-seed-browser.mts` + `scripts/m5cc-browser-qa.mjs`  
Fixtures: active, blocked, delayed, completed, cancelled, missing data, no-project, viewer, owner, tablet, mobile.

---

## 11. M5C-D handoff

**M5C-D** (out of scope here) should:

- Not reopen ProjectIssue / ProjectClosure / health calculation semantics
- Build on this workspace chrome for any further delivery/portfolio polish
- Preserve deep links and closed read-only behavior

---

## 12. Quality gates

Run before merge:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
- Browser QA: `node scripts/m5cc-browser-qa.mjs`
