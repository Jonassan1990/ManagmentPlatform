# Project Platform — M4A Product-Wide UX, Navigation & Usability Audit

**Status:** AUDIT COMPLETE (documentation only — no implementation)  
**Date:** 2026-10-09  
**Starting / baseline main SHA:** `ab42df9fd99a76a5063e236ce118633d845d77bf`  
**Working tree:** Clean for tracked sources (local QA artifacts untracked only)  
**Prerequisite:** M0–M3 merged; [PROJECT-PLATFORM-M3-FINAL-ACCEPTANCE.md](./PROJECT-PLATFORM-M3-FINAL-ACCEPTANCE.md) records functional COMPLETE  

**Nature:** Audit only. Do not implement or redesign in this milestone.

References consulted:

- [UX-PRINCIPLES.md](./UX-PRINCIPLES.md)
- [UX-ACCEPTANCE-REPORT.md](./UX-ACCEPTANCE-REPORT.md) (Phase 5.5)
- [PROJECT-PLATFORM-M2-MILESTONE-REVIEW.md](./PROJECT-PLATFORM-M2-MILESTONE-REVIEW.md)
- [PROJECT-PLATFORM-M3-FINAL-ACCEPTANCE.md](./PROJECT-PLATFORM-M3-FINAL-ACCEPTANCE.md)
- [docs/ui-reference/resource-overview.html](./ui-reference/resource-overview.html)

---

## 1. Executive Summary

The Management Platform is **functionally deep** (lifecycle → governance → delivery → PI scenarios → portfolio) but **UX-immature as a coherent product**. Navigation largely mirrors backend modules; several high-frequency manager workflows require many context switches; PI Planning (board / compare / review) and Portfolio Capacity are the densest, highest-friction surfaces.

| Scorecard | Score | Notes |
|---|---|---|
| **UX maturity (overall)** | **2.6 / 5** | Usable by expert operators; not yet intuitive for all manager personas |
| Navigation / IA | 2.5 / 5 | Flat shell; portfolio siblings compete; Delivery Health under-discoverable |
| Visual / design system | 2.8 / 5 | Tokens exist; inconsistent density vs reference UI |
| Workflow clarity | 2.4 / 5 | PI Review vertical stack is long; next action sometimes buried |
| Accessibility | 2.7 / 5 | Landmarks/labels OK; contrast & focus polish incomplete |
| Responsive | 2.3 / 5 | Drawer works; PI tabs wrap; tables/boards scroll heavily |
| Role-aware UI | 3.0 / 5 | Capability titles on key PI controls; shell not role-filtered |

**Most confusing workflow:** PI Planning Review (select → promote → approve → baseline) on one long page after board/compare context switches.

**Top recommendation:** Proceed to **M4B Design Tokens & Primitives**, then **M4C Navigation IA**, then simplify PI Review/Board (M4D) — without changing domain contracts.

Browser evidence: Org Admin (temp-auth) walkthrough **34/34** steps PASS. Viewer / Dept / Team / Project Manager UI personas: **NOT VERIFIED** in browser (single principal).

---

## 2. UX Maturity Assessment

| Level | Definition | Current |
|---|---|---|
| 1 | Screens exist; experts only | Surpassed |
| 2 | Consistent chrome; managers need training | **← here (partial)** |
| 3 | Guided workflows; progressive disclosure | Target for M4D–E |
| 4 | Role-tuned IA; strong a11y/responsive | Later M4F |
| 5 | Productized design system + measured UX | Out of M4 |

**Maturity score: 2.6 / 5**

Strengths: Breadcrumbs, Panel/PageHeader primitives, PI lifecycle copy (Selected ≠ Approved ≠ Baselined), Portfolio attention cards with drill-downs, permission `title` tooltips on disabled PI actions.

Gaps: Shell follows module inventory; Overview is a long metric list; PI Board packs scenario CRUD + board + backlog; Compare requires re-selection; Capacity empty until PI picked with weak default; Initiative tabs can exceed 12 items; “Phase 6 identity” / technical subtitles leak into chrome.

---

## 3. UI Inventory

| Area | Route(s) | Primary user | Main task | Interaction model | Nav problems | Visual consistency | Complexity | A11y | Responsive |
|---|---|---|---|---|---|---|---|---|---|
| Login / access | `/login`, `/access-not-configured`, `/setup/bootstrap` | All / bootstrap | Authenticate | Credentials form + SSO placeholder | OK | Simple | Low | Labels OK | OK |
| Overview | `/` | Managers | Helicopter metrics | Metric cards + links | Dense vertical stack | Tokens OK | Medium | OK | Mobile single-column long |
| Organization hierarchy | `/organization`, `…/sections/…`, `…/departments/…`, `…/teams/…` | Org / Section / Dept mgr | Structure | Nested pages + forms | Deep hierarchy; many hops | Panels consistent | Medium | Forms labeled | OK |
| Resources | `…/resources`, `…/resources/[id]` | Resource / Team mgr | Capacity membership | List + detail forms | Not in shell (org-only) | OK | Medium | OK | Tables may scroll |
| Access & roles | `…/access` | Org admin | Bind roles | Forms | Buried under org | OK | Medium-High | OK | OK |
| Initiatives list | `/initiatives` | Portfolio / Dept / PM | Find / create | Table + stage filters | Shell OK | OK | Low-Med | Table headers | OK |
| Initiative workspace | `/initiatives/[id]/*` | PM / reviewers | Lifecycle stages | **12+ tabs** when full | Tab overflow | OK | High | Tab nav as links | Tabs wrap |
| Demand / Requirements / Pre-study | stage tabs | PM | Capture evidence | Forms + lists | Progressive show helps | OK | Medium | OK | Forms stack |
| Governance | `…/governance`, `/approvals` | Governance reviewer | Submit / approve | Forms + inbox | Approvals vs initiative path split | OK | High | OK | OK |
| Decisions | `/decisions`, `…/decisions` | Decision makers | Record outcomes | Inbox + log | Dual entry points | OK | Medium | OK | OK |
| PoC / Pilot | `…/poc`, `…/pilot` | Experiment owners | Run / evaluate | Stage panels | Discover via tabs only | OK | Medium | OK | OK |
| Project delivery | `…/project` | PM | Work / milestones / issues | Long page sections | Anchors vs tabs | OK | High | OK | Dense |
| Issues / blockers | project `#issues` | PM / managers | Resolve blockers | Embedded lists | Weak global discoverability | OK | Medium | OK | OK |
| Project closure | project section | PM / Dept mgr | Close project | Forms | Easy to miss | OK | Medium | OK | OK |
| PI list | `/pi` | PI planner | Pick PI | Table | OK | OK | Low | OK | OK |
| PI board + scenarios | `/pi/[id]/board` | PI planner | Allocate / scenarios | DnD + **3 CRUD forms** + filters + backlog | Scenario mgmt competes with board | Busy | **Very high** | Forms OK | Filters stack; board scrolls |
| Scenario compare | `/pi/[id]/compare` | PI planner / reviewer | Diff plans | Checkbox select 2–3 | Must re-pick; not sticky | Cleaner | Medium | OK | Tabs wrap |
| Selection / review | `/pi/[id]/review` | Section / Org mgr | Select→promote→approve→baseline | Vertical stack of panels | Long page; 4 irreversible concepts | Status banners good | **Very high** | Landmarks OK | Long scroll |
| Baseline | `/pi/[id]/baseline` | Org admin | History | List/detail | Separate from Review | OK | Low-Med | OK | OK |
| PI capacity (local) | `/pi/[id]/capacity` | Team / Dept mgr | Hours by team | Tables / bars | vs Portfolio capacity naming | OK | Medium | OK | Horizontal risk |
| Portfolio dashboard | `/portfolio` | Portfolio / Section | Attention | KPI cards + charts | Explorer / Capacity siblings | Closest to vision | Medium-High | OK | Cards stack |
| Portfolio explorer | `/portfolio/explorer` | Managers | Find entities | Filters + table | Shell sibling of Portfolio | OK | Medium | OK | Table scroll |
| Delivery health | `/portfolio/health` | Portfolio mgr | Risk projects | Status cards | **Not in shell nav** | OK | Medium | OK | OK |
| PI & Capacity (portfolio) | `/portfolio/capacity` | Section / Dept | Cross-PI capacity | Scope form + dept cards | Empty until PI selected; title duplicated | Partial vs reference | Medium | OK | Needs progressive disclosure |
| Governance policy | `/organization/[id]/governance-policy` | Org admin | Policy config | Forms | Shell link needs org context | OK | Medium | OK | OK |

---

## 4. User Journey Assessments

### Journey A — Initiative to Delivery

Idea → Requirements → Pre-study → Governance → PoC → Pilot → Project → Delivery → Closure.

| Factor | Assessment |
|---|---|
| Steps / clicks | High — each stage is a separate tab/route; inbox hops for approvals/decisions |
| Terminology | Mostly glossary-aligned (Demand, Pre-study, PoC) |
| Context switches | Approvals/Decisions are global; return path to initiative not always sticky |
| Dead ends | Risks create-only (prior UX report); Documents metadata-only |
| Feedback | Stage readiness present; Attention column often empty (“—”) |
| Duplicate entry | Decisions in shell + initiative tab |
| Cognitive load | 12 tabs when fully expanded |
| Next-action discoverability | Better after 5.5 CTAs; still tab-hunting |

**Verdict:** Workable for trained PMs; progressive disclosure of tabs helps early stages; late-stage tab strip is overloaded.

### Journey B — PI Planning

PI → Teams → WorkItems → Allocations → Scenarios → Compare → Select → Promote → Approve → Baseline.

| Factor | Assessment |
|---|---|
| Steps / clicks | **Highest friction journey** — Board (create/edit) → Compare (re-select) → Review (select again) → Promote → Approve → Baseline |
| Terminology | Clear lifecycle labels on Review; “CURRENT” vs scenario status good |
| Context switches | Scenario selection not carried from Compare → Review |
| Dead ends | Promote disabled without selection (explained); baseline disabled when stale (explained) |
| Feedback | Strong banners; confirm dialogs for consequential actions |
| Cognitive load | Board packs scenario admin + planning; Review packs 4 lifecycle phases |
| Next-action | Review checklist helps; primary CTA not always singular |

**Verdict:** Most confusing workflow for managers. Correctness is strong; UX choreography is not.

### Journey C — Management

Portfolio → Find Initiative/Project → Identify problem → Inspect owner → Navigate to action.

| Factor | Assessment |
|---|---|
| Steps | Portfolio → Explorer or Delivery Health → entity |
| Friction | Delivery Health missing from shell; Overview metrics ≠ Portfolio |
| Ownership | Portfolio ownership section often empty in fixtures |
| Next-action | Attention cards link well when populated |

**Verdict:** Portfolio is the right hub; shell duplication (Portfolio / Explorer / PI & Capacity) and missing Health link hurt discoverability.

### Journey D — Resource Planning

PI Capacity → Department → Team → Resource → Allocation → Conflict.

| Factor | Assessment |
|---|---|
| Steps | Portfolio Capacity requires org + PI apply; then drill |
| Empty state | “No PI selected” common; PI list at bottom under-linked to Apply |
| vs reference | `resource-overview.html` shows richer dept cards / stacked bars; product is flatter |
| Conflicts | PI Dependencies + Review checklist — split |

**Verdict:** Functional CURRENT-only capacity is correct; UX lacks progressive default PI and reference-level resource stacking.

### Journey E — Governance

Submission → Evidence → Approval → Decision → Next lifecycle step.

| Factor | Assessment |
|---|---|
| Steps | Initiative governance tab → `/approvals` → `/decisions` → back |
| Friction | Dual inboxes; policy under Organization |
| Feedback | Post-decision CTAs improved in 5.5 |
| Cognitive load | Gate/revision language can feel technical |

**Verdict:** Secure and auditable; IA still module-shaped rather than “this initiative’s gate.”

---

## 5. Navigation Assessment

### Current shell (`AppShell`)

Flat list: Overview · Portfolio · Explorer · PI & Capacity · Organization · Initiatives · Approvals · Decisions · PI Planning · Governance policy.

Problems:

1. **Backend-shaped:** Approvals/Decisions/PI Planning sit as peer products, not modes of Portfolio/Lifecycle.
2. **Portfolio fragmentation:** Portfolio / Explorer / PI & Capacity / Health (unlisted) compete.
3. **Governance policy** depends on org id in path; otherwise lands on `/organization`.
4. **No role-specific nav** — all items always shown (`available: true`).
5. **Subtitle noise:** “Phase 6 identity” / “Structured management foundation” do not help tasks.
6. Mobile drawer works; long list unchanged.

### Proposed target navigation (do not implement)

```
Work
  · Home (attention)          → today’s / + portfolio attention merge
  · Portfolio                 → /portfolio (hub)
      · Explorer              → nested
      · Delivery health       → nested (promote from orphan)
      · Capacity              → nested
  · Initiatives               → /initiatives
  · PI Planning               → /pi

Organize
  · Organization              → hierarchy + resources
  · Access & roles            → org-scoped (capability-gated)

Govern
  · Approvals inbox
  · Decisions inbox
  · Governance policy         → org-scoped
```

Principles: **workflow hubs over module inventory**; nest Portfolio children; capability-filter Govern/Organize items; keep breadcrumbs.

---

## 6. Design System Assessment

### Tokens (current `:root`)

`--bg #f4f6f8`, `--surface`, `--ink`, `--muted`, `--line`, `--accent #0f4c5c`, `--sidebar #102a43`, danger/warning/ok. Fonts: Source Sans / Source Serif.

### Reference (`resource-overview.html`)

Teal accent `#087f78`, KPI accent bars, dept cards with util tracks, stacked allocation segments, compact 14px UI, Inter.

### Gaps vs reference / consistency

| Element | Finding |
|---|---|
| Typography | Display headings good; body sometimes large for dense ops screens |
| Color | Accent teal family OK; status colors underused on Overview zeros |
| Spacing | Generous on Portfolio; cramped on PI Board scenario strip |
| Buttons | Primary/Secondary primitives exist; confirm dialogs ad hoc |
| Forms | `FormField` + `fieldClassName` consistent |
| Tables | Basic; few responsive strategies |
| Cards / Panels | `Panel` used widely; Portfolio uses more card-like KPIs |
| Badges / status | Scenario status text; capacity chips inconsistent shape |
| Dialogs | Confirm patterns on Review; not a shared Dialog primitive |
| Loading / empty | EmptyState exists; some pages only short sentences |
| Charts / bars | Capacity bars present; not as rich as reference stacked segments |

**Recommendation:** Formalize tokens (color, type scale, space, radius, elevation), shared Dialog/Confirm, StatusBadge, DataTable, CapacityBar — align emotionally with reference without cloning Inter/layout.

---

## 7. Complexity Findings

| Screen | Issue |
|---|---|
| **PI Board** | Scenario create/clone/rename + lifecycle links + 4 filters + board + backlog on one view |
| **PI Review** | Four consequential phases stacked; checklist + status + conflicts below fold |
| **Initiative workspace** | Up to 12 tabs; hard to scan “what do I do next?” |
| **Portfolio dashboard** | Many sections; first-time managers face metric overload (still better than Overview) |
| **Overview** | Long single-column KPI list; weak progressive disclosure |
| **Access & roles** | Technical binding UI |
| **Compare** | Cleaner, but forces re-selection and feels disconnected from Review |

Missing progressive disclosure: scenario admin should collapse when viewing CURRENT board; Review should wizard or stepped reveal; Capacity should auto-select latest REVIEW/ACTIVE PI.

---

## 8. Role-Based UX

| Persona | Shell relevance | Key surfaces | Browser verified? |
|---|---|---|---|
| Portfolio / Section Manager | Portfolio, Capacity, Approvals, PI Review | Attention + promote/approve | Partial (as Org Admin) |
| Department Manager | Initiatives, Capacity, Project | Dept-scoped data | **NOT VERIFIED** |
| Team Manager | PI Board allocate, Capacity | Team rows | **NOT VERIFIED** |
| Project Manager | Initiative → Project | Delivery | Partial (list + project tab screenshots) |
| PI Planner | PI Board / Compare | Allocations/scenarios | Yes (Admin) |
| Governance reviewer | Approvals / Decisions / Governance tab | Gates | List pages only |
| Viewer | Read dashboards | Disabled mutations | **NOT VERIFIED** (INT covers FORBIDDEN) |

Server-side AuthZ remains authoritative. UI already uses `PrincipalCapabilities` + `permissionTitle()` on PI select/promote/approve/baseline.

**Recommendations (UI only):**

- Hide Govern/Access nav items without capability (not only disable).
- Keep disabled consequential buttons with visible reason (current pattern — extend).
- Never rely on hiding alone for security.
- Avoid silent no-ops (already conflict-oriented on stale versions).

---

## 9. Accessibility

### Automated / scripted (manual browser)

| Check | Result |
|---|---|
| Landmarks (`nav`, `main`) on Review | PASS (`nav=3`, `main=1`, `h1=1`) |
| Unlabeled inputs on Review | PASS (`0`) |
| Keyboard Tab reaches focusable controls | PASS (focus outline `auto`) |
| Breadcrumb `aria-label` | PASS (code) |
| Primary nav `aria-label` | PASS |
| Mobile nav open/close labels | PASS |

### Manual / code-informed gaps

| Issue | Severity | Notes |
|---|---|---|
| Focus ring relies on browser `auto`; no design-system focus token | P2 | May be low-visibility on some controls |
| PI tab strip as links without `aria-current` consistently | P2 | Active styled visually |
| Compare checkboxes — verify fieldset/legend | P2 | Instructional text present |
| Dense tables — limited scope/row headers | P2 | Explorer / initiatives |
| Color-only status risk on capacity bars | P2 | Usually paired with text % |
| Touch targets on compact table links | P3 | Mobile |
| Screen-reader live regions for Action errors | P2 | Errors in DOM; may not announce |
| Dialog focus trap on confirm promote/approve | P2 | Custom confirms — verify focus return |

**No P0 a11y blocker proven** for critical login/review path in this audit. WCAG 2.2 AA not fully certified.

---

## 10. Responsive UX

| Viewport | Findings |
|---|---|
| Desktop 1440 | Usable; Board/Review long; Overview wastes horizontal space |
| Tablet (inferred) | Sidebar collapses to drawer; PI tabs wrap (Settings on second line) |
| Mobile 390 | Drawer OK; Board/Compare/Review usable but heavy scroll; tables/boards need horizontal scroll; **wrapping PI tabs** |

Horizontal scrolling for board grids may be inevitable; **not** acceptable as the only strategy for Compare metrics or Capacity dept cards — prefer stacked cards (reference pattern).

---

## 11. UX Defect Register

| ID | Sev | Route | Role | Problem | Evidence | Impact | Recommended improvement | Effort | M4 phase |
|---|---|---|---|---|---|---|---|---|---|
| UX-001 | P1 | `/pi/[id]/review` | Section/Org mgr | Four irreversible lifecycle actions stacked; easy to lose “what’s next” | `24-pi-review.png`; 2400+ body chars | Wrong-order risk / training burden | Stepped Review (Select → Promote → Approve → Baseline) with one primary CTA | L | M4D |
| UX-002 | P1 | `/pi/[id]/board` | PI planner | Scenario CRUD + board + backlog overload | `21-pi-board.png` | Slow allocation; errors | Collapse scenario admin; separate “Manage scenarios” | L | M4D |
| UX-003 | P1 | Compare → Review | PI planner | Selection not preserved across Compare/Review | Browser journey | Duplicate work | Persist selected revision in URL/PI state for Review handoff | M | M4D |
| UX-004 | P1 | Shell | All managers | Delivery Health not in primary nav | `/portfolio/health` absent from `navItems` | Attention path missed | Nest under Portfolio | S | M4C |
| UX-005 | P2 | Shell | All | Flat module nav; Portfolio siblings compete | `app-shell.tsx`; screenshots | Cognitive load | Target IA §5 | M | M4C |
| UX-006 | P2 | `/portfolio/capacity` | Section/Dept | Empty until PI selected; redundant titles; weak default | `05-pi-capacity.png` | Drop-off | Auto-select latest PI; single H1; dept cards like reference | M | M4E |
| UX-007 | P2 | `/` Overview | Managers | Long metric laundry list | `m09-nav-open.png` / overview | Low signal | Attention-first Home; progressive metrics | M | M4C/E |
| UX-008 | P2 | Initiative tabs | PM | Up to 12 tabs | Workspace screenshot | Hard scan | Group “Delivery” overflow menu; emphasize current stage | M | M4D |
| UX-009 | P2 | Global | All | Chrome copy “Phase 6 identity” | All shells | Unprofessional / confusing | Product tagline / env badge only | S | M4B |
| UX-010 | P2 | A11y global | All | Focus/dialog/live-region gaps | Manual + code | Keyboard/SR friction | Focus token; Dialog primitive; aria-live on errors | M | M4F |
| UX-011 | P2 | Responsive PI tabs | Mobile | Tab wrap | `m07-pi-compare.png` | Mis-taps | Scrollable tablist | S | M4F |
| UX-012 | P2 | Role UI | Non-admin | Shell shows all modules | Code `available: true` | Clutter / temptation | Capability-filtered nav | M | M4C |
| UX-013 | P3 | Design system | Eng | No shared Dialog/StatusBadge/DataTable | `components/ui` sparse | Inconsistency | Primitives package | M | M4B |
| UX-014 | P3 | Capacity visuals | Planners | Bars simpler than reference stacked segments | vs `resource-overview.html` | Harder resource conflict reading | Stacked allocation bar component | M | M4E |
| UX-015 | P3 | Initiatives list | PM | Stage filter pills omit Project/PoC/Pilot | `07-initiatives.png` | Filter dead-end | Extend filters or “Active delivery” | S | M4E |
| UX-016 | P3 | Sign-out | Temp-auth | SignOut only for OIDC | `app-shell.tsx` | Temp users unclear session end | Show sign-out for temp-auth too | S | M4B |

No **P0** (unsafe/inaccessible critical path) confirmed for Org Admin browser path. Authorization failures remain server-enforced.

---

## 12. Prioritized Backlog

Priority ≈ User impact × Frequency × Severity × (1/Effort).

### Quick wins (S)

1. UX-004 — Add Delivery Health under Portfolio nav  
2. UX-009 — Remove “Phase 6 identity” chrome noise  
3. UX-016 — Sign-out for temp-auth  
4. UX-011 — Scrollable PI tablist  
5. UX-015 — Initiative stage filters for delivery stages  

### Design system (M4B)

- Tokens (color/type/space/radius/motion)  
- Dialog/Confirm, StatusBadge, Alert variants, DataTable, CapacityBar  
- Focus-visible standard  

### Navigation restructuring (M4C)

- Nested Portfolio hub  
- Capability-filtered shell  
- Home = attention merge  

### Workflow simplification (M4D)

- PI Board scenario drawer  
- Review stepper  
- Compare→Review selection continuity  
- Initiative tab grouping  

### Accessibility (M4F early)

- Dialog focus trap  
- aria-live errors  
- Table semantics  
- Contrast audit on muted/sidebar  

### Responsive (M4F)

- Tablists  
- Capacity/Explorer card stacks  
- Board horizontal strategy with sticky team column  

---

## 13. Proposed Target UX Architecture

| Layer | Recommendation |
|---|---|
| Navigation | Workflow hubs (§5); role-filtered |
| Page layouts | `PageHeader` + optional `ScopeBar` + `PrimaryAction` + `Section` |
| Design tokens | CSS variables extended; map accent toward reference teal family carefully |
| Forms | Keep `FormField`; inline errors + `aria-describedby` |
| Tables | Shared DataTable: column priority, card fallback &lt;md |
| Status / feedback | StatusBadge; Alert tone; toast/aria-live for async |
| Responsive | Drawer nav; scroll tablists; stack KPIs; board sticky axis |
| Role-aware controls | Capabilities → hide nav / disable + explain actions |

**Preserve** backend domain, AuthZ, PI scenario contracts, Portfolio CURRENT-only semantics.

---

## 14. M4B–M4F Roadmap

| Phase | Focus | Exit criteria |
|---|---|---|
| **M4B — Design tokens & primitives** | Tokens, Button/Dialog/Badge/Table/Bar, chrome cleanup | Story/doc of primitives; no domain changes |
| **M4C — Navigation & IA** | Nested Portfolio; Health link; capability nav; Home attention | Shell IA matches §5; browser IA audit |
| **M4D — Workflow simplification** | PI Board/Review/Compare choreography; initiative tab groups | Journey B click-count ↓; Review stepper UX test |
| **M4E — Portfolio & capacity UX** | Default PI, dept/resource cards, filter completeness | Capacity empty-state rare; closer to reference usability |
| **M4F — A11y & responsive hardening** | WCAG 2.2 AA practical pass; mobile tab/table patterns | Keyboard+SR checklist; mobile journey PASS |

**Do not start M4B implementation in this PR.**

---

## 15. Evidence Appendix

| Item | Path |
|---|---|
| Browser audit JSON | [`docs/acceptance-assets/m4a/audit-result.json`](./acceptance-assets/m4a/audit-result.json) |
| Screenshots | [`docs/acceptance-assets/m4a/screenshots/`](./acceptance-assets/m4a/screenshots/) |
| Audit script | `scripts/m4a-ux-browser-audit.mjs` (local artifacts; optional commit) |
| QA DB | `management_platform_m3d_qa` (isolated; not used for destructive INT) |
| App URL | http://localhost:43148 |
| Browser persona | Temp-auth Organization Admin (`owner`) |
| NOT VERIFIED personas | Viewer, Dept/Team/Project Manager, Resource Owner, unbound |

### Screenshot index (selected)

| File | Subject |
|---|---|
| `02-portfolio-dashboard.png` | Portfolio hub density |
| `05-pi-capacity.png` | Empty PI selection friction |
| `07-initiatives.png` | Initiatives table / filters |
| `14-initiative-workspace.png` | Tab overload |
| `21-pi-board.png` | Board + scenario CRUD density |
| `22-pi-compare.png` | Compare selection |
| `24-pi-review.png` | Review stack |
| `m07-pi-compare.png` | Mobile tab wrap |
| `m09-nav-open.png` | Mobile nav + Overview length |

### Quality gates (documentation milestone)

- No application code, schema, migrations, or production config modified for product behavior.
- Audit report completeness: sections 1–15 present.
- Browser walkthrough evidence attached.

---

## Final audit lines

**STATUS:** M4A UX AUDIT COMPLETE  

**UX maturity:** 2.6 / 5  

**Most confusing workflow:** PI Planning Review / Board choreography (Journey B)  

**Next:** M4B — Design tokens & primitives (implementation in a later milestone)
