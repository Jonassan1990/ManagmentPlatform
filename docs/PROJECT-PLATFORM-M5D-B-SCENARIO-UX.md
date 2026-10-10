# PROJECT PLATFORM — M5D-B

## Scenario Comparison, Selection & Commitment UX

**Status:** IMPLEMENTED  
**Phase:** M5D-B — Plan → Compare → Select → Apply → Approve → Baseline (presentation only)  
**Repository:** `Jonassan1990/ManagmentPlatform`  
**Starting main SHA:** `8944a6b` (M5D-A merged)  
**Branch:** `cursor/m5db-scenario-ux-60bb`

**STOP:** Does **not** implement M5D-C. Does **not** introduce a second lifecycle engine. Does **not** change transaction, approval, or baseline rules.

**Related:** [M5D-A PI Workspace](./PROJECT-PLATFORM-M5D-A-PI-WORKSPACE.md), [M4D-B Review UX](./PROJECT-PLATFORM-M4D-B-REVIEW-UX.md), [M5 Design §8](./PROJECT-PLATFORM-M5-PRODUCT-EXPERIENCE-DESIGN.md)

---

## 1. Lifecycle (presentation guide)

```
Plan → Compare → Select → Apply to current plan → Approve → Baseline
```

| Stage | Meaning | Domain effect |
|---|---|---|
| Plan | Prepare allocations | Board edits (current plan or draft scenario) |
| Compare | Evaluate alternatives | Read-only comparison |
| Select | Choose preferred scenario | Selection record only — **not** current plan |
| Apply | Copy scenario → current plan | Atomic allocation replace — **not** approval |
| Approve | Bind exact current plan version | Version + fingerprint — **not** baseline |
| Baseline | Immutable commitment | Append-only snapshot |

**Invariant:** Selected ≠ Applied to current plan ≠ Approved ≠ Baselined.

Stage state continues to come from `derivePiPlanningWorkflow` over existing selection / promotion / approval preview contracts.

---

## 2. UX requirements coverage

| Requirement | Where |
|---|---|
| Clear current stage | `PiPlanningWorkflowBar` — Done / In progress / Blocked / Available |
| One primary next action | `PiWorkflowPrimaryActionCard` |
| Explicit consequence | `ConfirmDialog` change / unchanged / reversible / approval-vs-baseline copy |
| Readiness blockers/warnings | Selection + Apply + Approve panels; human `readinessClassificationLabel` |
| Comparison deltas in plain language | `referenceDeltaLabel` — Reference scenario / Same as reference / vs reference: ±N |
| Project / team / resource impact | Review summary “Project / team impact”; Compare project / team / resource tables |
| Approval version clarity | Summary “Current plan version” + “Approval version”; Approve stage titles |
| Immutable baseline explanation | Baseline stage + Baseline page; “append-only” / not rewritten |
| Permission restrictions | Viewer review-permission copy; PI_BASELINE denial on baseline |
| Context preservation | `ReviewJourneyNav` + `appendPreservedQuery` / `PI_CONTEXT_QUERY_KEYS` |

---

## 3. Vocabulary (M5D-A + M5D-B)

| Avoid | Prefer |
|---|---|
| CURRENT / CURRENT plan | **Current plan** |
| Promote / Promoted | **Apply / Applied to current plan** |
| Approve CURRENT | **Approve current plan** |
| Baseline (as delta label) | **Reference scenario** / **vs reference** |
| READY / NOT_READY (raw) | **Ready to apply** / **Not ready** / … |
| Selected ≠ Promoted ≠ … | **Selected ≠ Applied to current plan ≠ Approved ≠ Baselined** |

Technical keys (`CURRENT`, `PROMOTED`, `CURRENT_EDITED`) remain in persistence, URLs, and audit payloads.

---

## 4. Components touched (presentation only)

| Piece | Change |
|---|---|
| `derivePiPlanningWorkflow` | Stage / primary-action / lifecycle labels |
| `ReviewSummaryStrip` | Current plan version, readiness human label, impact, baseline note |
| Selection / Apply / Approve panels | Vocabulary + readiness labels + consequence dialogs |
| `scenario-comparison-display` | Current plan labels; `referenceDeltaLabel` |
| `scenario-comparison-view` | Plain-language deltas; empty-state copy |
| Plan-approval preview messages | User-facing state / disclaimer / disabled-reason strings |
| Baseline page / panels | Current-plan + immutable copy |

**Not changed:** selection / promotion / approval / baseline services’ transaction boundaries, Zod schemas, RBAC permission keys, Prisma models.

---

## 5. Screenshots

`docs/acceptance-assets/m5db/screenshots/` via `scripts/m5db-browser-qa.mjs`:

| File | Journey |
|---|---|
| `01-review-lifecycle.png` | Workflow + summary + next action |
| `02-compare.png` / `03-compare-deltas.png` | Compare vocabulary + deltas |
| `04-select-stage.png` | Select semantics |
| `05-apply-confirm.png` or `05-apply-blocked.png` | Apply consequence |
| `06-approve-*.png` | Approve version clarity |
| `07-baseline-stage.png` / `08-baseline-page.png` | Immutable baseline |
| `09-context-journey.png` | Context preservation |
| `10-viewer.png` | Viewer restrictions |
| `11-reviewer.png` | Reviewer / manager |
| `12-mobile.png` | Mobile Review |

---

## 6. Role-aware UX

| Persona | Behavior |
|---|---|
| Manager / Org Admin (reviewer) | Can select / apply / approve when domain allows; baseline needs `PI_BASELINE` |
| Viewer | Readable workflow; select/apply/approve disabled with review-permission copy |
| Missing baseline authority | Explicit “baseline permission” / PI_BASELINE messaging — approval alone is not enough |

---

## 7. Tests & QA

| Suite | Coverage |
|---|---|
| `tests/unit/pi-planning-workflow.test.ts` | Apply / Approve / baseline-permission labels |
| `tests/unit/scenario-comparison-display.test.ts` | Current plan labels + `referenceDeltaLabel` |
| `tests/unit/pi-planning-presentation-m5da.test.ts` | Readiness human labels + lifecycle invariant |
| Browser | `scripts/m5db-seed-browser.mts` + `m5db-browser-qa.mjs` |

---

## 8. M5D-C handoff

**M5D-C** (see [M5D Final Acceptance](./PROJECT-PLATFORM-M5D-FINAL-ACCEPTANCE.md)) verifies the full PI → Portfolio journey. Do not reopen:

- Promotion atomicity or approval fingerprint binding
- Baseline immutability / append-only versioning
- A parallel domain lifecycle status machine

---

## 9. Quality gates

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:integration`
- `npm run build`
- `node scripts/m5db-browser-qa.mjs`
