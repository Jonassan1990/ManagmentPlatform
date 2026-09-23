import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";
import {
  getEnv,
  isDevAuthEnabled,
  isOidcConfigured,
} from "@/server/env";
import { SignInButton } from "./sign-in-button";

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
  const dev = isDevAuthEnabled(env);

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
            Sign-in failed{params.error ? ` (${params.error})` : ""}. Try again
            or contact an administrator.
          </p>
        </Panel>
      ) : null}

      {oidc ? (
        <Panel>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Continue with your organization identity provider.
          </p>
          <SignInButton callbackUrl={params.callbackUrl ?? "/"} />
        </Panel>
      ) : (
        <EmptyState
          title="Authentication not configured"
          description="OIDC is not configured for this environment. Set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and AUTH_SECRET. Mutating routes remain fail-closed."
        />
      )}

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
