# Project Platform — M4D-D Cross-Workflow UX Consistency

**Status:** M4D-D COMPLETE (bounded polish)  
**Date:** 2026-10-09  
**Starting main SHA:** `2997855294f564958603248fc99e189ba503541d` (M4D-C merged)  
**Branch:** `cursor/m4d-d-cross-workflow-ux-60bb`  
**Prerequisites:** M4D-A (#48), M4D-B (#49), M4D-C (#50) merged

This phase resolves remaining cross-workflow friction. It is **not** a redesign.

---

## 1. Changes

| Area | Change |
|---|---|
| Breadcrumbs | All initiative workspace pages use `buildInitiativeTrail` + `returnContext` (Home trail; Explorer/Capacity return crumbs when present) |
| Home → destinations | Attention links for Approvals / PI / project rows append `from=home` (+ org); new `home` return token |
| Confirm patterns | Scenario **Archive** uses `ConfirmDialog` (consequences + cancel); Close Project uses inline `Alert` instead of `window.alert` |
| Permission feedback | Clone / rename scenario controls get `title={permissionTitle(...)}` (no silent disable) |
| Status / feedback | Closed project banner uses M4B `Alert`; closure readiness uses Alert tones |
| A11y | PI tabs: focus-visible outline + min touch height; Home attention stats min-height 44px |
| Next-action clarity | Initiative overview: lifecycle strip + “Act on next step” panel de-duplicated wording |

---

## 2. Before / after evidence

| Friction | Before | After |
|---|---|---|
| Initiative crumbs | Mixed “Overview” hardcoding; return query dropped on tab hops | Unified Home trail + preserveQuery + return crumbs |
| Home deep links | Bare `/pi`, `/approvals`, project hrefs | `from=home&fromOrg=…` where relevant |
| Archive scenario | One-click destructive | ConfirmDialog with error stay-open |
| Close project confirm miss | `window.alert` | Inline Alert error |
| PI tab keyboard focus | Weak / missing outline | Matches initiative tab focus style |
| Closed project | Custom tone classes | Alert warning + read-only copy |

Screenshots: `docs/acceptance-assets/m4dd/screenshots/`

---

## 3. Accessibility findings (bounded)

| Finding | Status |
|---|---|
| Dialog focus trap / restore (Radix) on Archive ConfirmDialog | Addressed for new confirm |
| PI tab focus-visible | Fixed |
| Mobile touch targets on Home attention stats | min-h-11 |
| Initiative grouped tabs keyboard | Inherited from M4D-C |
| Broad WCAG certification | **Deferred to M4F** |

---

## 4. Role-aware UX notes

- Capability flags (`canAllocatePi`, `canCloseProject`, …) continue to drive disable + `permissionTitle`.
- Global nav visibility is **not** used as proof of entity authorization (unchanged).
- Viewer-style denials still surface via action ErrorAlert / ConfirmDialog error.

---

## 5. Browser QA

Script: `scripts/m4dd-browser-qa.mjs`  
Evidence: `artifacts/m4dd-qa/qa-result.json`

| # | Journey | Result |
|---|---|---|
| 1 | Home attention present | PASS |
| 1b | Home → PI link carries `from=home` | PASS |
| 2 | Explorer → Initiative/Project context | PASS |
| 3 | Initiative Demand crumbs use Home (not legacy Overview) | PASS |
| 4 | PI Board focus styles + Archive ConfirmDialog | PASS |
| 5 | Board → Compare → Review | PASS |
| 6 | Mobile Home | PASS |

**Verdict: PASS**

---

## 6. Remaining issues (accept / defer)

| Item | Disposition |
|---|---|
| Capacity progressive defaults (UX-006) | Defer M4E / later |
| PI tab horizontal scroll virtualization (UX-011) | Defer M4F |
| Full accessibility certification | Defer M4F |
| Shared next-action domain module | Deferred (presentation labels only) |
| Approvals inbox embedded in initiative chrome | Deferred |
| Some Home metric cards still link without `from=` (secondary) | Accept for M4D-D; optional follow-up |

---

## 7. M4D final acceptance readiness

M4D-A through M4D-D deliver a coherent planning + initiative journey with shared M4B primitives, return-context continuity, and confirm/feedback patterns. Remaining work is explicitly deferred (capacity defaults, a11y certification, M4E/M4F).

**Ready for M4D-FINAL documentation / acceptance review** — do not start M4D-FINAL implementation in this PR.

---

## 8. Quality gates

| Gate | Result |
|---|---|
| typecheck | PASS |
| lint | PASS (0 errors; 2 pre-existing warnings) |
| unit | PASS — **37** files / **240** tests |
| integration | PASS — **20** files / **190** tests |
| build | PASS |
| browser QA | PASS |
