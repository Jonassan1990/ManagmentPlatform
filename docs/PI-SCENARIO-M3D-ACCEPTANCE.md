# PI Scenario M3D — End-to-End Functional Acceptance (M3D-D)

**STATUS:** PASS (functional)  
**Date:** 2026-10-09  
**Starting main SHA:** `99ef57cb5c5f47ecc9f3a9ad345ce6e0d5ed4b26`  
**Final main SHA:** `11abed0e69aecd9ef8f1b698bbfe73bf9ecbf552`  
**Scope:** Verification only — M3B + M3C + M3D-A + M3D-B + M3D-C. **No M3E. No feature work.**

Related contracts:

- [PI-SCENARIO-SELECTION-READINESS.md](./PI-SCENARIO-SELECTION-READINESS.md) (M3D-A)
- [PI-SCENARIO-PROMOTION.md](./PI-SCENARIO-PROMOTION.md) (M3D-B)
- [PI-SCENARIO-APPROVAL-BASELINE-CONTRACT.md](./PI-SCENARIO-APPROVAL-BASELINE-CONTRACT.md) (M3D-C)
- [PROJECT-PLATFORM-M3-SCENARIO-ARCHITECTURE.md](./PROJECT-PLATFORM-M3-SCENARIO-ARCHITECTURE.md)

---

## 1. Executive verdict

| Gate | Result |
|---|---|
| Functional acceptance (create→compare→select→readiness→promote→approve→baseline) | **PASS** |
| Architecture invariants | **PASS** |
| Authorization / concurrency / isolation | **PASS** |
| Portfolio M2 regression (CURRENT-only live metrics) | **PASS** |
| Browser QA (authenticated journey) | **PASS** |
| Quality gates (typecheck / lint / unit / integration / build / migrate status) | **PASS** |
| Production schema verification | **BLOCKED** (`db.prisma.io` P1001 — unreachable from this environment) |

**M3D FUNCTIONALLY ACCEPTED — READY FOR M3E FINAL INTEGRATION**

**PRODUCTION RELEASE BLOCKED — SCHEMA NOT VERIFIED**

---

## 2. Baseline

| Check | Result |
|---|---|
| Started from latest `origin/main` | PASS — `99ef57c` (Merge PR #36 M3D-C) |
| M3B migration `20261009150000_m3b_planning_scenarios` | PASS — present & applied locally |
| M3D-A migration `20261009170000_m3d_a_scenario_selection` | PASS |
| M3D-B migration `20261009180000_m3d_b_scenario_promotion` | PASS |
| M3D-C migration `20261009190000_m3d_c_plan_approval` | PASS |
| Known M3D-B ancestor `84a4b18877bf6e2c27e2b2903f2ddadf35f4cde8` | PASS — `git merge-base --is-ancestor` |
| M3D-C merge SHA on main | PASS — `99ef57cb5c5f47ecc9f3a9ad345ce6e0d5ed4b26` |
| Local `npx prisma migrate status` (dedicated DBs) | PASS — 14 migrations, up to date |

M3D-C is present on main; acceptance proceeded.

---

## 3. Lifecycle matrix

Evidence: `tests/integration/pi-m3d-acceptance.test.ts` → [`docs/acceptance-assets/m3dd/lifecycle-matrix.json`](./acceptance-assets/m3dd/lifecycle-matrix.json)  
DB: `management_platform_m3d_d_int`

| Scenario | Expected | Result |
|---|---|---|
| Create Scenario A from CURRENT | Independent DRAFT | PASS |
| Clone Scenario B from A | Independent allocations | PASS |
| Edit B | A and CURRENT unchanged | PASS |
| Compare CURRENT/A/B | Accurate deltas | PASS (`revisions=3 diffs=2`) |
| Select B | Selected for review, not approved | PASS |
| Clear selection | No CURRENT mutation | PASS |
| Select B again | Exactly one selected scenario | PASS |
| Readiness with blockers | Promotion denied | PASS (`NOT_READY`) |
| Readiness with warnings | Explicit acknowledgement required | PASS (READY path N/A in fixture; ack enforced in M3D-B suite) |
| Promote B | CURRENT allocations match B | PASS (CURRENT id stable) |
| Promotion retry | Idempotent replay | PASS (`idempotentReplay=true`) |
| Portfolio after promotion | Shows new CURRENT values | PASS (`8→24` committed hours) |
| Approve CURRENT | Approval bound to exact version/fingerprint | PASS |
| Baseline approved CURRENT | Immutable baseline created | PASS (`versionNumber=1`, `planApprovalId` bound) |
| Edit CURRENT after approval | Old approval invalid for new baseline | PASS |
| Historical baseline | Unchanged | PASS (payload hash stable) |
| Second promotion | Earlier approval cannot authorize new state | PASS (`INVALIDATED` / `REPROMOTED`) |
| Unauthorized approval | Denied | PASS (`FORBIDDEN`) |
| Unauthorized baseline | Denied | PASS (`FORBIDDEN`) |
| Cross-org attempt | Denied | PASS (`FORBIDDEN`) |
| Concurrent promotion | One winner; no partial state | PASS (`wins=1 losses=1`) |
| Concurrent approval | No conflicting VALID approvals | PASS (`valid=1`) |
| Concurrent baseline | No duplicate commitment | PASS (`delta=1`) |
| Transaction failure | Full rollback | PASS (stale version → no new approval) |
| Pre-M3D baseline bypass | Denied without `expectedApprovalId` | PASS |

**Matrix: 25 / 25 PASS**

---

## 4. Architecture assessment

Traced path: UI (`/pi/[piId]/{board,compare,review,baseline}`) → Server Actions (`src/app/actions/pi-planning.ts`) → `PlanningService` → selection / promotion / approval / baseline services → `AuthorizationService` → capacity/conflict engines → Prisma (`WorkAllocation`, `PlanningRevision`, `PiPlanApproval`, `PiBaseline`) → `AuditService`.

| Invariant | Assessment |
|---|---|
| One authoritative CURRENT `PlanningRevision` per PI (`key=CURRENT`, `isCurrent=true`) | PASS — promotion preserves CURRENT revision ID |
| `WorkAllocation` is the single allocation ledger | PASS — no second ledger |
| Scenario allocations are revision-scoped | PASS — edits to B leave A/CURRENT fingerprints unchanged |
| Capacity/conflict engines reused for readiness | PASS — `evaluateScenarioReadiness` / promotion preview |
| Selection does not modify CURRENT | PASS — selection tests + acceptance isolation |
| Promotion changes CURRENT atomically (allocate-replace) | PASS — transactional; concurrent loser rejected |
| Approval binds to CURRENT version + allocation fingerprint | PASS — `PiPlanApproval.currentRevisionVersion` + fingerprint |
| Baseline only from valid approved CURRENT + `expectedApprovalId` | PASS — schema + service gate; bypass denied |
| Historical `PiBaseline` immutable | PASS — payload hash unchanged after CURRENT edit |
| Portfolio M2 reads CURRENT for live metrics | PASS — committed hours follow CURRENT only; drafts never leak |
| Selection ≠ Approval ≠ Baseline | PASS — distinct permissions and UI states |
| No hidden approval bypass | PASS — missing `expectedApprovalId` rejected; stale scripts fail closed |

---

## 5. Isolation evidence

Dedicated DB: `management_platform_m3d_d_int` (not the browser QA DB).

| Assertion | Result |
|---|---|
| Scenario A fingerprint unchanged after B promote | PASS |
| Source Scenario B fingerprint unchanged after promote | PASS |
| CURRENT revision ID stable across promotion | PASS (`currentRevisionId` preserved) |
| CURRENT allocations match promoted plan (fingerprint equality) | PASS |
| Previous baselines unchanged after later CURRENT edits | PASS |
| Failed approve (stale version) leaves no new approval / no CURRENT mutation | PASS |
| Portfolio committed hours before/after promote | PASS (`8` → `24`) |

Raw: [`docs/acceptance-assets/m3dd/isolation-snapshot.json`](./acceptance-assets/m3dd/isolation-snapshot.json)

---

## 6. Approval / baseline correctness

| Rule | Result |
|---|---|
| Selection ≠ Approval | PASS |
| Promotion ≠ Approval (disclaimer + no `PiPlanApproval` on promote) | PASS |
| Approval ≠ Baseline | PASS — separate `PI_REVIEW` vs `PI_BASELINE` |
| Approval references exact CURRENT state (version + fingerprint) | PASS |
| Baselining requires VALID approval + `PI_BASELINE` + `expectedApprovalId` | PASS |
| Stale approval cannot be reused after CURRENT edit / re-promote | PASS |
| Approval history preserved (`VALID` → `INVALIDATED` / `CONSUMED`) | PASS |
| Historical baseline data not overwritten | PASS |
| Pre-M3D baseline path cannot bypass approval | PASS |

---

## 7. Authorization matrix

System role packs (`role-packs.ts`) — implemented contract (not broadened for tests):

| Persona | PI_VIEW | PI_ALLOCATE | PI_REVIEW | PI_BASELINE | Evidence |
|---|---|---|---|---|---|
| Organization Admin | Yes | Yes | Yes | Yes | Role pack `PHASE5_PI_PLANNING_PERMISSIONS` |
| Portfolio Manager | Yes | No | No | No | Pack + denied mutations via missing perms |
| Section Manager | Yes | Yes | Yes | **No** | Can select/promote/approve; cannot baseline |
| Department Manager | Yes | Yes | No | No | Scenario edit only |
| Team Manager | Yes | Yes | No | No | Scenario edit only |
| Viewer | Yes | No | No | No | INT: approve/baseline/promote/select → `FORBIDDEN` |
| Project Owner / Project Manager | Yes | Yes | No | No | Pack |
| Resource Owner | N/A (ownership, not PI role) | — | — | — | Covered by Phase 0 ownership suites |
| Unbound Principal | No effective PI grants | — | — | — | Fail-closed assertCan |
| Cross-organization Principal | Denied on foreign PI | — | — | — | INT + acceptance |

Representative denial tests: Viewer + cross-org on select/promote/approve/baseline in `pi-scenario-selection-m3d.test.ts`, `pi-scenario-promotion-m3d.test.ts`, `pi-plan-approval-m3d.test.ts`, `pi-m3d-acceptance.test.ts`.

---

## 8. Concurrency / idempotency

| Case | Result | Evidence |
|---|---|---|
| Concurrent selection | One winner | M3D-A INT |
| Concurrent scenario editing (stale revision version) | Rejected | M3D-B INT |
| Concurrent promotion | One winner; no partial CURRENT | Acceptance + M3D-B INT |
| Promotion vs CURRENT edit (stale CURRENT version) | Rejected / rollback | M3D-B INT |
| Approval vs CURRENT edit | Stale → `CONFLICT` / invalidation | M3D-C INT |
| Baseline vs CURRENT edit | Stale approval blocks baseline | Acceptance + browser |
| Duplicate approval | Single VALID | Acceptance concurrent |
| Duplicate baseline | Single new version | Acceptance concurrent |
| Stale client versions | `CONFLICT` | M3D-A/B/C INT |
| Replay after timeout (promote) | Idempotent when versions match | Acceptance `idempotentReplay` |
| DB uniqueness / txn rollback | No partial approval rows | Acceptance transaction-failure case |

---

## 9. Portfolio regression

| Checkpoint | Result |
|---|---|
| Before promotion — Portfolio M2E shows CURRENT (8h) | PASS |
| After promotion — Portfolio shows new CURRENT (24h) | PASS |
| After approval/baseline — live KPIs remain CURRENT; baseline is historical | PASS |
| Draft Scenario A/B never appear in Portfolio Capacity UI | PASS (browser `portfolio-no-draft-leak`) |

---

## 10. Browser QA

Isolated browser DB: `management_platform_m3d_qa` (not used by destructive integration suites).  
Scripts: `scripts/seed-m3dd-browser-qa.mjs`, `scripts/m3dd-browser-qa.mjs`  
App: [PI Planning QA](http://localhost:43148)  
Evidence: `artifacts/m3dd-qa/` + [`docs/acceptance-assets/m3dd/browser-result.json`](./acceptance-assets/m3dd/browser-result.json)

| Step | Result |
|---|---|
| Login (temp-auth owner) | PASS |
| Open PI Planning | PASS |
| Create Scenario A | PASS |
| Clone Scenario B | PASS |
| Edit B (A + CURRENT unchanged) | PASS |
| Compare CURRENT/A/B | PASS |
| Select B | PASS |
| Inspect readiness | PASS |
| Promote B (CURRENT matches B; A/B unchanged) | PASS |
| Approve CURRENT (version-bound) | PASS |
| Create baseline | PASS |
| Inspect baseline history | PASS |
| Stale approval visible after CURRENT edit | PASS |
| Stale approval blocks baseline | PASS |
| Historical baseline unchanged | PASS |
| Portfolio Capacity CURRENT visible | PASS |
| Portfolio no draft leak | PASS |
| Viewer deny (integration-covered; single temp principal in UI) | PASS |
| Mobile review layout | PASS |

Screenshots: `artifacts/m3dd-qa/01-board.png` … `13-mobile-review.png` (16 PNG files).  
HTTP 200 alone was not accepted — each step asserts UI copy and/or DB fingerprints.

---

## 11. Usability findings

Recorded only — no redesign performed.

| Topic | Finding | Severity |
|---|---|---|
| State distinction | UI copy clearly separates “Selected for review — not approved”, “Promoted to CURRENT — not approved”, “Approved CURRENT version”, and baseline commitment language | Good |
| Irreversible actions | Promote / Approve / Baseline use confirm steps; promote disclaimer present | Good |
| Readiness | Review panel shows readiness classification; blockers disable promote | Good |
| Approval target/version | Approved version surfaced; stale state shown after CURRENT edit | Good |
| Conflicts / capacity | Compare + readiness surfaces exist; dense for first-time users | Minor UX |
| Disabled actions | Baseline disabled when approval stale; titles/copy explain | Good |
| Navigation | Board ↔ Compare ↔ Review tabs are discoverable | Good |
| Silent failures | Server actions surface errors; stale versions conflict rather than no-op | Good |
| Section Manager baseline | Has `PI_REVIEW` but not `PI_BASELINE` — correct per packs; UI must keep baseline disabled with explanation for that persona | Note for M3E docs |

---

## 12. Performance

Fixture size (acceptance INT): 3 work items, 1 iteration, 1 team.  
Full lifecycle wall time: ~2.5s (single process, local Postgres).

| Area | Observation |
|---|---|
| Scenario clone | O(allocations) copy in transaction — fine at fixture scale |
| Comparison | Bounded revision set; work-item diffs built in memory for selected revisions |
| Promotion transaction | Allocate-replace on CURRENT; ~ms locally for 2 allocations |
| Approval / baseline | Fingerprint + snapshot write; no unbounded scans observed |
| N+1 | Not production-profiled; no claim of production-scale performance |

Do **not** treat these timings as production capacity evidence.

---

## 13. Test results / quality gates

| Gate | Result | Notes |
|---|---|---|
| `npm run typecheck` | PASS | Acceptance test typed against `workItemDiffs` |
| `npm run lint` | PASS | |
| `npm test` | PASS | 20 files / **147** tests |
| `npm run test:integration` | PASS | 20 files / **190** tests (isolated local Postgres DBs) |
| `npm run build` | PASS | |
| `npx prisma migrate status` (local int/QA DBs) | PASS | 14 migrations applied |
| M3D-D acceptance INT | PASS | 1 test, 25 matrix rows |
| Browser QA | PASS | 25 steps |

Regression coverage exercised by the integration run includes: principal/resource ownership, scoped RBAC, initiative/governance/PoC/pilot, project/issues/closure, PI planning/capacity, Portfolio M2, M3B scenarios, M3C comparison, M3D selection/promotion/approval/baseline, temp-auth fail-closed.

---

## 14. Defects

| ID | Severity | Summary | Status |
|---|---|---|---|
| — | — | No product defects found that block M3D functional acceptance | — |
| ENV-M3D-D-01 | Environment | Production Prisma host `db.prisma.io:5432` unreachable (P1001) from agent network — cannot verify production migrate status | Open (release blocker for prod only) |
| ENV-M3D-D-02 | Environment | Dev server AUTH_URL binds to `localhost`; Playwright against `127.0.0.1` breaks cookie/login — use `http://localhost:<port>` for browser QA | Documented workaround |

Stale smoke scripts that omit `expectedApprovalId` fail closed — treated as expected post-M3D-C behavior, not a bypass.

---

## 15. Production migration status

| Item | Status |
|---|---|
| Repository migrations for M3D-A/B/C present on main | PASS |
| Local apply of all 14 migrations | PASS |
| Production `prisma migrate status` | **BLOCKED** — `P1001: Can't reach database server at db.prisma.io:5432` |
| Claim of production schema readiness | **Not made** |

Functional acceptance may pass locally while production release readiness remains blocked.

---

## 16. Remaining M3E risks

1. **Production migrate apply** still unverified — must run against the real production database before release.
2. **Section Manager can approve but not baseline** — confirm product intent and UI messaging for that split before M3E packaging.
3. **Historical freshness** of shared inputs (membership/availability changes after selection) is recalculated at promote/approve time; unsupported “detect stale shared input without re-eval” is not claimed.
4. **Performance / pagination** of large scenario comparisons and clones not proven at production data volumes.
5. **M3E final integration** (cross-module packaging, release notes, ops runbooks) is out of scope for M3D-D — do not start until this acceptance is merged.

---

## Evidence index

| Artifact | Path |
|---|---|
| Lifecycle matrix JSON | `docs/acceptance-assets/m3dd/lifecycle-matrix.json` |
| Isolation snapshot | `docs/acceptance-assets/m3dd/isolation-snapshot.json` |
| Browser result JSON | `docs/acceptance-assets/m3dd/browser-result.json` |
| Browser screenshots | `artifacts/m3dd-qa/*.png` |
| Acceptance INT | `tests/integration/pi-m3d-acceptance.test.ts` |
| Browser scripts | `scripts/seed-m3dd-browser-qa.mjs`, `scripts/m3dd-browser-qa.mjs` |
