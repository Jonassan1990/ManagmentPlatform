import Link from "next/link";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";
import { isDevAuthEnabled, getEnv } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let principalAvailable = false;
  let authHint: string | null = null;
  let metrics = {
    activeInitiatives: 0,
    demand: 0,
    requirements: 0,
    preStudy: 0,
    needsAttention: 0,
    readyForGovernance: 0,
  };
  let orgCount = 0;

  try {
    const env = getEnv();
    const { authz, organization, initiative } = createServices();
    const principal = await authz.resolveCurrentPrincipal();
    principalAvailable = Boolean(principal);
    if (principal) {
      const orgs = await organization.listOrganizations(principal);
      orgCount = orgs.length;
      metrics = await initiative.getOverviewMetrics(principal);
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
        description="Management attention across organization setup and initiative lifecycle."
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
          description="Configure DEV auth for local work, or connect an OIDC provider for production."
        />
      ) : orgCount === 0 ? (
        <EmptyState
          title="No organization has been configured yet"
          description="Create the first organization before capturing initiatives."
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
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Active initiatives", value: metrics.activeInitiatives },
              { label: "In Demand", value: metrics.demand },
              { label: "In Requirements", value: metrics.requirements },
              { label: "In Pre-study", value: metrics.preStudy },
              { label: "Needs attention", value: metrics.needsAttention },
              {
                label: "Ready for governance review",
                value: metrics.readyForGovernance,
              },
            ].map((item) => (
              <Panel key={item.label}>
                <p className="text-sm text-[var(--muted)]">{item.label}</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">
                  {item.value}
                </p>
              </Panel>
            ))}
          </div>
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Metrics are derived from live database records. Zero is a valid state.
              </p>
              <Link
                href="/initiatives"
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Open initiatives
              </Link>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
