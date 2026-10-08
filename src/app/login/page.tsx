import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";
import {
  getEnv,
  isDevAuthEnabled,
  isOidcConfigured,
  isTempAuthConfigured,
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
  const dev = isDevAuthEnabled(env);
  const callbackUrl = params.callbackUrl ?? "/";
  const hasProvider = oidc || tempAuth;

  return (
    <div className="mx-auto max-w-lg py-10">
      <Breadcrumbs items={[{ label: "Sign in" }]} />
      <PageHeader
        title="Sign in"
        description="Authenticate to access the Management Platform."
      />

      {params.error ? (
        <Panel className="mb-4 border-red-300 bg-red-50 text-red-900">
          <p className="text-sm">
            Sign-in failed. Try again or contact an administrator.
          </p>
        </Panel>
      ) : null}

      {!hasProvider ? (
        <EmptyState
          title="Sign-in is not available"
          description="Authentication is not configured for this environment. Contact an administrator. Application access remains closed until sign-in is enabled."
        />
      ) : null}

      {oidc ? (
        <Panel className={tempAuth ? "mb-4" : undefined}>
          <h2 className="mb-2 font-medium">Continue with SSO</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Sign in with your organization identity provider.
          </p>
          <SignInButton callbackUrl={callbackUrl} />
        </Panel>
      ) : null}

      {tempAuth ? (
        <Panel>
          <h2 className="mb-2 font-medium">
            {oidc ? "Temporary owner access" : "Sign in"}
          </h2>
          {oidc ? (
            <p className="mb-4 text-sm text-[var(--muted)]">
              Temporary credentials for platform recovery. Prefer SSO when
              available.
            </p>
          ) : (
            <p className="mb-4 text-sm text-[var(--muted)]">
              Enter your owner username and password.
            </p>
          )}
          <TempCredentialsForm callbackUrl={callbackUrl} />
        </Panel>
      ) : null}

      {dev ? (
        <Panel className="mt-4">
          <p className="text-sm text-[var(--muted)]">
            Development auth bridge is active. Browse the app without OIDC while{" "}
            <code className="text-xs">ALLOW_DEV_AUTH=true</code> and{" "}
            <code className="text-xs">NODE_ENV=development</code>.
          </p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Continue to overview
          </Link>
        </Panel>
      ) : null}
    </div>
  );
}
