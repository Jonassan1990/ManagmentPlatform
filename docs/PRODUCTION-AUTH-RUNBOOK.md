# Production Auth Runbook

Operator guide for wiring OIDC and first-time platform bootstrap.

## Prerequisites

- Managed PostgreSQL with `DATABASE_URL` (pooled OK for runtime) and `DIRECT_URL` (direct for migrations)
- Auth.js secrets and OIDC client registered at your IdP
- Application URL (`APP_URL` / `AUTH_URL`) matching the deployment host

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Runtime DB (may be pooled) |
| `DIRECT_URL` | Yes when schema declares it | Non-pooled URL for `prisma migrate` |
| `AUTH_SECRET` | Yes when OIDC enabled | `openssl rand -base64 32` |
| `AUTH_URL` or `APP_URL` | Yes | Public base URL, e.g. `https://app.example.com` |
| `OIDC_ISSUER` | Yes for SSO | Issuer URL (discovery) |
| `OIDC_CLIENT_ID` | Yes for SSO | |
| `OIDC_CLIENT_SECRET` | Yes for SSO | |
| `OIDC_SCOPES` | Optional | Default `openid profile email` |
| `BOOTSTRAP_SETUP_TOKEN` | For first admin | Min 16 chars; one-time consume |
| `ALLOW_DEV_AUTH` | Must be unset/false | Production rejects `true` |
| `DEV_AUTH_*` | Must be unset | Not for production |

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

## Failure modes

| Symptom | Likely cause |
|---|---|
| Login shows “authentication not configured” | Missing `OIDC_*` env |
| Sign-in error redirect to `/login?error=` | IdP misconfig / redirect URI / secret |
| Signed in but cannot mutate | No role bindings — complete bootstrap or ask admin |
| Bootstrap “already consumed” | Another principal already used the token |
| `ALLOW_DEV_AUTH` env error on boot | Flag set while `NODE_ENV=production` |

## Session security

- Sessions use Auth.js JWT **HttpOnly** cookies (`Secure` in production, `SameSite=lax`).
- Do not place access/refresh tokens in `localStorage`.
- JWT stores `principalId` only; permissions are loaded from `RoleBinding` on each authorization check.
