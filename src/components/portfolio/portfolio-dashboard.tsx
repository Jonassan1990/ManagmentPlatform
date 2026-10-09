import Link from "next/link";
import {
  formatHours,
  utilizationBarClass,
} from "@/components/pi-planning/pi-nav";
import { Alert, EmptyState, Panel } from "@/components/ui/page";
import type {
  DeliveryHealthAttentionResult,
  DeliveryHealthSummary,
  PortfolioSnapshot,
} from "@/modules/portfolio/domain/types";
import {
  DeliveryHealthAttentionList,
  DeliveryHealthCountsSection,
} from "./delivery-health";
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

function KpiCard({
  label,
  children,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: "default" | "attention";
}) {
  const body = (
    <>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      {children}
      {hint ? (
        <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
    </>
  );
  const className = `h-full ${
    tone === "attention" ? "border-[var(--warning)]/40" : ""
  }`;

  if (href) {
    return (
      <Panel className={className}>
        <Link
          href={href}
          className="block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {body}
        </Link>
      </Panel>
    );
  }
  return <Panel className={className}>{body}</Panel>;
}

function ScopeBanner({
  snapshot,
  organizationName,
  departmentName,
}: {
  snapshot: PortfolioSnapshot;
  organizationName: string;
  departmentName: string | null;
}) {
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
            href={`/portfolio/explorer?organizationId=${snapshot.scope.organizationId}`}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Open explorer
          </Link>
          <Link
            href={`/portfolio/capacity?organizationId=${snapshot.scope.organizationId}`}
            className="rounded-md bg-[#087f78] px-3 py-1.5 text-sm font-medium text-white"
          >
            PI &amp; Capacity
          </Link>
          <Link
            href={`/organization/${snapshot.scope.organizationId}`}
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
          >
            Organization
          </Link>
          <Link
            href="/initiatives"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
          >
            Initiatives
          </Link>
          <Link
            href="/pi"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
          >
            PI Planning
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
}: {
  organizations: PortfolioOrgOption[];
  departments: PortfolioDeptOption[];
  organizationId: string;
  departmentId?: string;
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
            className="mt-1 block min-w-[12rem] rounded-md border border-[var(--line)] bg-white px-3 py-2"
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
            className="mt-1 block min-w-[12rem] rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="">
              {departments.length === 0
                ? "All visible departments"
                : "All visible departments"}
            </option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Apply scope
        </button>
      </form>
    </Panel>
  );
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
}: {
  snapshot: PortfolioSnapshot;
  organizationName: string;
  departmentName: string | null;
  departmentId?: string | null;
  healthSummary?: DeliveryHealthSummary | null;
  healthAttention?: DeliveryHealthAttentionResult | null;
  healthFocus?: string | null;
  healthError?: string | null;
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

  const attentionTotal =
    (governance.available ? pendingGov : 0) +
    criticalIssues +
    criticalDeps +
    delayedCount;

  const isEmptyPortfolio =
    initiatives.available &&
    initiatives.value.total === 0 &&
    projects.available &&
    projects.value.active === 0 &&
    projects.value.onHold === 0 &&
    projects.value.completed === 0 &&
    projects.value.cancelled === 0;

  return (
    <div className="space-y-6">
      <ScopeBanner
        snapshot={snapshot}
        organizationName={organizationName}
        departmentName={departmentName}
      />

      <section aria-labelledby="portfolio-kpis">
        <h2 id="portfolio-kpis" className="mb-2 text-sm font-medium tracking-wide text-[var(--muted)]">
          Key indicators
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Initiatives" href="/initiatives" hint="Non-archived in scope">
            <MetricFigure
              metric={
                initiatives.available
                  ? { available: true, value: initiatives.value.total }
                  : initiatives
              }
            />
          </KpiCard>
          <KpiCard label="Active projects" href="/initiatives" hint="Status ACTIVE">
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
            label="Active blockers"
            tone={blockerCount > 0 ? "attention" : "default"}
            hint="Open project issues marked as blockers"
          >
            <MetricFigure
              metric={
                issues.available
                  ? { available: true, value: issues.value.activeBlockers }
                  : issues
              }
            />
          </KpiCard>
        </div>
      </section>

      {isEmptyPortfolio ? (
        <EmptyState
          title="No portfolio activity in this scope"
          description="There are no non-archived initiatives or projects visible under your current organization and department scope."
          action={
            <Link
              href="/initiatives/new"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Create an initiative
            </Link>
          }
        />
      ) : null}

      {healthError ? (
        <Alert tone="danger">
          Delivery health could not be loaded — {healthError}
        </Alert>
      ) : null}

      {healthSummary ? (
        <DeliveryHealthCountsSection
          summary={healthSummary}
          organizationId={snapshot.scope.organizationId}
          departmentId={departmentId}
          healthFocus={healthFocus}
        />
      ) : null}

      {healthAttention ? (
        <DeliveryHealthAttentionList
          attention={healthAttention}
          organizationId={snapshot.scope.organizationId}
          departmentId={departmentId}
          healthFocus={healthFocus}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-medium">Initiative lifecycle</h2>
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
                  value={initiatives.value.byStage[stage as keyof typeof initiatives.value.byStage]}
                  max={initiativeTotal}
                  href={
                    stage === "DEMAND" ||
                    stage === "REQUIREMENTS" ||
                    stage === "PRE_STUDY"
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
          <h2 className="font-medium">Project status</h2>
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
                [
                  "active",
                  "onHold",
                  "completed",
                  "cancelled",
                ] as const
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
                    href="/initiatives"
                  />
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Management attention</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Items that typically need executive follow-up. Counts come from the
              M2A snapshot — not client-side recalculation.
            </p>
          </div>
          <p className="rounded-md bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--accent)]">
            Attention signals:{" "}
            <span className="font-medium tabular-nums">{attentionTotal}</span>
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-[var(--line)] p-3">
            <p className="text-sm text-[var(--muted)]">Pending governance</p>
            {!governance.available ? (
              <p className="mt-1 text-sm text-[var(--muted)]">Unavailable</p>
            ) : (
              <>
                <p className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums">
                  {pendingGov}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Waiting approval {governance.value.waitingForApproval} ·
                  Waiting decision {governance.value.waitingForDecision} ·
                  Pending requests {governance.value.pendingApprovalRequests}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <Link href="/approvals" className="text-[var(--accent)] underline">
                    Approvals
                  </Link>
                  <Link href="/decisions" className="text-[var(--accent)] underline">
                    Decisions
                  </Link>
                </div>
              </>
            )}
          </div>
          <div className="rounded-md border border-[var(--line)] p-3">
            <p className="text-sm text-[var(--muted)]">Critical open issues</p>
            <MetricFigure
              metric={
                issues.available
                  ? { available: true, value: issues.value.criticalOpenIssues }
                  : issues
              }
            />
            {issues.available ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Open issues {issues.value.openIssues} · Active blockers{" "}
                {issues.value.activeBlockers}
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-[var(--line)] p-3">
            <p className="text-sm text-[var(--muted)]">Critical dependencies</p>
            <MetricFigure
              metric={
                dependencies.available
                  ? {
                      available: true,
                      value: dependencies.value.criticalOpenDependencies,
                    }
                  : dependencies
              }
            />
            {dependencies.available ? (
              <>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Open dependencies {dependencies.value.openDependencies}
                </p>
                <Link
                  href="/pi"
                  className="mt-2 inline-block text-sm text-[var(--accent)] underline"
                >
                  PI dependencies
                </Link>
              </>
            ) : null}
          </div>
          <div className="rounded-md border border-[var(--line)] p-3">
            <p className="text-sm text-[var(--muted)]">Delayed projects</p>
            <MetricFigure
              metric={
                delayed.available
                  ? { available: true, value: delayed.value.delayedProjects }
                  : delayed
              }
            />
            {delayed.available ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Definition: missed milestone or planned end before as-of date.
              </p>
            ) : null}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-medium">Experimentation</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Active PoCs and Pilots (draft through evaluation).
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
                href="/initiatives"
                className="col-span-2 text-sm text-[var(--accent)] underline"
              >
                Browse initiatives for PoC / Pilot workspaces
              </Link>
            </div>
          )}
        </Panel>

        <Panel>
          <h2 className="font-medium">PI capacity utilization</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Live capacity via existing capacity policy (not historical baselines).
          </p>
          {!capacity.available ? (
            <div className="mt-4">
              <UnavailableNotice reason={capacity.reason} />
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Team</th>
                        <th className="py-2 pr-3 font-medium">Capacity</th>
                        <th className="py-2 pr-3 font-medium">Load</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {capacity.value.teams.slice(0, 12).map((row) => {
                        const pct =
                          row.utilization == null
                            ? null
                            : Math.round(row.utilization * 100);
                        return (
                          <tr key={`${row.teamId}-${row.iterationId}`}>
                            <td className="py-2 pr-3">{row.teamName}</td>
                            <td className="py-2 pr-3 tabular-nums">
                              {formatHours(row.effectiveCapacityHours)}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {formatHours(row.plannedLoadHours)}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--line)]">
                                  <div
                                    className={`h-full ${utilizationBarClass(row.band)}`}
                                    style={{
                                      width: `${Math.min(pct ?? 0, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span>
                                  {CAPACITY_BAND_LABELS[row.band] ?? row.band}
                                  {pct != null ? ` (${pct}%)` : ""}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {capacity.value.teams.length > 12 ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Showing 12 of {capacity.value.teams.length} team-iteration
                      rows. Open PI capacity for the full board.
                    </p>
                  ) : null}
                </div>
              )}
              <Link
                href="/pi"
                className="inline-block text-sm text-[var(--accent)] underline"
              >
                Open PI Planning
              </Link>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <h2 className="font-medium">Portfolio ownership references</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
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
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Resource</th>
                  <th className="py-2 pr-3 font-medium">Initiatives</th>
                  <th className="py-2 pr-3 font-medium">Projects</th>
                  <th className="py-2 pr-3 font-medium">PoCs</th>
                  <th className="py-2 font-medium">Pilots</th>
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
                    <td className="py-2 tabular-nums">{row.pilotOwnerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Alert tone="ok">
        Portfolio figures are read-only aggregates from the M2A / M2D-A query
        services. Delivery health and other business calculations are not
        duplicated in the browser.
      </Alert>
    </div>
  );
}
