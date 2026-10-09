# Project Platform — M4D-B Review / Promote / Approve / Baseline UX

**Status:** M4D-B COMPLETE (presentation / workflow guide only)  
**Date:** 2026-10-09  
**Starting main SHA:** `65094654d143b124482a4a3cf379689f15d6fd3c` (M4D-A merged)  
**Branch:** `cursor/m4d-b-review-workflow-ux-60bb`  
**Related:** [PROJECT-PLATFORM-M4D-PI-BOARD-UX.md](./PROJECT-PLATFORM-M4D-PI-BOARD-UX.md), [PROJECT-PLATFORM-M4-UX-AUDIT.md](./PROJECT-PLATFORM-M4-UX-AUDIT.md)

**Scope:** Simplify the Board → Compare → Select → Promote → Approve → Baseline journey on `/pi/[piId]/review` without changing business semantics, Prisma, AuthZ rules, promotion atomicity, approval version binding, or baseline immutability.

---

## 1. Workflow diagram (presentation guide)

```
Plan ──► Compare ──► Select ──► Promote ──► Approve ──► Baseline
 (board)   (diff)   (preferred)  (→ CURRENT) (exact ver) (immutable)
```

| Stage | Meaning | Domain effect |
|---|---|---|
| Plan | Prepare allocations | Board edits (CURRENT or DRAFT scenario) |
| Compare | Evaluate alternatives | Read-only comparison |
| Select | Choose preferred scenario | Selection record only — **not** CURRENT |
| Promote | Apply to CURRENT | Atomic allocation replace — **not** approval |
| Approve | Approve exact CURRENT | Version + fingerprint bound — **not** baseline |
| Baseline | Immutable commitment | Append-only snapshot |

**Invariant copy:** Selected ≠ Promoted ≠ Approved ≠ Baselined.

This is **not** a new domain status machine. Stage state is derived from existing selection / promotion / approval preview contracts via `derivePiPlanningWorkflow`.

---

## 2. Before / after UX

### Before (M4D-A main)

- Review page stacked Select + Promote + Approve/Baseline panels **always open**
- Checklist / conflicts / status competed for attention
- No single “next action”
- Journey links buried; Compare↔Review context easy to lose
- Confirm dialogs present but lighter on change/unchanged/reversible language

### After (M4D-B)

| Element | Behavior |
|---|---|
| Journey nav | Board ← → Compare → Review → Baseline with preserved query |
| Workflow bar | 6 stages with Done / Current / Available / Blocked / Upcoming |
| Summary strip | Selected, readiness, capacity/conflicts, CURRENT version, approval, baseline |
| Next action card | One primary CTA label + blocker reasons |
| Stage sections | Progressive disclosure; current (or blocked) stage open by default |
| Supporting details | Checklist, conflicts, transitions, links — **collapsed by default** |
| ConfirmDialog | Explicit changes / unchanged / reversible / approval-vs-baseline |
| PI_BASELINE denial | Explicit alert — approval alone does not grant baseline |

---

## 3. Component decisions

| Piece | Role |
|---|---|
| `derivePiPlanningWorkflow` | Pure presentation derivation (unit-tested) |
| `PiPlanningWorkflowBar` | Compact progress indicator |
| `PiWorkflowPrimaryActionCard` | Singular next-action surface |
| `ReviewSummaryStrip` | Priority facts above the fold |
| `ReviewStageSection` | Accessible disclosure wrapper |
| `ReviewJourneyNav` | Context-preserving back/next |
| Existing panels | Same Server Actions; `embedded` + approval `focus` for layout only |

**Not changed:** selection/promotion/approval services, Zod, RBAC permissions, Portfolio CURRENT-only queries.

---

## 4. Usability measurements

| Metric | Before | After |
|---|---|---|
| Visible dense panels on Review load | 4 always-open + checklist grid | Workflow + summary + next + ~1 open stage; supporting collapsed |
| Steps Board → Compare → Review (journey links) | Tab hunting / scroll | 1 click each via journey nav |
| Steps to identify next action | Scan 3–4 panels | 1 glance at “Next action” |
| Steps to open checklist | 0 (always visible, high noise) | 1 (expand Supporting details) |
| Explicit lifecycle reminder | Buried in approval panel | Always in workflow bar |

---

## 5. Behavior-preservation evidence

| Regression | Evidence |
|---|---|
| Selection does not mutate CURRENT | Unchanged `selectScenarioAction`; UI copy + Confirm not used for select |
| Promotion atomic | Unchanged `promoteSelectedScenarioAction` + version fields |
| Approval version-bound | Unchanged `approveCurrentPlanAction` + fingerprint |
| Baseline immutable | Unchanged `createBaselineAction`; confirm states append-only |
| Stale approvals rejected | Service unchanged; workflow surfaces `APPROVAL_STALE` |
| Portfolio CURRENT-only | No portfolio query changes |
| Viewer cannot mutate | Capability gates unchanged; workflow marks Select blocked without `canReviewPi` |

Integration suites for M3D selection/promotion/approval remain the behavioral gate.

---

## 6. Accessibility

- Workflow `nav` + stage `aria-current="step"`
- Stage disclosure: `aria-expanded` / `aria-controls`
- Next-action / summary landmarks
- ConfirmDialog focus trap unchanged; errors stay open (`role="alert"`)
- Focus-visible on journey links and stage toggles
- Mobile: workflow stacks; journey chips wrap; stages remain operable

---

## 7. Browser QA

Script: `scripts/m4db-browser-qa.mjs`  
Evidence: `artifacts/m4db-qa/`, `docs/acceptance-assets/m4db/screenshots/`

| # | Scenario | Result |
|---|---|---|
| 1 | Open Review — workflow/summary/next/lifecycle | PASS |
| 2 | Supporting details collapsed | PASS |
| 3 | Journey Board ↔ Compare ↔ Review | PASS |
| 4 | Select semantics visible | PASS |
| 5 | Promote confirm or blocked state | PASS |
| 6 | Approve confirm / stage state | PASS |
| 7 | Baseline clarity / PI_BASELINE messaging | PASS |
| 8 | Supporting expand shows checklist | PASS |
| 9 | Mobile workflow + journey | PASS |

---

## 8. Known limitations / remaining issues

- Approve and Baseline still share `PlanApprovalPanel` internals (duplicated summary if both sections expanded).
- Compare stage is soft (not a hard gate) — users may skip.
- Workflow does not auto-advance after mutations beyond `router.refresh()` re-derivation.
- M4D-C (if chartered) may further polish Portfolio / Capacity progressive defaults — out of scope here.

---

## 9. Quality gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; 2 pre-existing warnings) |
| `npm test` | PASS — **36** files / **233** tests |
| `npm run test:integration` | PASS — **20** files / **190** tests |
| `npm run build` | PASS |
| Browser QA | PASS — `scripts/m4db-browser-qa.mjs` (9/9) |

---

## 10. M4D-C handoff (do not implement)

Out of M4D-B: portfolio capacity progressive defaults, broader IA cleanup, initiative tab strip, AuthZ expansion.
