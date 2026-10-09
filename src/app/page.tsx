import Link from "next/link";
import { HomeAttentionPanel } from "@/components/home/home-attention";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import {
  buildHomeFooterLinks,
  buildHomeQuickLinks,
  selectAuthorizedPiEntry,
  type AuthorizedPiEntry,
} from "@/modules/navigation/home-experience";
import { resolveShellNavContext } from "@/modules/navigation/resolve-shell-nav";
import type { ShellNavCapabilities } from "@/modules/navigation/types";
import type {
  DeliveryHealthAttentionResult,
  DeliveryHealthSummary,
} from "@/modules/portfolio/domain/types";
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
        <Link
          href={href}
          className="block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
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

function QuickLinkChip({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white"
          : "rounded-md border border-[var(--line)] px-3 py-2 text-sm"
      }
    >
      {label}
    </Link>
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
  let organizationId: string | null = null;
  let capabilities: ShellNavCapabilities = {
    canViewApprovals: false,
    canViewDecisions: false,
    canManageGovernancePolicy: false,
    canManageAccess: false,
    canViewPi: false,
    canCreatePi: false,
    canViewInitiatives: false,
    canCreateInitiative: false,
  };
  let piEntry: AuthorizedPiEntry | null = null;
  let healthSummary: DeliveryHealthSummary | null = null;
  let healthAttention: DeliveryHealthAttentionResult | null = null;
  let healthError: string | null = null;

  try {
    const env = getEnv();
    const {
      authz,
      organization,
      initiative,
      planning,
      portfolio,
    } = createServices();
    const principal = await authz.resolveCurrentPrincipal();
    principalAvailable = Boolean(principal);
    if (principal) {
      const orgs = await organization.listOrganizations(principal);
      orgCount = orgs.length;
      const orgIds = orgs.map((o) => o.id);
      const navCtx = await resolveShellNavContext(authz, principal, orgIds);
      organizationId = navCtx.organizationId;
      capabilities = navCtx.capabilities;

      metrics = await initiative.getOverviewMetrics(principal);
      piMetrics = await planning.getExecutivePiMetrics(principal);

      if (organizationId) {
        try {
          healthSummary = await portfolio.getDeliveryHealthSummary(principal, {
            organizationId,
          });
          healthAttention = await portfolio.listDeliveryHealthAttention(
            principal,
            {
              organizationId,
              sortBy: "classification",
              sortDir: "asc",
              page: 1,
              pageSize: 5,
            },
          );
        } catch (err) {
          healthError =
            err instanceof Error ? err.message : "Delivery health unavailable.";
        }

        if (capabilities.canViewPi) {
          // Prefer shell org, then other listable orgs, for an entry-worthy PI.
          const piOrgOrder = [
            organizationId,
            ...orgIds.filter((id) => id !== organizationId),
          ];
          for (const orgId of piOrgOrder) {
            try {
              const pis = await planning.listProgramIncrements(
                principal,
                orgId,
              );
              piEntry = selectAuthorizedPiEntry(
                pis.map((p) => ({
                  id: p.id,
                  status: p.status,
                  startDate: p.startDate,
                  referenceKey: p.referenceKey,
                  name: p.name,
                })),
              );
              if (piEntry) break;
            } catch {
              // Forbidden / empty for this org — try next.
            }
          }
        }
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

  const quickLinks = buildHomeQuickLinks({
    capabilities,
    organizationId,
    piEntry,
  });
  const footerLinks = buildHomeFooterLinks({
    capabilities,
    organizationId,
    piEntry,
  });

  return (
    <div>
      <Breadcrumbs items={[{ label: "Home" }]} />
      <PageHeader
        title="Home"
        description="Attention-first entry: capability-aware destinations, delivery health signals, and authorized PI shortcuts."
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
          {organizationId ? (
            <HomeAttentionPanel
              organizationId={organizationId}
              summary={healthSummary}
              attention={healthAttention}
              error={healthError}
              initiativeNeedsAttention={metrics.needsAttention}
              piNeedsAttention={piMetrics.piNeedsAttention}
              waitingApproval={metrics.waitingForApproval}
            />
          ) : null}

          {piEntry ? (
            <Panel className="border-[var(--color-primary)]/25 bg-[var(--color-primary-soft)]/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">
                    Continue PI planning
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Latest authorized {piEntry.status} PI:{" "}
                    <strong>{piEntry.referenceKey}</strong> — {piEntry.name}
                  </p>
                </div>
                <Link
                  href={piEntry.href}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Open {piEntry.referenceKey}
                </Link>
              </div>
            </Panel>
          ) : null}

          <Panel>
            <h2 className="mb-2 text-sm font-medium tracking-wide text-[var(--muted)]">
              Workflow destinations
            </h2>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
              Links reflect your shell capabilities. Destination pages still
              enforce authorization.
            </p>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map((link) => (
                <QuickLinkChip
                  key={link.id}
                  href={link.href}
                  label={link.label}
                  primary={link.primary}
                />
              ))}
            </div>
          </Panel>

          <MetricSection title="Lifecycle">
            <MetricTile
              label="Active initiatives"
              value={metrics.activeInitiatives}
              href={capabilities.canViewInitiatives ? "/initiatives" : undefined}
            />
            <MetricTile
              label="In Demand"
              value={metrics.demand}
              href={
                capabilities.canViewInitiatives
                  ? "/initiatives?stage=DEMAND"
                  : undefined
              }
            />
            <MetricTile
              label="In Requirements"
              value={metrics.requirements}
              href={
                capabilities.canViewInitiatives
                  ? "/initiatives?stage=REQUIREMENTS"
                  : undefined
              }
            />
            <MetricTile
              label="In Pre-study"
              value={metrics.preStudy}
              href={
                capabilities.canViewInitiatives
                  ? "/initiatives?stage=PRE_STUDY"
                  : undefined
              }
            />
            <MetricTile
              label="In PoC"
              value={metrics.poc}
              href={capabilities.canViewInitiatives ? "/initiatives" : undefined}
            />
            <MetricTile
              label="In Pilot"
              value={metrics.pilot}
              href={capabilities.canViewInitiatives ? "/initiatives" : undefined}
            />
            <MetricTile
              label="In Project"
              value={metrics.project}
              href={capabilities.canViewInitiatives ? "/initiatives" : undefined}
            />
            <MetricTile
              label="Needs attention"
              value={metrics.needsAttention}
              href={capabilities.canViewInitiatives ? "/initiatives" : undefined}
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
              href={capabilities.canViewApprovals ? "/approvals" : undefined}
            />
            <MetricTile
              label="Waiting for decision"
              value={metrics.waitingForDecision}
              href={capabilities.canViewDecisions ? "/decisions" : undefined}
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
              href={capabilities.canViewInitiatives ? "/initiatives" : undefined}
            />
            <MetricTile
              label="PoCs ready for decision"
              value={metrics.pocsReadyForDecision}
              href={capabilities.canViewDecisions ? "/decisions" : undefined}
            />
            <MetricTile
              label="Active Pilots"
              value={metrics.activePilots}
              href={capabilities.canViewInitiatives ? "/initiatives" : undefined}
            />
            <MetricTile
              label="Pilots ready for decision"
              value={metrics.pilotsReadyForDecision}
              href={capabilities.canViewDecisions ? "/decisions" : undefined}
            />
            <MetricTile
              label="Scale decisions waiting"
              value={metrics.scaleDecisionsWaiting}
              href={capabilities.canViewDecisions ? "/decisions" : undefined}
            />
            <MetricTile
              label="Projects"
              value={metrics.projects}
              href={capabilities.canViewInitiatives ? "/initiatives" : undefined}
            />
            <MetricTile
              label="Projects at risk"
              value={metrics.projectsAtRisk}
              href="/portfolio/health"
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
              href={capabilities.canViewPi ? "/pi" : undefined}
            />
            <MetricTile
              label="PIs in planning/draft"
              value={piMetrics.piPlanning}
              href={capabilities.canViewPi ? "/pi" : undefined}
            />
            <MetricTile
              label="PIs in review"
              value={piMetrics.piInReview}
              href={capabilities.canViewPi ? "/pi" : undefined}
            />
            <MetricTile
              label="PIs baselined"
              value={piMetrics.piBaselined}
              href={capabilities.canViewPi ? "/pi" : undefined}
            />
            <MetricTile
              label="PIs active"
              value={piMetrics.piActive}
              href={capabilities.canViewPi ? "/pi" : undefined}
            />
            <MetricTile
              label="PIs needing attention"
              value={piMetrics.piNeedsAttention}
              href={capabilities.canViewPi ? "/pi" : undefined}
            />
            <MetricTile
              label="PI blocker conflicts"
              value={piMetrics.piBlockerConflicts}
              href={capabilities.canViewPi ? "/pi" : undefined}
            />
          </MetricSection>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Metrics are derived from live database records. Zero is a valid
                state. Navigation visibility is not an access grant.
              </p>
              <div className="flex flex-wrap gap-2">
                {footerLinks.map((link) => (
                  <QuickLinkChip
                    key={`footer-${link.id}`}
                    href={link.href}
                    label={link.label}
                    primary={link.id === "initiatives" || link.id === "pi-entry"}
                  />
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
