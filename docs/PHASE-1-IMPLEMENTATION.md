# Phase 1 Implementation

**Status:** Implemented on branch `phase1-technical-foundation`  
**Baseline:** Phase 0 commit `2adc901997bca4c399ce914032e52ce12248ff21`

---

## 1. Goal

Deliver a production-quality technical foundation and one real vertical slice:

```text
Organization → Section → Department → Team → Resource
```

Phase 1 does **not** implement Demand, Requirements, Pre-study, PoC, Pilot, Projects, PI Planning, Capacity engine, Dependencies, Decisions, Approvals, Excel import, or advanced executive dashboards.

---

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js App Router (TypeScript strict) |
| UI | React + Tailwind CSS |
| Database | PostgreSQL 16 via Docker Compose (local) |
| ORM | Prisma 6 |
| Validation | Zod (server-side) |
| Tests | Vitest (unit + integration) |
| Deploy target | Vercel-ready, domain not coupled to Vercel |

---

## 3. Modular monolith structure

```text
src/
  app/                         # UI routes + thin server actions
  components/                  # Presentation components
  modules/
    organization/              # Organization domain + application services
    identity-access/           # Principal, scoped authZ foundation
    audit/                     # Structured audit writer
    shared/                    # errors, permissions
  server/                      # env, db, composition root
prisma/                        # schema + migrations
tests/unit/
tests/integration/
```

### Boundary rule

UI and server actions call application services. They do **not** call Prisma directly for business mutations.

Chosen mutation approach: **Next.js Server Actions** → application services (`OrganizationService`, `AuthorizationService`, `AuditService`).

---

## 4. Decisions locked in Phase 1

### ADR-001 — Membership model

**Decision:** Use explicit `ResourceMembership` rows (resource ↔ team), not a single embedded `teamId` on `Resource`.

**Why:** Answers Phase 0 OQ-03 with the simplest future-proof option. Phase 1 commonly assigns one primary membership, but the schema already supports multiple concurrent memberships.

### ADR-002 — Resource ≠ User

**Decision:** `Resource` and `Principal` are separate tables/concepts.

**Why:** Phase 0 requires extensibility beyond people and forbids equating capacity entities with login accounts.

### ADR-003 — Archive over hard delete

**Decision:** Organizational entities use `status = ACTIVE | ARCHIVED`. Phase 1 UI focuses on create/update; archive is available in the service for Organization and documented for expansion.

**Why:** Hard deletes would destroy future historical references.

### ADR-004 — Optimistic concurrency

**Decision:** Mutable org entities include `version`. Updates require `expectedVersion`. Stale writes return `STALE_VERSION` (HTTP 409 semantics).

### ADR-005 — DEV-only auth bridge

**Decision:** Until OIDC is chosen, local development may use:

- `NODE_ENV=development`
- `ALLOW_DEV_AUTH=true`
- `DEV_AUTH_PRINCIPAL_ID=<developer-generated UUID>`

Production rejects `ALLOW_DEV_AUTH`. Missing principal fails closed (`UNAUTHORIZED`).

No hardcoded personal email/identity exists in source.

### ADR-006 — First-run bootstrap

**Decision:** When organization count is zero, the authenticated principal may receive a platform bootstrap role binding and create the first organization. Creating the first organization grants that principal an organization-admin binding for it.

Long-term production bootstrap remains an ops-time secure process (open question OQ-11 refined, not solved by hardcoding).

### ADR-007 — Single section tier

**Decision:** Sections do not nest in Phase 1 (aligns with Phase 0 assumption for OQ-02).

---

## 5. Empty database behavior

A fresh database:

1. Shows Overview empty-state guidance.
2. Offers first-run setup at `/organization/setup`.
3. Does not insert fake organizations, departments, teams, or resources.
4. Requires an authenticated principal (DEV bridge locally).

---

## 6. Audit foundation

`AuditEvent` records structured payloads for material organization changes (create/update/archive/membership assign). Append-oriented; no secrets stored.

---

## 7. Explicit non-goals (still)

Everything listed in section 1 as not implemented remains out of Phase 1.

---

## 8. Conflicts with Phase 0

No silent product redefinition. Phase 1 resolves selected open questions as ADRs above; remaining opens stay in `OPEN-QUESTIONS.md`.
