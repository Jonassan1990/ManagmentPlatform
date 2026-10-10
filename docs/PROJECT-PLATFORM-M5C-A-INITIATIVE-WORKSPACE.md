# PROJECT PLATFORM — M5C-A

## Premium Initiative Workspace & Lifecycle Experience

**Status:** IMPLEMENTED  
**Phase:** M5C-A — Initiative Workspace (presentation / IA only)  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `e541f931f3023d41244bf9b523742975f61e013f`  
**Branch:** `cursor/m5ca-initiative-workspace-60bb`

**STOP:** Does **not** implement M5C-B (Governance & Experimentation Workspace polish beyond Overview situation page).

**Related:** [M5 Design](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md), [M5B Home Acceptance](./PROJECT-PLATFORM-M5B-HOME-ACCEPTANCE.md), [M4D-C Initiative UX](./PROJECT-PLATFORM-M4D-C-INITIATIVE-UX.md), [Design System](./PROJECT-PLATFORM-DESIGN-SYSTEM.md)

---

## 1. Workspace architecture

### Trace

```
/initiatives/[id] (Overview)
  → getInitiativeWorkspace + getGateWorkspace (existing)
  → InitiativeHeader
  → LifecycleRail (premium spine)
  → InitiativeTabs (M4D-C groups)
  → NextActionPanel (authorized controls)
  → SituationOverview · Attention · Readiness · Activity
```

No second lifecycle engine. No Prisma schema / RBAC / governance rule changes.

### A. Initiative Header

| Field | Source |
|---|---|
| Reference + title | Initiative |
| Stage / status | `StatusBadge` + Initiative status |
| Business owner | Resource FK preferred; name snapshot fallback |
| Requesting org / dept | Department → Section → Organization |
| Priority | `demand.urgency` (no initiative-level priority field) |
| Created / updated | Initiative timestamps |

### B. Lifecycle progress

Presentation spine:

**Demand → Requirements → Pre-study → Governance → PoC → Pilot → Project**

- Domain stages unchanged (`InitiativeStage` enum).
- **Governance** is a presentation step between Pre-study and PoC, driven by submission/decision flags — not a new domain stage.
- States: completed / current / upcoming / blocked (text alternatives for a11y).
- Explicit copy: visual stage ≠ approval.

### C. Next action

Prominent panel from `describeInitiativeNextAction` + existing mutation forms:

- Advance Demand → Requirements / Requirements → Pre-study
- Submit Pre-study / track governance / record decision
- Create PoC / Pilot / Convert to Project (manual, capability-gated)
- Open Project workspace

Primary CTA links preserve M4C return context (`from` / `fromOrg`).

### D. Situation overview

Business problem, expected value, strategic alignment, priority, owner / requester / sponsor (Resource-aware), open risks.

### E. Activity / history

Overview shows recent `lifecycleTransitions` only. Full log remains on History tab. No invented audit events.

### Navigation groups (preserved)

Overview · Discovery · Governance · Validation · Delivery · History

---

## 2. Visual design

- Navy headings (`--font-display`) + teal accents (`#087f78` / `--accent-soft`)
- White surfaces, compact meta grid, left-rail lifecycle chips
- Next-action callout with teal border (danger border when blocked)
- Progressive disclosure: readiness / PoC / Pilot panels only when relevant
- Responsive: single-column stacking on mobile/tablet

---

## 3. Ownership presentation

| Basis | Meaning |
|---|---|
| `resource_link` | `businessOwnerResource` / requester / sponsor Resource name |
| `name_snapshot` | Historical free-text fallback only |
| `missing` | Explicit “Not set” — never invented |

Resource business ownership ≠ Principal authorization (stated in Quick links footer).

---

## 4. Role-aware UX

| Persona | Behavior |
|---|---|
| Org Admin / Portfolio / Dept / Project Manager | Situation + authorized next-action controls |
| Initiative owner (Resource-linked) | Owner name from Resource FK |
| Viewer | Readable situation overview; server still denies unauthorized mutations |

Server `assertCan` / form capability checks unchanged.

---

## 5. Empty / unavailable states

| Case | Presentation |
|---|---|
| New Initiative | Empty problem/value copy; Demand next action |
| Missing owner | “Not set” / name snapshot label |
| No risks | “No open risks recorded.” |
| No history | “No lifecycle transitions yet.” |
| No PoC/Pilot/Project | Tabs/links appear only when entities exist |

---

## 6. Screenshots

| File | Scenario |
|---|---|
| `01-new-demand.png` | New DEMAND Initiative |
| `02-requirements.png` | Requirements + linked owner |
| `03-pre-study.png` | Pre-study next action |
| `04-governance-spine.png` | Governance step in lifecycle |
| `05-converted-project.png` | PROJECT stage |
| `06-viewer.png` | Viewer read path |
| `07-owner-linked.png` | Linked Resource owner |
| `08-missing-ownership.png` | Snapshot / missing owner |
| `09-tablet.png` / `10-mobile.png` / `11-desktop.png` | Responsive |

Evidence: `artifacts/m5ca-qa/`, `docs/acceptance-assets/m5ca/screenshots/`

---

## 7. Usability measurements (structural)

| Goal | Observed path | Steps |
|---|---|---|
| Identify current stage | Lifecycle progress on first paint | **0** |
| Find business owner | Header meta grid | **0** |
| Identify next action | Next action panel above fold | **0** |
| Open Project | Overview → Open Project workspace | **1** |
| Control density | Header + rail + next action + situation; secondary panels progressive | Acceptable |
| Navigation clarity | Grouped workflow tabs preserved | Clear |

Not a human user study.

---

## 8. Tests

| Suite | Result |
|---|---|
| `tests/unit/initiative-workspace-m5ca.test.ts` | Ownership + premium lifecycle |
| `tests/unit/initiative-journey.test.ts` | Existing M4D-C journey still green |
| Browser QA `scripts/m5ca-browser-qa.mjs` | **PASS** (10 journeys) |

---

## 9. Files changed (primary)

| Path | Role |
|---|---|
| `src/modules/initiative/application/initiative-journey.ts` | Premium lifecycle + ownership helpers |
| `src/modules/initiative/application/initiative-service.ts` | Include Resource parties + org name |
| `src/components/initiative/workspace.tsx` | Header, rail, next action, situation, activity |
| `src/app/initiatives/[initiativeId]/page.tsx` | Situation Overview composition |
| `tests/unit/initiative-workspace-m5ca.test.ts` | Unit coverage |
| `scripts/m5ca-*.mjs` | Seed + browser QA |

---

## 10. Remaining M5C-B scope

**Do not implement in M5C-A.**

1. Governance workspace deep polish (submission/approval/decision IA as premium situation surfaces).
2. PoC / Pilot experimentation workspace orientation (keep evaluation vs decision distinct).
3. Richer pending-approvals inbox embedding inside Initiative chrome (still global `/approvals` today).
4. Optional Projects shell index (M5 design §7) — deferred with Project workspace polish.

---

## 11. Final statement

**M5C-A COMPLETE — READY FOR M5C-B GOVERNANCE & EXPERIMENTATION WORKSPACE**
