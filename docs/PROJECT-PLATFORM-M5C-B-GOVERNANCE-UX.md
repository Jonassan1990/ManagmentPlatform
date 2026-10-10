# PROJECT PLATFORM — M5C-B

## Premium Governance, PoC & Pilot Workspace Experience

**Status:** IMPLEMENTED  
**Phase:** M5C-B — Governance / PoC / Pilot UX (presentation only)  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `a3c78c17e209c8f42d1e026a15170514caa2f162`  
**Branch:** `cursor/m5cb-governance-ux-60bb`

**STOP:** Does **not** implement M5C-C (Project Workspace).

**Related:** [M5 Design](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md), [M5C-A Initiative Workspace](./PROJECT-PLATFORM-M5C-A-INITIATIVE-WORKSPACE.md), [Design System](./PROJECT-PLATFORM-DESIGN-SYSTEM.md)

---

## 1. Workspace architecture

### Trace

```
Initiative Overview (M5C-A)
  → Governance workspace
       A. Decision Context
       B. Evidence (progressive disclosure + table)
       C. Review (pending / completed)
       D. Decision (package + outcome + history link)
       → NextActionPanel (authorized only)
  → My Approvals (ConfirmDialog)
  → Decision workspace (ConfirmDialog + immutable log)
  → PoC workspace (evaluation ≠ recommendation ≠ decision)
  → Pilot workspace (scale recommendation ≠ SCALE)
```

No domain rule, RBAC, Prisma schema, audit, or R1 changes.

### A. Decision Context

| Field | Source |
|---|---|
| Initiative reference / title | Initiative |
| Gate type | Active gate (`PRE_STUDY` / `POC` / `PILOT`) |
| Submission status | Latest submission → `StatusBadge` |
| Lifecycle context | Domain stage + LifecycleRail premium spine |
| Decision owner | `businessOwnerName` when present — never invented |

### B. Evidence

- Completeness table with semantic `<table>` / captions
- Readiness panels (pre-study / PoC / Pilot) when applicable
- Missing evidence labeled explicitly; empty package copy when none

### C. Review

- Pending vs completed approval lists
- Authority keys + immutable recorded comments
- Decision-readiness badge derived from pending count

### D. Decision

- Package question + informational recommendation
- Allowed outcomes unchanged (forms still call existing actions)
- Timestamp + conditions on recorded outcomes
- Immutable history via Decision log / ConfirmDialog copy

---

## 2. Approval & Decision experience

| Surface | UX |
|---|---|
| My Approvals | Task card: what / initiative / evidence link / allowed action / state |
| ApprovalDecisionForm | **ConfirmDialog** before immutable record |
| My Decisions / Initiative Decisions | Decision task chrome + ConfirmDialog |
| Unauthorized | Capability-gated controls; explicit permission message |

Approvals remain immutable; unauthorized principals cannot record outcomes (Phase 0C unchanged).

---

## 3. PoC / Pilot workspace

### PoC

Objectives, hypothesis, scope, owner, dates, success criteria, results/findings, operational recommendation (findings), formal decision badge (from PoC gate decisions when present).

### Pilot

Scope, target users/sites, KPIs/criteria, owner/team, costs, results, lessons learned, scale recommendation (business/operational findings), formal rollout decision badge.

**Recommendation ≠ formal decision** callout on both surfaces. Unsupported fields are not invented.

---

## 4. Lifecycle clarity

Presentation chain:

**Initiative → PoC → Pilot → Project**

Copy states GO / SCALE never auto-create. Next authorized action shown only when existing services/capabilities support create/convert.

---

## 5. Screenshots

Captured under `docs/acceptance-assets/m5cb/screenshots/` by `scripts/m5cb-browser-qa.mjs`:

| File | Journey |
|---|---|
| `01-governance-entry.png` | Governance entry |
| `02-no-submission.png` | Empty submission |
| `03-pending-approval-governance.png` | Pending approval |
| `04-approval-review.png` | Approval review |
| `04b-approval-confirm-dialog.png` | ConfirmDialog |
| `05-decision-workspace.png` | Decision workspace |
| `06-conditional-decision.png` | Conditional decision |
| `07-poc-evaluation.png` | PoC evaluation |
| `08-pilot-evaluation.png` | Pilot evaluation |
| `09-viewer-governance.png` | Viewer mode |
| `10-tablet.png` / `11-mobile.png` / `12-desktop-*.png` | Responsive |

---

## 6. Before / after usability measurements

Structural counts from browser QA on seeded fixtures (not user-study claims):

| Metric | Before (M5C-A baseline pages) | After (M5C-B) |
|---|---|---|
| Steps to find pending approval | 2–3 (scan dense panels / Approvals) | **1** — Review disclosure or My Approvals task card |
| Steps to inspect evidence | 1–2 (scroll) | **1** — Evidence disclosure + table |
| Steps to identify decision status | 2 (Decisions tab + log) | **0–1** — Decision Context / Latest outcome badge |
| Steps to find next action | 1–2 (sidebar “Next action”) | **0** — `NextActionPanel` above fold |
| Visible primary controls (pending gov) | Mixed submit/links without hierarchy | **23** interactive controls on pending governance (links + buttons) |
| Navigation context | Tabs + crumbs | Tabs + crumbs + Related workspaces links |

---

## 7. Accessibility

| Check | Result |
|---|---|
| Semantic headings | Workspace `h1` + section `h2` / disclosure titles |
| Keyboard review actions | Native `<details>` / buttons / ConfirmDialog focus trap |
| Dialog focus | Radix Dialog + ConfirmDialog |
| Status labels | `StatusBadge` + text alternatives |
| Error feedback | `useActionForm` ErrorAlert + dialog `error` |
| Evidence table | `<table>` + `<caption class="sr-only">` + `scope` |
| Mobile | QA tablet/mobile journeys |

---

## 8. Role-aware UX

| Persona | Behavior |
|---|---|
| Org Admin / Decision Maker | Next actions + ConfirmDialog mutations when capable |
| Governance Reviewer | My Approvals queue + confirm |
| Initiative Owner | Owner shown when `businessOwnerName` set |
| Viewer | Readable governance/PoC/Pilot; empty Approvals without `APPROVAL_REVIEW` |
| Unauthorized | Server `assertCan` unchanged; UI disables / messages |

---

## 9. Known limitations

- My Approvals list does not embed full evidence rows (service include unchanged) — links to gate workspace.
- Decision owner uses initiative business owner name snapshot; no separate “decision maker” field in domain.
- Progressive disclosure defaults open only for active review/decision states.
- Projects index / Project workspace polish deferred to **M5C-C**.

---

## 10. Tests

| Suite | Coverage |
|---|---|
| `tests/unit/governance-presentation-m5cb.test.ts` | Status badges, context, next action, recommendation vs decision, lifecycle clarity, evidence/review helpers |
| Existing governance integration | Domain rules unchanged — still green |

---

## 11. M5C-C handoff

**M5C-C — Project Workspace** should:

- Premium Project delivery workspace (milestones, health, conversion aftermath)
- Preserve Initiative → Project navigation from Pilot / Decisions
- Not reopen Governance decision matrix / approval immutability
- Reuse StatusBadge, NextActionPanel, ConfirmDialog patterns from M5C-A/B

---

## 12. Quality gates

Run before merge:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
- Browser QA: `node scripts/m5cb-browser-qa.mjs`
