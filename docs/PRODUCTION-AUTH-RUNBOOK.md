# Production Auth Runbook

Operator guide for wiring OIDC, temporary owner credentials (ADR-026), and first-time platform bootstrap.

## Prerequisites

- Managed PostgreSQL with `DATABASE_URL` (pooled OK for runtime) and `DIRECT_URL` (direct for migrations)
- Auth.js secrets; OIDC client **or** temporary owner credentials (not `ALLOW_DEV_AUTH`)
- Application URL (`APP_URL` / `AUTH_URL`) matching the deployment host

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Runtime DB (may be pooled) |
| `DIRECT_URL` | Yes when schema declares it | Non-pooled URL for `prisma migrate` |
| `AUTH_SECRET` | Yes when OIDC **or** temp auth enabled | `openssl rand -base64 32` |
| `AUTH_URL` or `APP_URL` | Yes | Public base URL, e.g. `https://app.example.com` |
| `OIDC_ISSUER` | Yes for SSO | Issuer URL (discovery) |
| `OIDC_CLIENT_ID` | Yes for SSO | |
| `OIDC_CLIENT_SECRET` | Yes for SSO | |
| `OIDC_SCOPES` | Optional | Default `openid profile email` |
| `TEMP_AUTH_USERNAME` | Temp owner login | Single username; all `TEMP_AUTH_*` required together |
| `TEMP_AUTH_PASSWORD_HASH` | Temp owner login | bcrypt hash only — never plaintext |
| `TEMP_AUTH_PRINCIPAL_ID` | Temp owner login | Stable Principal UUID |
| `TEMP_AUTH_DISPLAY_NAME` | Optional | Display label |
| `BOOTSTRAP_SETUP_TOKEN` | For first admin | Min 16 chars; one-time consume |
| `ALLOW_DEV_AUTH` | Must be unset/false | Production rejects `true` |
| `DEV_AUTH_*` | Must be unset | Not for production |

## Temporary owner credentials (until OIDC)

See [ADR-026](./adr/ADR-026-temporary-owner-credentials.md). This is **not** DEV auth.

1. Generate secrets locally (do not commit):

```bash
# Principal UUID
node -e "console.log(require('crypto').randomUUID())"

# AUTH_SECRET
openssl rand -base64 32

# Password hash (interactive; prints dotenv-safe base64:… form by default)
node scripts/generate-temp-auth-hash.mjs
# Raw $2b$… also works if the host preserves `$` (use --raw); prefer base64: on Vercel/Next.

# Bootstrap token (min 16 chars)
openssl rand -base64 24
```

2. Set Production env on Vercel: `AUTH_SECRET`, `TEMP_AUTH_USERNAME`, `TEMP_AUTH_PASSWORD_HASH`, `TEMP_AUTH_PRINCIPAL_ID`, optional `TEMP_AUTH_DISPLAY_NAME`, and `BOOTSTRAP_SETUP_TOKEN` if bootstrap not yet consumed. Leave `ALLOW_DEV_AUTH` unset.
3. Redeploy. `/login` shows the username/password form.
4. Sign in → if no RoleBindings, complete `/setup/bootstrap` with the token (same ADR-019 flow).
5. When OIDC is ready: verify SSO, confirm bindings, remove all `TEMP_AUTH_*`, redeploy.

**Rate limiting:** in-process failure throttle is best-effort and not globally reliable across serverless instances.

**Failure modes (temp auth):** incomplete `TEMP_AUTH_*` ⇒ provider disabled (fail closed). Wrong password ⇒ generic error. Identity conflicts ⇒ login denied without browser detail.

## IdP application setup

1. Create a confidential OIDC client.
2. Redirect URI: `{AUTH_URL}/api/auth/callback/oidc`
3. Scopes: `openid profile email` (or set `OIDC_SCOPES`).
4. Note issuer, client id, client secret.

## Database

```bash
npx prisma migrate deploy
```

Use `DIRECT_URL` for migration connectivity when the runtime URL is pooled.

## First operator bootstrap

1. Deploy with OIDC env vars set. Leave `ALLOW_DEV_AUTH` unset.
2. Generate bootstrap token and set `BOOTSTRAP_SETUP_TOKEN` on the host (do not commit it).
3. Sign in via `/login` (SSO). JIT creates a Principal with **no** bindings → `/access-not-configured`.
4. Open `/setup/bootstrap`, submit the token.
5. Confirm you land on overview with platform bootstrap authority.
6. Create the organization; grant org admin roles to other principals as needed.
7. Remove or rotate `BOOTSTRAP_SETUP_TOKEN` after successful consumption (token is already single-use via `BootstrapConsumption`).

## OIDC cutover from temporary owner (R1-B / ADR-028)

While `TEMP_AUTH_*` remains configured, SSO and temporary credentials can coexist.

1. Configure `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (and `AUTH_URL` / `AUTH_SECRET`).
2. Verify SSO login for the intended administrator.
3. **Preserve the temporary owner Principal** (do not delete it; do not auto-merge by email).
4. Explicit link (recommended for continuity): sign in as PLATFORM admin → `/setup/link-oidc` → attach IdP `(issuer, subject)` to `TEMP_AUTH_PRINCIPAL_ID`.
   - Alternative: assign RoleBindings to the new OIDC Principal without linking.
5. Verify RoleBindings, authorized navigation, logout, and session expiry.
6. Only then remove `TEMP_AUTH_*` from Production and retire the Credentials provider in a **separate** controlled change.

See [PROJECT-PLATFORM-R1-B-OIDC-CUTOVER.md](./PROJECT-PLATFORM-R1-B-OIDC-CUTOVER.md).

## Failure modes

| Symptom | Likely cause |
|---|---|
| Login shows sign-in unavailable | Missing OIDC **and** temp auth config |
| Login shows “authentication not configured” (legacy copy) | Missing `OIDC_*` / temp auth env |
| Sign-in error redirect to `/login?error=` | IdP misconfig / redirect URI / secret |
| Signed in but cannot mutate | No role bindings — complete bootstrap or ask admin |
| Bootstrap “already consumed” | Another principal already used the token |
| `ALLOW_DEV_AUTH` env error on boot | Flag set while `NODE_ENV=production` |

## Session security

- Sessions use Auth.js JWT **HttpOnly** cookies (`Secure` in production, `SameSite=lax`).
- Do not place access/refresh tokens in `localStorage`.
- JWT stores `principalId` only; permissions are loaded from `RoleBinding` on each authorization check.
