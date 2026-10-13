import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";
import {
  getEnv,
  isDevAuthEnabled,
  isOidcConfigured,
  isTempAuthConfigured,
  resolveAuthSecret,
} from "@/server/env";
import { SignInButton } from "./sign-in-button";
import { TempCredentialsForm } from "./temp-credentials-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { authz } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (principal) {
    redirect("/");
  }

  const env = getEnv();
  const oidc = isOidcConfigured();
  const tempAuth = isTempAuthConfigured();
  const passwordLogin = tempAuth || Boolean(resolveAuthSecret());
  const dev = isDevAuthEnabled(env);
  const callbackUrl = params.callbackUrl ?? "/";
  const hasProvider = oidc || passwordLogin;

  return (
    <div className="mp-login-stage">
      <div className="mp-login-aurora" aria-hidden />
      <div className="mp-login-grid" aria-hidden />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-10">
        <section className="mp-rise space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9ad9c8]">
            Scania Tegel · Resource Ops
          </p>
          <h1 className="mp-login-brand">
            <span className="mp-login-brand-accent">Management</span>
            <br />
            Platform
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            Govern initiatives, plan capacity, and steer delivery across plants
            and digital teams — one operational cockpit for Nordic Demo
            Manufacturing.
          </p>
          <ul className="mp-stagger grid max-w-lg gap-2 text-sm text-white/70 sm:grid-cols-3">
            <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
              Portfolio clarity
            </li>
            <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
              PI capacity
            </li>
            <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
              Access & roles
            </li>
          </ul>
        </section>

        <section className="mp-soft-scale">
          <div className="mp-login-panel rounded-xl p-6 sm:p-7">
            <p className="ds-eyebrow text-[10px]">Secure access</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              Sign in
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Authenticate to open your organization workspace.
            </p>

            {params.error ? (
              <Panel className="mt-4 border-red-300 bg-red-50 text-red-900">
                <p className="text-sm">
                  Sign-in failed. Try again or contact an administrator.
                </p>
              </Panel>
            ) : null}

            {!hasProvider ? (
              <div className="mt-4">
                <EmptyState
                  title="Sign-in is not available"
                  description="Authentication is not configured for this environment. Contact an administrator."
                />
              </div>
            ) : null}

            {oidc ? (
              <div className={`mt-5 ${tempAuth ? "mb-4" : ""}`}>
                <h3 className="mb-2 text-sm font-medium">Continue with SSO</h3>
                <p className="mb-3 text-sm text-[var(--muted)]">
                  Sign in with your organization identity provider.
                </p>
                <SignInButton callbackUrl={callbackUrl} />
              </div>
            ) : null}

            {passwordLogin ? (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-medium">
                  {oidc ? "Username and password" : "Credentials"}
                </h3>
                <p className="mb-3 text-sm text-[var(--muted)]">
                  {oidc
                    ? "Temporary owner or local test users. Prefer SSO when available."
                    : "Enter username and password (owner or local test user)."}
                </p>
                <TempCredentialsForm callbackUrl={callbackUrl} />
              </div>
            ) : null}

            {dev ? (
              <div className="mt-5 rounded-md border border-dashed border-[var(--line)] p-3">
                <p className="text-sm text-[var(--muted)]">
                  Development auth bridge is active.
                </p>
                <Link
                  href="/"
                  className="mt-2 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  Continue to overview
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
