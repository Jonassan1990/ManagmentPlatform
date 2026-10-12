# Executive portfolio templates → platform

**Audience:** Leadership (boss / portfolio owner)  
**Sources (structure only):** QE Portfolio Tracker (Excel stage wall) + PI planning board (PowerPoint).  
**Sensitive content:** Live names, sites, and project titles from uploads are **not** stored in the repo. See `artifacts/executive-templates/sanitized-portfolio-tracker.model.json`.

---

## 1. What the boss needs in one screen

| Pillar | Question | Platform surface |
|--------|----------|------------------|
| **Cost** | What did we plan vs forecast vs spend? | Project money fields → Executive brief rollup |
| **Resources** | Are we overloaded this PI? | `/portfolio/capacity` + snapshot `piCapacity` |
| **Planning** | Where is work in the funnel, and what is this PI committed to? | Initiative stages + `/pi` board + dependencies |

Route: **`/portfolio`** — Executive brief sits at the top of the authorized portfolio dashboard.

---

## 2. Excel tracker → initiative funnel

| Tracker column | Platform |
|----------------|----------|
| Business needs / Idea inbox | `DEMAND` |
| Prestudy | `PRE_STUDY` |
| Requirement elicitation | `REQUIREMENTS` |
| Initiation & planning / Execution / Implementation | `POC` / `PILOT` / `PROJECT` |
| Closure / Completed | Project `COMPLETED` |
| Portfolio theme | Initiative / program grouping |
| Status RAG | Delivery health + project status |
| Project leader / Department | Resource ownership + department scope |
| Cost challenge sheet | `plannedCost` / `forecastCost` / `actualCost` |

---

## 3. PI deck template → planning board

| Deck field | Platform |
|------------|----------|
| PI cw range | `ProgramIncrement` dates |
| Objectives (T/G) | Project / initiative objectives text |
| MVP + Definition of Done | Milestones + success criteria |
| Q / enterprise dependencies | `PlanningDependency` |
| RACI | Ownership parties |
| Re-planned from prior PI | Baseline compare + conflicts |

---

## 4. Implementation rules

1. **Authorize first** — same portfolio visibility as M2A snapshot.  
2. **No invented KPIs** — hours from capacity-policy; money from Project fields only.  
3. **Null ≠ zero** — missing cost or capacity stays unavailable / em dash.  
4. **Templates stay thin** — Excel/PPT are skins over domain objects, not a second database.
