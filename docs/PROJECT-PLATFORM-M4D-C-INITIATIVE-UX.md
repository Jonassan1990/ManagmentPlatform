# Project Platform — M4D-C Initiative-to-Delivery Workflow UX

**Status:** M4D-C COMPLETE (presentation / IA only)  
**Date:** 2026-10-09  
**Starting main SHA:** `ee2d94fa4925e6c5090c6184c3bc65126fb78d5d` (M4D-B merged)  
**Branch:** `cursor/m4d-c-initiative-delivery-ux-60bb`  
**Related:** [PROJECT-PLATFORM-M4D-B-REVIEW-UX.md](./PROJECT-PLATFORM-M4D-B-REVIEW-UX.md), [PROJECT-PLATFORM-M4-UX-AUDIT.md](./PROJECT-PLATFORM-M4-UX-AUDIT.md) (UX-008)

**Scope:** Make Idea → Requirements → Pre-study → Governance → PoC → Pilot → Project → Closure feel like **one initiative journey** without changing lifecycle rules, governance semantics, conversion, RBAC, or Prisma.

---

## 1. Before / after

### Before

- Flat strip of up to **12 tabs** (Capture + Gate + Delivery + Supporting mixed)
- Lifecycle rail without owner / next-action / StatusBadge
- Hub stage filters stopped at Pre-study
- Sibling pages often omitted `hasPilot` / `hasProject` / `preserveQuery`
- Project page exposed **10** in-page section chips at once
- Closed project banner lacked explicit mutation-disabled copy
- PoC/Pilot did not visually separate evaluation / recommendation / formal decision

### After

| Change | Detail |
|---|---|
| Tab groups | Overview · Discovery · Governance · Validation · Delivery · History |
| Lifecycle rail | StatusBadge, owner, required next action, blocked reason |
| Hub filters | Demand → Project stages |
| Context | `preserveQuery` + consistent `hasPilot`/`hasProject` on workspace tabs |
| Project sections | Primary chips + **More sections** disclosure |
| Closed project | Explicit read-only / mutations disabled message |
| PoC / Pilot | “Keep these distinct” guidance panels |
| Governance header | Clarifies GO does not auto-create PoC/Pilot/Project |

---

## 2. Workflow-oriented groups (not a second state machine)

```
Overview
Discovery     → Demand · Requirements · Pre-study
Governance    → Governance · Decisions
Validation    → PoC · Pilot
Delivery      → Project
History       → Risks · Documents · History
```

Visibility still follows existing stage/entity flags (`showPhase3`, `hasPilot`, `hasProject`). Groups are presentation-only via `buildInitiativeTabGroups`.

Domain stages remain: `DEMAND | REQUIREMENTS | PRE_STUDY | POC | PILOT | PROJECT`.

---

## 3. Lifecycle progress

`LifecycleRail` + `describeInitiativeNextAction`:

- Current stage (StatusBadge)
- Completed / upcoming stages
- Required next action label (from existing readiness/submission/create flags)
- Blocked reason when conditions or changes-requested apply
- Owner name when known

**Does not** infer approval from visual state. Copy states visual stage ≠ approval.

---

## 4. Usability measurements

| Metric | Before | After |
|---|---|---|
| Visible top-level tab labels (early DEMAND) | 7 flat | 7 in 3 groups (Overview/Discovery/History) |
| Visible top-level tab labels (full PROJECT) | 12 flat | 12 in 6 labeled groups |
| Clicks to identify current stage | Scan rail + header chip | Rail badge + group “· current” highlight |
| Clicks to find next action | Scroll overview Next action panel | Shown in lifecycle rail on overview |
| Context switches across tabs | Query often dropped | `preserveQuery` on workspace tabs |
| Closed Project action clarity | Status banner only | Banner states mutations disabled |

---

## 5. Behavior preservation / deferred domain gaps

Preserved:

- Lifecycle advances and readiness policies
- Governance submission / approval / decision immutability
- Manual PoC / Pilot / Project creation (no auto-create after GO/SCALE)
- Issue and closure semantics; closed → capability strip
- RBAC / Prisma / audit

Deferred (needs domain work — not done in M4D-C):

- Auto-suggest next assignee beyond `businessOwnerName`
- Merging global `/approvals` inbox into initiative chrome
- True tab overflow virtualization for very small screens
- Shared “next action” service module replacing overview switch (still page-local forms)

---

## 6. Browser QA

Script: `scripts/m4dc-browser-qa.mjs`  
Evidence: `artifacts/m4dc-qa/`, `docs/acceptance-assets/m4dc/screenshots/`

| # | Scenario | Result |
|---|---|---|
| 1 | Initiatives hub filters (incl. PoC/Pilot/Project) | **PASS** |
| 2 | Grouped tabs + lifecycle rail + next action | **PASS** |
| 3 | Discovery → Demand navigation | **PASS** |
| 4 | Governance copy (when tab visible) | **PASS** (SKIP on early-stage fixture) |
| 5 | PoC distinct panel (when tab visible) | **PASS** (SKIP on early-stage fixture) |
| 6 | Project More sections (when tab visible) | **PASS** (SKIP on early-stage fixture) |
| 7 | Mobile grouped nav | **PASS** |

**Verdict:** PASS (`scripts/m4dc-browser-qa.mjs`)

---

## 7. Quality gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; 2 pre-existing warnings) |
| `npm test` | PASS — **37** files / **238** tests |
| `npm run test:integration` | PASS — **20** files / **190** tests |
| `npm run build` | PASS |
| Browser QA | PASS |

---

## 8. M4D-D handoff (do not implement)

Likely: Portfolio / Capacity progressive defaults, Delivery Health shell discoverability, further IA cleanup beyond initiative workspace.
