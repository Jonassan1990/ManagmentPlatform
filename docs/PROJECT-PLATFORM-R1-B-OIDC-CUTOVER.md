# PROJECT PLATFORM — R1-B

## Enterprise OIDC, Multi-User Authentication & Secure Identity Cutover

**STATUS: PARTIAL — CODE READY / PRODUCTION OIDC BLOCKED**

**Verdict:** `R1-B CODE READY — PRODUCTION OIDC BLOCKED`

**Date:** 2026-10-10  
**Starting main SHA:** `421d9e6e8f5ef55be1036509c784a2d57d48f490`  
**Branch:** `cursor/r1b-oidc-cutover-60bb`

---

## 1. Baseline

| Check | Result |
|---|---|
| `origin/main` | `421d9e6…` (R1-A docs merge #63) |
| M0–M4 | Complete on main |
| R1-A | Merged; production migrations **14/14** |
| Temporary owner login | Present (ADR-026 Credentials provider) |
| Phase 0C RBAC | `AuthorizationService.assertCan` + RoleBindings |
| Principal / ExternalIdentity / RoleBinding | Present (Phase 6 schema) |

---

## 2. Architecture

```text
OIDC IdP ──► Auth.js (generic oidc provider)
                │
                ├─ validateOidcSignInClaims(issuer, subject, aud?)
                ├─ IdentityService.resolveOrCreateFromOidc(issuer, subject)
                │     └─ ExternalIdentity(issuer,subject) → Principal
                │           (JIT: zero RoleBindings)
                └─ JWT session: principalId only (8h, HttpOnly, Secure, SameSite=lax)

Authorization (unchanged):
  RoleBinding + ScopeType + Permission ──► assertCan / can
  Authentication ≠ authorization
```

**Cutover link (new):** PLATFORM `ROLE_MANAGE` → `linkOidcIdentityToPrincipal` → attach OIDC `(issuer,subject)` to an existing Principal (e.g. temporary owner) without email merge (ADR-028).

---

## 3. IdP requirements (operator)

Do **not** invent production issuer/client values.

| Item | Requirement |
|---|---|
| Issuer | HTTPS OIDC discovery-capable issuer URL → `OIDC_ISSUER` |
| Client | Confidential client → `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` |
| Redirect URI | `{AUTH_URL}/api/auth/callback/oidc` |
| Scopes | Default `openid profile email` (`OIDC_SCOPES` optional) |
| Stable subject | IdP `sub` (never email alone) |
| Token validation | Auth.js OIDC + app claim checks (issuer match, optional `aud`) |
| Session | Auth.js JWT cookie (see §7) |
| Logout | App `signOut` → `/login` (JWT cookie cleared) |

### Production configuration status (this session)

| Variable | Production present? |
|---|---|
| `AUTH_SECRET` | Yes (sensitive) |
| `AUTH_URL` | Yes (sensitive) |
| `TEMP_AUTH_*` | Yes (sensitive) |
| `OIDC_ISSUER` | **No** |
| `OIDC_CLIENT_ID` | **No** |
| `OIDC_CLIENT_SECRET` | **No** |

**Operator action required:** Register an OIDC client for `https://managmentplatform.vercel.app`, set the three `OIDC_*` secrets (and confirm `AUTH_URL` / `AUTH_SECRET`) in Vercel Production, redeploy, then verify SSO before removing `TEMP_AUTH_*`.

---

## 4. Principal mapping

| Event | Behavior |
|---|---|
| First OIDC login | JIT create Principal + ExternalIdentity; **no roles** |
| Repeat login | Same `(issuer, subject)` → same Principal; update snapshots |
| Different issuer, same `sub` | Distinct Principals |
| Email match with temp owner | **No merge** — separate Principal |
| Explicit link | PLATFORM admin links `(issuer, subject)` → target Principal |

---

## 5. RBAC (preserved)

- PLATFORM bootstrap scope
- Organization / Section / Department / Team scopes
- Project ownership relationships (narrow grants; never `pi.baseline` via ownership alone)
- `PI_REVIEW` / `PI_BASELINE`
- Governance approval/decision permissions
- Server-side `assertCan` on mutations; JWT never stores roles

Evidence: existing Phase 0C integration suite + R1-B link tests (link does not grant bindings).

---

## 6. Onboarding

| State | UX |
|---|---|
| First OIDC login | Principal created → `/access-not-configured` |
| Bootstrap available | `/setup/bootstrap` (one-time `BOOTSTRAP_SETUP_TOKEN`) |
| Bootstrap consumed | Admin assigns RoleBindings (`/organization/…/access`) |
| Owner SSO cutover | `/setup/link-oidc` (PLATFORM) **or** assign roles to new OIDC Principal |
| Revocation | `expireRoleBinding`; ExternalIdentity retained for audit |
| Cross-org | Scope matching + org isolation (Phase 0C) |

---

## 7. Session security

| Control | Status |
|---|---|
| JWT session | Yes |
| HttpOnly cookie | Yes |
| Secure (production) | Yes (`__Secure-authjs.session-token`) |
| SameSite | `lax` |
| Expiry | 8 hours |
| Logout | `signOut` → `/login` |
| CSRF | Auth.js defaults for OAuth/OIDC + SameSite |
| Roles in session | **No** — `principalId` only |
| Server AuthZ | `assertCan` / `can` |

---

## 8. Security tests

| Case | Coverage |
|---|---|
| Valid OIDC resolve / reuse | `phase6-identity` + R1-B |
| Invalid issuer | `oidc-claims` unit |
| Invalid audience | `oidc-claims` unit |
| Missing subject | `oidc-claims` unit |
| Missing configuration | `oidc-claims` + `isOidcConfigured` |
| Cross-user isolation | Distinct issuer/subject Principals |
| RoleBinding denial (JIT) | R1-B integration |
| Identity conflict on link | R1-B integration |
| No email auto-merge | R1-B integration |
| Temp-auth coexistence | R1-B + temp-auth suites |
| DEV auth disabled in production | `phase6-auth` unit |
| Link requires PLATFORM ROLE_MANAGE | R1-B integration |

Expired tokens / signature failures are rejected by Auth.js before app callbacks; empty/`sub` still fail closed in claim validation.

---

## 9. Browser QA

| Scenario | Result |
|---|---|
| OIDC sign-in (Production) | **BLOCKED** — IdP client env not configured |
| Temp owner login / recovery | Available (existing Production TEMP_AUTH) |
| Access-not-configured / bootstrap | Covered by existing Phase 6 UX |
| Link OIDC UI | Implemented at `/setup/link-oidc` (PLATFORM) — verify after IdP wired |
| Viewer / cross-org / logout | Covered by Phase 0C + shell logout; re-verify after SSO |

Isolated automated browser SSO against a real IdP was not run (no production or test IdP secrets). Integration tests use controlled mock identity inputs.

---

## 10. Cutover plan

1. Configure `OIDC_*` + confirm `AUTH_URL` / `AUTH_SECRET` in Vercel Production.
2. Redeploy; confirm `/login` shows SSO.
3. Sign in with intended admin IdP account (expect `/access-not-configured` if new Principal).
4. **Either:**
   - Link IdP `(issuer, subject)` to temporary owner Principal via `/setup/link-oidc` (signed in as PLATFORM admin via TEMP_AUTH), **or**
   - Assign RoleBindings to the new OIDC Principal.
5. Verify authorized navigation, RoleBindings, logout, session expiry.
6. Confirm recovery: TEMP_AUTH still works until step 7.
7. **Separate change:** remove `TEMP_AUTH_*` from Production; remove Credentials provider / login branch; redeploy.

Do **not** share the temporary owner password among users.

---

## 11. Rollback

| Situation | Action |
|---|---|
| Bad OIDC config | Unset/fix `OIDC_*`; TEMP_AUTH remains recovery path |
| Wrong identity link | Do not delete Principal; expire bad RoleBindings; leave ExternalIdentity for audit; link correct subject to correct Principal (conflict rules apply) |
| App regression | Redeploy previous Vercel deployment; schema unchanged by R1-B |

---

## 12. Temporary-auth removal plan

| Gate | Required before TEMP_AUTH removal |
|---|---|
| OIDC login works in Production | Pending IdP |
| ≥1 intended administrator can access via SSO | Pending |
| RoleBindings verified | Pending |
| Logout / session expiry verified | Pending post-IdP |
| Recovery documented | This document + runbook |

Until gates pass: **keep TEMP_AUTH**.

---

## 13. Production verification evidence

| Item | Evidence |
|---|---|
| Migrations 14/14 | R1-A (`PROJECT-PLATFORM-R1-A-PRODUCTION-DB-RECOVERY.md`) |
| Production OIDC secrets | **Absent** (Vercel env inventory) |
| Live SSO test | **Not fabricated** — blocked |

---

## 14. Remaining R1-C scope (do not implement here)

Suggested R1-C themes (informational only):

- Production IdP registration + live SSO verification
- TEMP_AUTH retirement PR
- Optional IdP-initiated logout / RP-logout
- Hardened rate limiting for credentials (if any residual)
- Org-admin self-service invite without PLATFORM link tool

**STOP — do not implement R1-C in this change set.**
