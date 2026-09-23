# UX Acceptance Report — Phase 5.5

**Branch:** `phase5.5-deployment-ux-acceptance`  
**Scope:** Inventory, route audit, first-run, manager comprehension, continuity, errors, responsive, a11y, performance notes. No Phase 6 features.  
**Evidence basis:** Code inventory audit + P1 continuity fixes on this branch + service-level acceptance journey (`scripts/acceptance-e2e-journey.ts`).

---

## 1. Inventory classifications

| Area | Classification | Notes |
|---|---|---|
| Organization (sections / depts / teams / resources / membership) | **IMPLEMENTED** | Setup + hierarchy UI; membership on resource |
| Initiative / Demand / Requirements / Pre-study | **IMPLEMENTED** | Stage workspace + readiness policy |
| Governance submit / revise / policy | **IMPLEMENTED** | Gates + org governance-policy |
| Approvals inbox | **IMPLEMENTED** | `/approvals` |
| Decisions inbox + initiative log | **IMPLEMENTED** | Post-decision next CTAs added in 5.5 |
| PoC / Pilot / Scale / Project conversion | **IMPLEMENTED** | Full service + UI paths |
| Budget / Milestones / Work items | **IMPLEMENTED** | Sections on project page |
| Risks | **PARTIAL** | Create/list; update action exists, **no update UI** |
| Documents | **PARTIAL** | Metadata only; binary storage deferred |
| PI / iterations / board / capacity / dependencies / review / baseline | **IMPLEMENTED** | Multi-dept PI Planning |
| Auth (production OIDC) | **NOT WIRED** | DEV bridge only; production fail-closed |
| Org archive UI | **MISSING** | Service method without UI |
| Scenario A/B UX | **FOUNDATION ONLY** | `PlanningRevision` CURRENT; no multi-branch UI |

---

## 2. Route audit & discoverability

**Shell nav:** Overview · Organization · Initiatives · Approvals · Decisions · PI Planning · Governance policy (always visible after 5.5; deep-links org when path has org id).

| Route family | Discoverability |
|---|---|
| `/`, `/organization`, `/initiatives`, `/approvals`, `/decisions`, `/pi` | Shell |
| `/organization/setup` | Empty-state CTA only (correct once orgs exist) |
| Org hierarchy / resources / governance-policy | Org detail + breadcrumbs |
| Initiative tabs (demand → history) | Stage/phase gated tabs |
| PI sub-routes (board, capacity, dependencies, review, baseline, settings) | PiTabs |

**Fixed in 5.5:** Overview metric tiles link to related queues; Governance policy always in shell; Project → `/pi` “Plan delivery”; Decisions “What happens after?” actionable CTAs.

**Remaining weak spots:** Some metric tiles still lack deep filters (PoC/Pilot stage filters); team page has no members list; Project→PI is clearer but still not a first-class “add to PI board” flow.

---

## 3. First-run findings

With clean DB + DEV auth (`ALLOW_DEV_AUTH=true`, `DEV_AUTH_PRINCIPAL_ID` UUID):

- `/` shows EmptyState **“No organization has been configured yet”** and CTA **Set up organization** → `/organization/setup`.
- Unauthenticated: EmptyState **“No authenticated principal”** + auth hint (DEV missing or production fail-closed).
- Bootstrap create-org allowed only when org count = 0.

After acceptance E2E against the acceptance database, the DB is **not** empty; empty-state verification must run on a migrated clean acceptance DB **before** the journey (see run notes in DEPLOYMENT-ACCEPTANCE / local run log).

---

## 4. Manager comprehension

- Overview groups Lifecycle / Governance / Delivery / PI Planning — readable helicopter view once metrics link to queues (5.5).
- Zero is a valid state (explicit copy on overview).
- Initiative workspace stages match glossary language (Demand → … → Project).
- Capacity bands and conflict labels are hours-based and derived on read — managers see overload / dependency timing without a stale cache.

**Friction:** Overview still dense for first-time managers (many tiles); risk register is create-only; team capacity discovery requires Resource navigation.

---

## 5. Senior manager / attention model

- Overview + Approvals + Decisions + PI attention metrics surface queues.
- PI review page lists derived conflicts for baseline readiness.
- Scale / GO outcomes are recorded as first-class decisions (not boolean flags).

**Gap:** No Phase 6 executive cockpit polish; metric deep-filters incomplete; production cannot authenticate senior managers without OIDC.

---

## 6. Workflow continuity

| Transition | Continuity |
|---|---|
| Pre-study ready → governance | Submit from overview / governance |
| Decision GO → PoC | Overview create + decisions next CTA (5.5) |
| PoC / Pilot gates → next stage | Stage tabs + decisions CTAs |
| SCALE → Project | Convert on overview / pilot panel |
| Project → PI | **Added** Plan delivery → `/pi` (5.5) |
| Board allocate → capacity → conflicts | Server mutations; review checklist |

Acceptance journey proves service-level continuity through baseline immutability + changes-since.

---

## 7. Errors

- Mutating routes redirect to `/` without principal.
- AppError codes (`VALIDATION`, `STALE_VERSION`, `FORBIDDEN`, `UNAUTHORIZED`) surface via forms; copy is technical in places.
- Production env rejects `ALLOW_DEV_AUTH` at config parse (fail closed).

**Should Fix:** Error copy audit for manager-facing language.

---

## 8. Responsive

- App shell: collapsible sidebar (`lg` breakpoint), sticky header, Menu / Close navigation controls with `aria-label`.
- Metric grids: `sm:grid-cols-2` / `lg:grid-cols-3`.
- PI board / dense tables not formally device-tested in 5.5; expect horizontal scroll on small screens for board.

---

## 9. Accessibility notes

- Primary nav `aria-label="Primary"`; mobile menu button labeled.
- Focus-visible rings on linked metric tiles (5.5).
- Empty states use headings + descriptive text.
- **Not done:** Formal WCAG audit, skip links, comprehensive keyboard board interactions, contrast measurement.

---

## 10. Performance notes

- Overview loads live org list + initiative metrics + PI executive metrics (force-dynamic) — fine for small portfolios; no caching layer.
- PI conflicts derived on read — correct for accuracy; large boards may need selective caching / pagination later.
- Acceptance E2E is service-level (no Next SSR cost).

---

## 11. Findings by priority

### P0
| Finding | Area | Status |
|---|---|---|
| Production has no OIDC/auth path; fails closed | Auth / deployment | **Open** — documented; deploy blocked |
| Post-decision stall (static “What happens after?”) | Decisions continuity | **Fixed in 5.5** — actionable CTAs |

### P1
| Finding | Area | Status |
|---|---|---|
| Overview metrics non-actionable | Overview | **Fixed in 5.5** — tiles link to queues |
| Governance policy nav context-gated | Shell | **Fixed in 5.5** — always visible |
| Weak Project → PI discoverability | Project | **Fixed in 5.5** — Plan delivery panel |
| Risks update UI missing | Risks | **Open** → Phase 6 Should Fix |
| Team members list missing | Organization / Teams | **Open** → Phase 6 Should Fix |
| Stronger Project→PI UX (beyond link) | Project / PI | **Partial** → Phase 6 Should Fix |

### P2
| Finding | Area | Status |
|---|---|---|
| Overview density / overload polish | Overview | Open → Should Fix |
| Error copy too technical | Forms / errors | Open → Should Fix |
| Large PI board performance | PI Planning | Open → Should Fix (caching) |
| Metric deep filters incomplete | Overview | Open → Could Improve |

### P3
| Finding | Area | Status |
|---|---|---|
| Org archive UI | Organization | Open → Could Improve |
| Binary document storage | Documents | Open → Could Improve |
| Scenario A/B UX | PI Planning | Open → Could Improve |
| Formal WCAG audit | a11y | Open → Could Improve |

---

## 12. Fixes applied in Phase 5.5

1. **Overview** — metric sections + linked tiles to initiatives / approvals / decisions / PI.
2. **Decisions** — next-step CTAs after latest decision (overview / pilot / conditions).
3. **Project** — “Plan delivery” panel linking to `/pi`.
4. **Shell** — Governance policy always listed; subtitle “Through Phase 5”.
5. **Acceptance** — `scripts/acceptance-e2e-journey.ts` + this report / deployment / Phase 6 backlog docs.

---

## 13. Verdict

Domain surface through Project + multi-dept PI Planning is **implemented**. Phase 5.5 acceptance friction was primarily **UX continuity** (addressed for P0/P1 continuity items above) plus known **production auth** blocker. Do not start Phase 6 feature work from this report alone without prioritizing Production OIDC.
