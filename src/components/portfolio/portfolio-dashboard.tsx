import Link from "next/link";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { Alert } from "@/components/ui/alert";
import { EmptyState, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  DeliveryHealthAttentionResult,
  DeliveryHealthSummary,
  PortfolioSnapshot,
} from "@/modules/portfolio/domain/types";
import {
  appendReturnContext,
} from "@/modules/navigation/return-context";
import {
  CAPACITY_BAND_LABELS,
  DistributionBar,
  MetricFigure,
  PROJECT_STATUS_LABELS,
  STAGE_LABELS,
  UnavailableNotice,
} from "./metric";

export type PortfolioOrgOption = { id: string; name: string };
export type PortfolioDeptOption = { id: string; name: string };

function portfolioReturn(
  organizationId: string,
  departmentId?: string | null,
) {
  return {
    from: "portfolio" as const,
    organizationId,
    departmentId: departmentId ?? null,
  };
}

function KpiCard({
  label,
  children,
  hint,
  href,
  tone = "default",
  actionLabel,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: "default" | "attention" | "critical" | "teal";
  actionLabel?: string;
}) {
  const accent =
    tone === "critical"
      ? "bg-[var(--color-error)]"
      : tone === "attention"
        ? "bg-[var(--color-warning)]"
        : tone === "teal"
          ? "bg-[#087f78]"
          : "bg-[var(--color-primary)]";

  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <div className="mt-1">{children}</div>
      {hint ? (
        <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
      {href && actionLabel ? (
        <p className="mt-2 text-xs font-medium text-[var(--accent)]">
          {actionLabel} →
        </p>
      ) : null}
    </>
  );

  const className = `relative h-full overflow-hidden border-[var(--line)] pl-4 ${
    tone === "attention" || tone === "critical"
      ? "bg-[var(--surface)]"
      : ""
  }`;

  if (href) {
    return (
      <Panel className={className}>
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${accent}`}
        />
        <Link
          href={href}
          className="block min-h-11 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {body}
        </Link>
      </Panel>
    );
  }
  return (
    <Panel className={className}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      {body}
    </Panel>
  );
}

function SectionHeading({
  id,
  level,
  title,
  description,
  badge,
}: {
  id: string;
  level: string;
  title: string;
  description: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
          {level}
        </p>
        <h2
          id={id}
          className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
        >
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          {description}
        </p>
      </div>
      {badge}
    </div>
  );
}

function ScopeBanner({
  snapshot,
  organizationName,
  departmentName,
  departmentId,
}: {
  snapshot: PortfolioSnapshot;
  organizationName: string;
  departmentName: string | null;
  departmentId?: string | null;
}) {
  const orgId = snapshot.scope.organizationId;
  const ret = portfolioReturn(orgId, departmentId);
  const scopeText =
    snapshot.scope.mode === "organization"
      ? departmentName
        ? `Organization-wide permission, filtered to department “${departmentName}”.`
        : "Organization-wide portfolio scope."
      : departmentName
        ? `Department scope: “${departmentName}” (${snapshot.scope.departmentIds.length} visible department${snapshot.scope.departmentIds.length === 1 ? "" : "s"}).`
        : `Department-scoped view (${snapshot.scope.departmentIds.length} visible department${snapshot.scope.departmentIds.length === 1 ? "" : "s"}). Server-side aggregation only includes these departments.`;

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">Scope context</p>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            {organizationName}
            {departmentName ? ` · ${departmentName}` : ""}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{scopeText}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            As of {new Date(snapshot.asOf).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={appendReturnContext(
              `/portfolio/explorer?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}`,
              ret,
            )}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Open explorer
          </Link>
          <Link
            href={appendReturnContext(
              `/portfolio/capacity?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}`,
              ret,
            )}
            className="inline-flex min-h-11 items-center rounded-md bg-[#087f78] px-3 py-1.5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f78]"
          >
            PI &amp; Capacity
          </Link>
          <Link
            href={appendReturnContext(
              `/portfolio/health?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}`,
              ret,
            )}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Delivery health
          </Link>
        </div>
      </div>
    </Panel>
  );
}

export function PortfolioScopeControls({
  organizations,
  departments,
  organizationId,
  departmentId,
  healthFocus,
}: {
  organizations: PortfolioOrgOption[];
  departments: PortfolioDeptOption[];
  organizationId: string;
  departmentId?: string;
  healthFocus?: string | null;
}) {
  return (
    <Panel>
      <h2 className="font-medium">Portfolio scope</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Changing organization or department reloads a server-scoped snapshot.
        Metrics are never filtered only in the browser.
      </p>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Organization</span>
          <select
            name="organizationId"
            defaultValue={organizationId}
            className="mt-1 block min-h-10 min-w-[12rem] rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Department</span>
          <select
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className="mt-1 block min-h-10 min-w-[12rem] rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="">All visible departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>
        {healthFocus ? (
          <input type="hidden" name="healthFocus" value={healthFocus} />
        ) : null}
        <button
          type="submit"
          className="min-h-10 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Apply scope
        </button>
      </form>
    </Panel>
  );
}

function capacityStatusBadge(
  capacity: PortfolioSnapshot["piCapacity"],
): {
  status: "blocked" | "at-risk" | "completed" | "unavailable" | "in-progress";
  label: string;
} {
  if (!capacity.available) {
    return { status: "unavailable", label: "Capacity unavailable" };
  }
  if (capacity.value.overloadedTeamIterations > 0) {
    return {
      status: "blocked",
      label: `${capacity.value.overloadedTeamIterations} overloaded`,
    };
  }
  if (capacity.value.nearCapacityTeamIterations > 0) {
    return {
      status: "at-risk",
      label: `${capacity.value.nearCapacityTeamIterations} near capacity`,
    };
  }
  if (capacity.value.piCountConsidered === 0) {
    return { status: "unavailable", label: "No PIs in scope" };
  }
  return { status: "completed", label: "Within capacity" };
}

export function PortfolioDashboardView({
  snapshot,
  organizationName,
  departmentName,
  departmentId,
  healthSummary,
  healthAttention,
  healthFocus,
  healthError,
  canCreateInitiative = false,
}: {
  snapshot: PortfolioSnapshot;
  organizationName: string;
  departmentName: string | null;
  departmentId?: string | null;
  healthSummary?: DeliveryHealthSummary | null;
  healthAttention?: DeliveryHealthAttentionResult | null;
  healthFocus?: string | null;
  healthError?: string | null;
  /** When false, hide create CTA for viewers / read-only principals. */
  canCreateInitiative?: boolean;
}) {
  const initiatives = snapshot.initiatives;
  const projects = snapshot.projects;
  const delayed = snapshot.delayedProjects;
  const issues = snapshot.issues;
  const governance = snapshot.governance;
  const dependencies = snapshot.dependencies;
  const experimentation = snapshot.experimentation;
  const capacity = snapshot.piCapacity;
  const ownership = snapshot.ownership;
  const orgId = snapshot.scope.organizationId;
  const ret = portfolioReturn(orgId, departmentId);

  const initiativeTotal = initiatives.available ? initiatives.value.total : 0;
  const projectActive = projects.available ? projects.value.active : 0;
  const delayedCount = delayed.available ? delayed.value.delayedProjects : 0;
  const blockerCount = issues.available ? issues.value.activeBlockers : 0;
  const criticalIssues = issues.available ? issues.value.criticalOpenIssues : 0;
  const criticalDeps = dependencies.available
    ? dependencies.value.criticalOpenDependencies
    : 0;
  const pendingGov = governance.available
    ? governance.value.waitingForApproval +
      governance.value.waitingForDecision
    : 0;
  const healthAttentionCount = healthSummary?.attentionCount ?? 0;
  const capacityBadge = capacityStatusBadge(capacity);

  const attentionSignalCount =
    healthAttentionCount +
    (governance.available ? pendingGov : 0) +
    criticalDeps;

  const isEmptyPortfolio =
    initiatives.available &&
    initiatives.value.total === 0 &&
    projects.available &&
    projects.value.active === 0 &&
    projects.value.onHold === 0 &&
    projects.value.completed === 0 &&
    projects.value.cancelled === 0;

  const blockedHref = `/portfolio/health?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}&healthFocus=BLOCKED`;
  const atRiskHref = `/portfolio/health?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}&healthFocus=AT_RISK`;
  const attentionHref = `/portfolio/health?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}&healthFocus=ATTENTION`;
  const healthHubHref = `/portfolio/health?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}`;
  const approvalsHref = appendReturnContext("/approvals", ret);
  const decisionsHref = appendReturnContext("/decisions", ret);
  const initiativesHref = appendReturnContext("/initiatives", ret);
  const explorerProjectsHref = appendReturnContext(
    `/portfolio/explorer?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}&kind=PROJECT`,
    ret,
  );
  const piHref = appendReturnContext("/pi", ret);
  const capacityHref = appendReturnContext(
    `/portfolio/capacity?organizationId=${orgId}${departmentId ? `&departmentId=${departmentId}` : ""}`,
    ret,
  );

  return (
    <div className="space-y-8">
      <ScopeBanner
        snapshot={snapshot}
        organizationName={organizationName}
        departmentName={departmentName}
        departmentId={departmentId}
      />

      {/* ——— Level 1: Executive Summary ——— */}
      <section aria-labelledby="portfolio-executive-summary">
        <SectionHeading
          id="portfolio-executive-summary"
          level="Level 1"
          title="Executive summary"
          description="Highest-signal KPIs for this authorized scope. Counts come from the portfolio snapshot — not browser recalculation."
        />
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          data-testid="portfolio-executive-kpis"
        >
          <KpiCard
            label="Active initiatives"
            href={initiativesHref}
            actionLabel="Browse initiatives"
            hint="Non-archived in scope"
            tone="teal"
          >
            <MetricFigure
              metric={
                initiatives.available
                  ? { available: true, value: initiatives.value.total }
                  : initiatives
              }
            />
          </KpiCard>
          <KpiCard
            label="Active projects"
            href={explorerProjectsHref}
            actionLabel="Open in Explorer"
            hint="Status ACTIVE — find and inspect work"
          >
            <MetricFigure
              metric={
                projects.available
                  ? { available: true, value: projects.value.active }
                  : projects
              }
            />
          </KpiCard>
          <KpiCard
            label="Delayed projects"
            tone={delayedCount > 0 ? "attention" : "default"}
            href={attentionHref}
            actionLabel="Review delivery attention"
            hint="Missed milestone or planned end past as-of"
          >
            <MetricFigure
              metric={
                delayed.available
                  ? { available: true, value: delayed.value.delayedProjects }
                  : delayed
              }
            />
          </KpiCard>
          <KpiCard
            label="Blocked projects"
            tone={
              (healthSummary?.counts.BLOCKED ?? blockerCount) > 0
                ? "critical"
                : "default"
            }
            href={blockedHref}
            actionLabel="Review blocked"
            hint={
              healthSummary
                ? "Delivery-health BLOCKED classification"
                : "Active blocker issues (snapshot)"
            }
          >
            {healthSummary ? (
              <p className="font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums text-[var(--ink)]">
                {healthSummary.counts.BLOCKED}
              </p>
            ) : (
              <MetricFigure
                metric={
                  issues.available
                    ? { available: true, value: issues.value.activeBlockers }
                    : issues
                }
              />
            )}
          </KpiCard>
          <KpiCard
            label="Pending governance"
            tone={pendingGov > 0 ? "attention" : "default"}
            href={approvalsHref}
            actionLabel="Open approvals"
            hint={
              governance.available
                ? `Approval ${governance.value.waitingForApproval} · Decision ${governance.value.waitingForDecision}`
                : undefined
            }
          >
            <MetricFigure
              metric={
                governance.available
                  ? { available: true, value: pendingGov }
                  : governance
              }
            />
          </KpiCard>
          <KpiCard
            label="PI capacity status"
            href={capacity.available ? capacityHref : piHref}
            actionLabel={
              capacity.available
                ? "Open Resource Planning"
                : "Open PI Planning"
            }
            hint={
              capacity.available
                ? `${capacity.value.piCountConsidered} PI(s) considered`
                : capacity.reason
            }
            tone={
              capacityBadge.status === "blocked"
                ? "critical"
                : capacityBadge.status === "at-risk"
                  ? "attention"
                  : "default"
            }
          >
            <div className="mt-1">
              <StatusBadge
                status={capacityBadge.status}
                label={capacityBadge.label}
              />
            </div>
          </KpiCard>
        </div>
      </section>

      {isEmptyPortfolio ? (
        <EmptyState
          title="No portfolio activity in this scope"
          description="There are no non-archived initiatives or projects visible under your current organization and department scope."
          action={
            canCreateInitiative ? (
              <Link
                href="/initiatives/new"
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Create an initiative
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {/* ——— Level 2: Management Attention ——— */}
      <section aria-labelledby="portfolio-management-attention">
        <SectionHeading
          id="portfolio-management-attention"
          level="Level 2"
          title="Management attention"
          description="Prioritized follow-ups from delivery health and snapshot governance signals. Each item links to a real destination."
          badge={
            <StatusBadge
              status={attentionSignalCount > 0 ? "at-risk" : "completed"}
              label={
                attentionSignalCount > 0
                  ? `${attentionSignalCount} attention signals`
                  : "No urgent signals"
              }
            />
          }
        />

        {healthError ? (
          <Alert tone="error" className="mb-4">
            Delivery health could not be loaded — {healthError}. Snapshot
            attention cards below remain available.
          </Alert>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AttentionActionCard
            title="Blocked projects"
            count={healthSummary?.counts.BLOCKED ?? null}
            unavailable={!healthSummary}
            detail="Projects classified BLOCKED by delivery health."
            href={blockedHref}
            action="Review blocked"
            tone="critical"
          />
          <AttentionActionCard
            title="At-risk projects"
            count={healthSummary?.counts.AT_RISK ?? null}
            unavailable={!healthSummary}
            detail="Projects classified AT_RISK — act before they block."
            href={atRiskHref}
            action="Review at risk"
            tone="attention"
          />
          <AttentionActionCard
            title="Pending approvals"
            count={
              governance.available
                ? governance.value.waitingForApproval
                : null
            }
            unavailable={!governance.available}
            detail="Submissions waiting for required approvals."
            href={approvalsHref}
            action="Open approvals inbox"
            tone={
              governance.available && governance.value.waitingForApproval > 0
                ? "attention"
                : "default"
            }
          />
          <AttentionActionCard
            title="Pending decisions"
            count={
              governance.available
                ? governance.value.waitingForDecision
                : null
            }
            unavailable={!governance.available}
            detail="Approvals complete — formal decision still required."
            href={decisionsHref}
            action="Open decisions"
            tone={
              governance.available && governance.value.waitingForDecision > 0
                ? "attention"
                : "default"
            }
          />
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <AttentionActionCard
            title="Critical dependencies"
            count={criticalDeps}
            unavailable={!dependencies.available}
            detail={
              dependencies.available
                ? `${dependencies.value.openDependencies} open dependencies in scope`
                : dependencies.reason
            }
            href={capacityHref}
            action="Open Capacity coordination"
            tone={criticalDeps > 0 ? "attention" : "default"}
          />
          <AttentionActionCard
            title="Delayed / milestone slips"
            count={delayedCount}
            unavailable={!delayed.available}
            detail="Missed milestone or planned end before as-of (snapshot definition)."
            href={healthHubHref}
            action="Open delivery health"
            tone={delayedCount > 0 ? "attention" : "default"}
          />
        </div>

        {criticalIssues > 0 ? (
          <Alert tone="warning" className="mb-4">
            {criticalIssues} critical open issue
            {criticalIssues === 1 ? "" : "s"} in scope
            {blockerCount > 0
              ? ` (${blockerCount} active blocker${blockerCount === 1 ? "" : "s"})`
              : ""}
            . Open Delivery Health for attention rows — issue IDs are not
            inventable from aggregates.
          </Alert>
        ) : null}

        {/* M4E-D: summary only — full list lives on /portfolio/health hub */}
        <Panel data-testid="portfolio-health-summary">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium">Delivery health summary</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                What needs attention — open the Delivery Health hub for the full
                list and Explain. Portfolio does not duplicate that workspace.
              </p>
            </div>
            <Link
              href={healthHubHref}
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Open delivery health
            </Link>
          </div>
          {healthSummary ? (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <StatusBadge
                status="blocked"
                label={`Blocked ${healthSummary.counts.BLOCKED}`}
                size="compact"
              />
              <StatusBadge
                status="at-risk"
                label={`At risk ${healthSummary.counts.AT_RISK}`}
                size="compact"
              />
              <StatusBadge
                status="completed"
                label={`On track ${healthSummary.counts.ON_TRACK}`}
                size="compact"
              />
              <span className="text-[var(--muted)]">
                Attention: {healthSummary.attentionCount}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Delivery-health summary unavailable
              {healthError ? ` — ${healthError}` : "."}
            </p>
          )}
          {healthAttention && healthAttention.rows.length > 0 ? (
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {healthAttention.rows.slice(0, 5).map((row) => (
                <li
                  key={row.projectId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <Link
                    href={appendReturnContext(row.href, ret)}
                    className="font-medium text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    {row.referenceKey} · {row.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={
                        row.classification === "BLOCKED"
                          ? "blocked"
                          : row.classification === "AT_RISK"
                            ? "at-risk"
                            : "pending"
                      }
                      label={row.classification.replace("_", " ")}
                      size="compact"
                    />
                    <Link
                      href={`/portfolio/health?organizationId=${orgId}&projectId=${row.projectId}`}
                      className="inline-flex min-h-11 items-center text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    >
                      Explain
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : healthAttention ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No blocked or at-risk projects in this scope.
            </p>
          ) : null}
          {healthFocus ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Health focus “{healthFocus}” is applied on the Delivery Health hub.
              <Link
                href={
                  healthFocus === "BLOCKED"
                    ? blockedHref
                    : healthFocus === "AT_RISK"
                      ? atRiskHref
                      : attentionHref
                }
                className="ml-1 text-[var(--accent)] underline"
              >
                Open filtered hub
              </Link>
            </p>
          ) : null}
        </Panel>
      </section>

      {/* ——— Level 3: Portfolio Insights (progressive) ——— */}
      <section aria-labelledby="portfolio-insights">
        <SectionHeading
          id="portfolio-insights"
          level="Level 3"
          title="Portfolio insights"
          description="Distributions and capacity preview. Does not replace Explorer or the full Capacity workspace."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <h3 className="font-medium">Initiative lifecycle</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Distribution by current stage for non-archived initiatives.
            </p>
            {!initiatives.available ? (
              <div className="mt-4">
                <UnavailableNotice reason={initiatives.reason} />
              </div>
            ) : initiativeTotal === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                No initiatives in scope (count 0).
              </p>
            ) : (
              <div className="mt-4 space-y-1">
                {(
                  Object.keys(STAGE_LABELS) as Array<keyof typeof STAGE_LABELS>
                ).map((stage) => (
                  <DistributionBar
                    key={stage}
                    label={STAGE_LABELS[stage]}
                    value={
                      initiatives.value.byStage[
                        stage as keyof typeof initiatives.value.byStage
                      ]
                    }
                    max={initiativeTotal}
                    href={
                      stage === "DEMAND" ||
                      stage === "REQUIREMENTS" ||
                      stage === "PRE_STUDY" ||
                      stage === "POC" ||
                      stage === "PILOT" ||
                      stage === "PROJECT"
                        ? `/initiatives?stage=${stage}`
                        : "/initiatives"
                    }
                  />
                ))}
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Status — Active {initiatives.value.byStatus.ACTIVE}, On hold{" "}
                  {initiatives.value.byStatus.ON_HOLD}, Cancelled{" "}
                  {initiatives.value.byStatus.CANCELLED}
                </p>
              </div>
            )}
          </Panel>

          <Panel>
            <h3 className="font-medium">Project status</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Delivery status counts (archived projects excluded).
            </p>
            {!projects.available ? (
              <div className="mt-4">
                <UnavailableNotice reason={projects.reason} />
              </div>
            ) : projectActive +
                projects.value.onHold +
                projects.value.completed +
                projects.value.cancelled ===
              0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                No projects in scope (count 0).
              </p>
            ) : (
              <div className="mt-4 space-y-1">
                {(
                  ["active", "onHold", "completed", "cancelled"] as const
                ).map((key) => {
                  const total =
                    projects.value.active +
                    projects.value.onHold +
                    projects.value.completed +
                    projects.value.cancelled;
                  return (
                    <DistributionBar
                      key={key}
                      label={PROJECT_STATUS_LABELS[key]}
                      value={projects.value[key]}
                      max={total}
                      href={initiativesHref}
                    />
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel>
            <h3 className="font-medium">PoC / Pilot summary</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Active experiments (draft through evaluation).
            </p>
            {!experimentation.available ? (
              <div className="mt-4">
                <UnavailableNotice reason={experimentation.reason} />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md border border-[var(--line)] p-3">
                  <p className="text-sm text-[var(--muted)]">Active PoCs</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums">
                    {experimentation.value.activePocs}
                  </p>
                </div>
                <div className="rounded-md border border-[var(--line)] p-3">
                  <p className="text-sm text-[var(--muted)]">Active Pilots</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums">
                    {experimentation.value.activePilots}
                  </p>
                </div>
                <Link
                  href={initiativesHref}
                  className="col-span-2 text-sm text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Browse initiatives for PoC / Pilot workspaces
                </Link>
              </div>
            )}
          </Panel>

          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-medium">PI capacity overview</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Live capacity preview — full board on PI &amp; Capacity.
                </p>
              </div>
              <StatusBadge
                status={capacityBadge.status}
                label={capacityBadge.label}
                size="compact"
              />
            </div>
            {!capacity.available ? (
              <div className="mt-4">
                <UnavailableNotice reason={capacity.reason} />
                <Link
                  href={piHref}
                  className="mt-3 inline-block text-sm text-[var(--accent)] underline"
                >
                  Open PI Planning
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-md border border-[var(--line)] p-2">
                    <p className="text-[var(--muted)]">PIs considered</p>
                    <p className="font-medium tabular-nums">
                      {capacity.value.piCountConsidered}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--line)] p-2">
                    <p className="text-[var(--muted)]">Near capacity</p>
                    <p className="font-medium tabular-nums">
                      {capacity.value.nearCapacityTeamIterations}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--line)] p-2">
                    <p className="text-[var(--muted)]">Overloaded</p>
                    <p className="font-medium tabular-nums">
                      {capacity.value.overloadedTeamIterations}
                    </p>
                  </div>
                </div>
                {capacity.value.teams.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No team-iteration capacity rows in scope.
                  </p>
                ) : (
                  <ul className="space-y-3" aria-label="Top capacity teams">
                    {capacity.value.teams.slice(0, 6).map((row) => {
                      const available = Number(row.effectiveCapacityHours) || 0;
                      const committed = Number(row.plannedLoadHours) || 0;
                      return (
                        <li key={`${row.teamId}-${row.iterationId}`}>
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-medium">{row.teamName}</span>
                            <span className="text-xs text-[var(--muted)]">
                              {CAPACITY_BAND_LABELS[row.band] ?? row.band}
                            </span>
                          </div>
                          <CapacityBar
                            available={available}
                            committed={committed}
                            unavailable={available <= 0}
                            showPercent
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {capacity.value.teams.length > 6 ? (
                  <p className="text-xs text-[var(--muted)]">
                    Showing 6 of {capacity.value.teams.length} team-iteration
                    rows.
                  </p>
                ) : null}
                <Link
                  href={capacityHref}
                  className="inline-block text-sm font-medium text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Open full PI &amp; Capacity workspace
                </Link>
              </div>
            )}
          </Panel>
        </div>

        <details className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
          <summary className="cursor-pointer font-medium text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
            Ownership references
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">
              Progressive detail — resource owner counts
            </span>
          </summary>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Resource ownership counts from initiative, project, PoC, and Pilot
            owner fields (references only).
          </p>
          {!ownership.available ? (
            <div className="mt-4">
              <UnavailableNotice reason={ownership.reason} />
            </div>
          ) : ownership.value.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No ownership references in scope.
            </p>
          ) : (
            <div
              className="mt-4 overflow-x-auto"
              role="region"
              tabIndex={0}
              aria-label="Ownership references by resource"
            >
              <table className="w-full min-w-[480px] text-left text-sm">
                <caption className="sr-only">
                  Ownership counts by resource across initiatives, projects,
                  PoCs, and pilots
                </caption>
                <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Resource
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Initiatives
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Projects
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      PoCs
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Pilots
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {ownership.value.slice(0, 15).map((row) => (
                    <tr key={row.resourceId}>
                      <td className="py-2 pr-3">
                        {row.displayName ?? row.resourceId}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.initiativeBusinessOwnerCount}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.projectOwnerCount}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.pocOwnerCount}
                      </td>
                      <td className="py-2 tabular-nums">
                        {row.pilotOwnerCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </section>

      <Alert tone="success">
        Portfolio figures are read-only aggregates from existing M2 query
        services. Delivery health and capacity are not recalculated in the
        browser.
      </Alert>
    </div>
  );
}

function AttentionActionCard({
  title,
  count,
  unavailable,
  detail,
  href,
  action,
  tone = "default",
}: {
  title: string;
  count: number | null;
  unavailable?: boolean;
  detail: string;
  href: string;
  action: string;
  tone?: "default" | "attention" | "critical";
}) {
  const border =
    tone === "critical"
      ? "border-[var(--color-error)]/40"
      : tone === "attention"
        ? "border-[var(--color-warning)]/40"
        : "border-[var(--line)]";

  return (
    <div className={`rounded-lg border ${border} bg-[var(--surface)] p-3`}>
      <p className="text-sm text-[var(--muted)]">{title}</p>
      {unavailable || count == null ? (
        <p className="mt-1 text-sm text-[var(--muted)]">Unavailable</p>
      ) : (
        <p className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums text-[var(--ink)]">
          {count}
        </p>
      )}
      <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>
      <Link
        href={href}
        className="mt-2 inline-flex min-h-9 items-center text-sm font-medium text-[var(--accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {action}
      </Link>
    </div>
  );
}
