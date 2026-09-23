import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createOrganizationService } from "@/server/container";
import { isDevAuthEnabled, getEnv } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let principalAvailable = false;
  let orgCount = 0;
  let authHint: string | null = null;

  try {
    const env = getEnv();
    const { authz, organization } = createOrganizationService();
    const principal = await authz.resolveCurrentPrincipal();
    principalAvailable = Boolean(principal);
    if (principal) {
      const orgs = await organization.listOrganizations(principal);
      orgCount = orgs.length;
      if (orgCount === 1) {
        redirect(`/organization/${orgs[0].id}`);
      }
      if (orgCount > 1) {
        redirect("/organization");
      }
    } else if (env.NODE_ENV === "development" && !isDevAuthEnabled(env)) {
      authHint =
        "DEV auth is not configured. Set ALLOW_DEV_AUTH=true and DEV_AUTH_PRINCIPAL_ID (UUID) in .env.";
    } else if (env.NODE_ENV === "production") {
      authHint =
        "Authentication provider is not connected yet. Production fails closed without a principal.";
    }
  } catch (error) {
    authHint =
      error instanceof Error
        ? error.message
        : "Application configuration is incomplete.";
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Overview" }]} />
      <PageHeader
        title="Overview"
        description="Phase 1 delivers the technical foundation and the Organization hierarchy vertical slice."
      />

      {authHint ? (
        <Panel className="mb-4">
          <h2 className="font-medium">Authentication status</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{authHint}</p>
        </Panel>
      ) : null}

      {!principalAvailable ? (
        <EmptyState
          title="No authenticated principal"
          description="The application is running, but no identity is available. Configure DEV auth for local work, or connect an OIDC provider for production."
        />
      ) : orgCount === 0 ? (
        <EmptyState
          title="No organization has been configured yet"
          description="A fresh installation starts empty by design. Create the first organization to begin building sections, departments, teams, and resources."
          action={
            <Link
              href="/organization/setup"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Set up organization
            </Link>
          }
        />
      ) : (
        <Panel>
          <p className="text-sm text-[var(--muted)]">
            Organizations are available. Continue in the Organization workspace.
          </p>
          <Link
            href="/organization"
            className="mt-3 inline-block text-sm text-[var(--accent)] underline"
          >
            Open Organization
          </Link>
        </Panel>
      )}
    </div>
  );
}
