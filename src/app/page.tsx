import Link from "next/link";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";
import { isDevAuthEnabled, getEnv } from "@/server/env";

export const dynamic = "force-dynamic";

function MetricTile({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">
        {value}
      </p>
    </>
  );

  return (
    <Panel>
      {href ? (
        <Link href={href} className="block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
          {body}
        </Link>
      ) : (
        body
      )}
    </Panel>
  );
}

function MetricSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export default async function HomePage() {
  let principalAvailable = false;
  let authHint: string | null = null;
  let metrics = {
    activeInitiatives: 0,
    demand: 0,
    requirements: 0,
    preStudy: 0,
    poc: 0,
    pilot: 0,
    project: 0,
    needsAttention: 0,
    readyForGovernance: 0,
    waitingForApproval: 0,
    waitingForDecision: 0,
    changesRequested: 0,
    activePocs: 0,
    pocsReadyForDecision: 0,
    outstandingConditions: 0,
    activePilots: 0,
    pilotsReadyForDecision: 0,
    scaleDecisionsWaiting: 0,
    projects: 0,
    projectsAtRisk: 0,
    outstandingScaleConditions: 0,
    upcomingMilestones: 0,
  };
  let piMetrics = {
    programIncrements: 0,
    piPlanning: 0,
    piInReview: 0,
    piBaselined: 0,
    piActive: 0,
    piNeedsAttention: 0,
    piBlockerConflicts: 0,
  };
  let orgCount = 0;
  let firstOrgId: string | null = null;

  try {
    const env = getEnv();
    const { authz, organization, initiative, planning } = createServices();
    const principal = await authz.resolveCurrentPrincipal();
    principalAvailable = Boolean(principal);
    if (principal) {
      const orgs = await organization.listOrganizations(principal);
      orgCount = orgs.length;
      firstOrgId = orgs[0]?.id ?? null;
      metrics = await initiative.getOverviewMetrics(principal);
      piMetrics = await planning.getExecutivePiMetrics(principal);
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
        description="Management attention across organization setup, initiative lifecycle, governance, pilots, projects, and PI planning."
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
        <div className="space-y-6">
          <MetricSection title="Lifecycle">
            <MetricTile
              label="Active initiatives"
              value={metrics.activeInitiatives}
              href="/initiatives"
            />
            <MetricTile
              label="In Demand"
              value={metrics.demand}
              href="/initiatives?stage=DEMAND"
            />
            <MetricTile
              label="In Requirements"
              value={metrics.requirements}
              href="/initiatives?stage=REQUIREMENTS"
            />
            <MetricTile
              label="In Pre-study"
              value={metrics.preStudy}
              href="/initiatives?stage=PRE_STUDY"
            />
            <MetricTile
              label="In PoC"
              value={metrics.poc}
              href="/initiatives"
            />
            <MetricTile
              label="In Pilot"
              value={metrics.pilot}
              href="/initiatives"
            />
            <MetricTile
              label="In Project"
              value={metrics.project}
              href="/initiatives"
            />
            <MetricTile
              label="Needs attention"
              value={metrics.needsAttention}
              href="/initiatives"
            />
          </MetricSection>

          <MetricSection title="Governance">
            <MetricTile
              label="Ready for governance review"
              value={metrics.readyForGovernance}
            />
            <MetricTile
              label="Waiting for approval"
              value={metrics.waitingForApproval}
              href="/approvals"
            />
            <MetricTile
              label="Waiting for decision"
              value={metrics.waitingForDecision}
              href="/decisions"
            />
            <MetricTile
              label="Changes requested"
              value={metrics.changesRequested}
            />
            <MetricTile
              label="Outstanding conditions"
              value={metrics.outstandingConditions}
            />
            <MetricTile
              label="Outstanding scale conditions"
              value={metrics.outstandingScaleConditions}
            />
          </MetricSection>

          <MetricSection title="Delivery">
            <MetricTile
              label="Active PoCs"
              value={metrics.activePocs}
              href="/initiatives"
            />
            <MetricTile
              label="PoCs ready for decision"
              value={metrics.pocsReadyForDecision}
              href="/decisions"
            />
            <MetricTile
              label="Active Pilots"
              value={metrics.activePilots}
              href="/initiatives"
            />
            <MetricTile
              label="Pilots ready for decision"
              value={metrics.pilotsReadyForDecision}
              href="/decisions"
            />
            <MetricTile
              label="Scale decisions waiting"
              value={metrics.scaleDecisionsWaiting}
              href="/decisions"
            />
            <MetricTile
              label="Projects"
              value={metrics.projects}
              href="/initiatives"
            />
            <MetricTile
              label="Projects at risk"
              value={metrics.projectsAtRisk}
              href="/initiatives"
            />
            <MetricTile
              label="Upcoming milestones (14d)"
              value={metrics.upcomingMilestones}
            />
          </MetricSection>

          <MetricSection title="PI Planning">
            <MetricTile
              label="Program Increments"
              value={piMetrics.programIncrements}
              href="/pi"
            />
            <MetricTile
              label="PIs in planning/draft"
              value={piMetrics.piPlanning}
              href="/pi"
            />
            <MetricTile
              label="PIs in review"
              value={piMetrics.piInReview}
              href="/pi"
            />
            <MetricTile
              label="PIs baselined"
              value={piMetrics.piBaselined}
              href="/pi"
            />
            <MetricTile
              label="PIs active"
              value={piMetrics.piActive}
              href="/pi"
            />
            <MetricTile
              label="PIs needing attention"
              value={piMetrics.piNeedsAttention}
              href="/pi"
            />
            <MetricTile
              label="PI blocker conflicts"
              value={piMetrics.piBlockerConflicts}
              href="/pi"
            />
          </MetricSection>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Metrics are derived from live database records. Zero is a valid state.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/approvals"
                  className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
                >
                  Approvals
                </Link>
                <Link
                  href="/decisions"
                  className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
                >
                  Decisions
                </Link>
                {firstOrgId ? (
                  <Link
                    href={`/organization/${firstOrgId}/governance-policy`}
                    className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
                  >
                    Governance policy
                  </Link>
                ) : null}
                <Link
                  href="/pi"
                  className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
                >
                  PI Planning
                </Link>
                <Link
                  href="/initiatives"
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Open initiatives
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
