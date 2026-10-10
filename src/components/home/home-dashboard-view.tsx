/**
 * M5B-B — Premium role-aware Home dashboard (presentation only).
 * Consumes HomeDashboardResponse; no client aggregation or KPI formulas.
 */
import Link from "next/link";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { Alert } from "@/components/ui/alert";
import { Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { appendReturnContext } from "@/modules/navigation/return-context";
import type {
  HomeAvailabilityState,
  HomeDashboardMode,
  HomeDashboardResponse,
  HomeMetricValue,
  HomeMyWorkItem,
  HomeQuickAction,
} from "@/modules/portfolio/domain/home-dashboard";
import {
  attributionLabel,
  availabilityTitle,
  modeDescription,
  modeHeadline,
  PRIMARY_QUICK_START_IDS,
  roleContextLabel,
  workKindLabel,
} from "./home-labels";

function homeHref(href: string, organizationId: string | null): string {
  if (!organizationId) return href;
  return appendReturnContext(href, { from: "home", organizationId });
}

function SectionShell({
  id,
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="ds-eyebrow text-[10px]">
            {eyebrow}
          </p>
          <h2
            id={id}
            className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AvailabilityPanel({
  state,
  reason,
  nextSteps,
}: {
  state: HomeAvailabilityState;
  reason?: string;
  nextSteps?: React.ReactNode;
}) {
  if (state === "available") return null;
  return (
    <Panel className="border-dashed">
      <h3 className="text-sm font-semibold text-[var(--ink)]">
        {availabilityTitle(state)}
      </h3>
      {reason ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{reason}</p>
      ) : null}
      {nextSteps ? <div className="mt-3">{nextSteps}</div> : null}
      {state === "unavailable" ? (
        <p className="sr-only" role="status">
          Section temporarily unavailable.
        </p>
      ) : null}
    </Panel>
  );
}

function KpiCard({
  metric,
  organizationId,
  tone = "default",
}: {
  metric: HomeMetricValue;
  organizationId: string | null;
  tone?: "default" | "attention" | "critical" | "teal";
}) {
  if (!metric.available) {
    return (
      <Panel
        className="relative h-full overflow-hidden border-[var(--line)] pl-4"
        aria-label={`${metric.label}: unavailable`}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-[var(--muted)]"
        />
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          {metric.label}
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--muted)]">
          —
        </p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {metric.unavailableReason ?? "Unavailable"}
        </p>
      </Panel>
    );
  }

  const accent =
    tone === "critical"
      ? "bg-[var(--color-error)]"
      : tone === "attention"
        ? "bg-[var(--color-warning)]"
        : tone === "teal"
          ? "bg-[var(--color-accent)]"
          : "bg-[var(--color-primary)]";

  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {metric.label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-[28px] font-semibold leading-none tracking-tight text-[var(--ink)]">
        {metric.value}
      </p>
      {metric.href ? (
        <p className="mt-2 text-xs font-medium text-[var(--color-accent)]">Open →</p>
      ) : null}
    </>
  );

  const className =
    "relative h-full overflow-hidden border-[var(--line)] pl-4";

  if (metric.href) {
    return (
      <Panel className={className}>
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
        <Link
          href={homeHref(metric.href, organizationId)}
          className="block min-h-11 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label={`${metric.label}: ${metric.value}`}
        >
          {body}
        </Link>
      </Panel>
    );
  }

  return (
    <Panel
      className={className}
      aria-label={`${metric.label}: ${metric.value}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      {body}
    </Panel>
  );
}

function QuickStartCard({
  action,
  organizationId,
}: {
  action: HomeQuickAction;
  organizationId: string | null;
}) {
  const emphasized = action.primary || PRIMARY_QUICK_START_IDS.has(action.id);
  return (
    <Link
      href={homeHref(action.href, organizationId)}
      className={
        emphasized
          ? "flex min-h-11 flex-col justify-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--accent-soft)] px-4 py-3 text-[var(--ink)] shadow-sm transition-colors hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          : "flex min-h-11 flex-col justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] transition-colors hover:border-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      }
    >
      <span className="text-sm font-semibold">{action.label}</span>
      <span className="mt-0.5 text-xs text-[var(--muted)]">Open workspace</span>
    </Link>
  );
}

function MyWorkRow({
  item,
  organizationId,
}: {
  item: HomeMyWorkItem;
  organizationId: string | null;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status="in-progress"
            label={workKindLabel(item.kind)}
            size="compact"
          />
          <StatusBadge
            status="pending"
            label={attributionLabel(item.attribution)}
            size="compact"
          />
          {item.status ? (
            <span className="text-xs text-[var(--muted)]">{item.status}</span>
          ) : null}
        </div>
        <Link
          href={homeHref(item.href, organizationId)}
          className="mt-1 inline-flex min-h-11 items-center font-medium text-[var(--color-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          {item.referenceKey ? `${item.referenceKey} · ` : null}
          {item.title}
        </Link>
      </div>
    </li>
  );
}

function WelcomeHeader({ dash }: { dash: HomeDashboardResponse }) {
  const { userContext } = dash;
  const preferred = userContext.organizations.find(
    (o) => o.id === userContext.preferredOrganizationId,
  );
  const roleLabel = preferred
    ? roleContextLabel(preferred.roleKeys)
    : roleContextLabel(
        userContext.roleBindings.map((b) => b.roleKey),
      );
  const name = userContext.displayName?.trim() || "there";

  return (
    <header className="mb-2">
      <p className="ds-eyebrow text-[10px]">
        Home
      </p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
        Welcome, {name}
      </h1>
      <p className="mt-1 max-w-2xl text-[var(--muted)]">
        {modeDescription(userContext.mode)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {preferred ? (
          <span className="inline-flex min-h-9 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--ink)]">
            {preferred.name}
          </span>
        ) : null}
        {roleLabel ? (
          <span className="inline-flex min-h-9 items-center rounded-md border border-[var(--color-accent)]/25 bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--color-accent)]">
            {roleLabel}
          </span>
        ) : null}
        <span className="inline-flex min-h-9 items-center rounded-md border border-[var(--line)] px-3 text-xs text-[var(--muted)]">
          {modeHeadline(userContext.mode)}
        </span>
      </div>
      {userContext.organizations.length > 1 ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {userContext.organizations.length} organizations in scope
          {preferred ? ` · showing ${preferred.name}` : null}.
        </p>
      ) : null}
    </header>
  );
}

function QuickStartSection({
  dash,
  organizationId,
}: {
  dash: HomeDashboardResponse;
  organizationId: string | null;
}) {
  const { availableActions } = dash;
  return (
    <SectionShell
      id="home-quick-start"
      eyebrow="Start here"
      title="Quick Start"
      description="Authorized destinations for this session. Pages still enforce permissions."
    >
      {availableActions.availability.state !== "available" ? (
        <AvailabilityPanel
          state={availableActions.availability.state}
          reason={availableActions.availability.reason}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableActions.actions.map((action) => (
            <QuickStartCard
              key={action.id}
              action={action}
              organizationId={organizationId}
            />
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function NeedsAttentionSection({
  dash,
  organizationId,
}: {
  dash: HomeDashboardResponse;
  organizationId: string | null;
}) {
  const section = dash.needsAttention;
  const counts = section.counts;
  const countTiles: Array<{
    key: string;
    label: string;
    value: number | null;
    href: string | null;
    tone: "default" | "attention" | "critical";
  }> = [
    {
      key: "blocked",
      label: "Blocked / at risk",
      value: counts.blockedOrAtRiskProjects,
      href: organizationId
        ? `/portfolio/health?organizationId=${organizationId}&healthFocus=ATTENTION`
        : null,
      tone: "critical",
    },
    {
      key: "initiatives",
      label: "Initiatives needing attention",
      value: counts.initiativesNeedingAttention,
      href: "/initiatives",
      tone: "attention",
    },
    {
      key: "approvals",
      label: "Waiting for approval",
      value: counts.waitingForApproval,
      href: "/approvals",
      tone: "attention",
    },
    {
      key: "pis",
      label: "PIs needing attention",
      value: counts.pisNeedingAttention,
      href: "/pi",
      tone: "attention",
    },
  ];

  return (
    <SectionShell
      id="home-attention"
      eyebrow="Act now"
      title="Needs Attention"
      description="Live delivery and governance signals — not a separate scoring engine."
      action={
        section.drillDown[0] ? (
          <Link
            href={homeHref(section.drillDown[0].href, organizationId)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {section.drillDown[0].label}
          </Link>
        ) : null
      }
    >
      {section.availability.state === "unavailable" ||
      section.availability.state === "forbidden" ||
      section.availability.state === "no_permission" ||
      section.availability.state === "no_organization" ? (
        <AvailabilityPanel
          state={section.availability.state}
          reason={section.availability.reason}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {countTiles.map((tile) => {
          if (tile.value === null) {
            return (
              <Panel
                key={tile.key}
                className="relative overflow-hidden pl-4"
                aria-label={`${tile.label}: unavailable`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 bg-[var(--muted)]"
                />
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {tile.label}
                </p>
                <p className="mt-1 text-2xl text-[var(--muted)]">—</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Unavailable</p>
              </Panel>
            );
          }
          const metric: HomeMetricValue = {
            key: tile.key,
            label: tile.label,
            value: tile.value,
            available: true,
            href: tile.href,
            source: "needsAttention.counts",
          };
          return (
            <KpiCard
              key={tile.key}
              metric={metric}
              organizationId={organizationId}
              tone={tile.value > 0 ? tile.tone : "teal"}
            />
          );
        })}
      </div>

      {section.availability.state === "empty" ? (
        <AvailabilityPanel
          state="empty"
          reason={
            section.availability.reason ??
            "Nothing currently needs your attention in this organization."
          }
        />
      ) : null}

      {section.items.length > 0 ? (
        <Panel>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Priority items
          </h3>
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {section.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <Link
                    href={homeHref(item.href, organizationId)}
                    className="inline-flex min-h-11 items-center font-medium text-[var(--color-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  >
                    {item.label}
                  </Link>
                  {item.detail ? (
                    <p className="text-xs text-[var(--muted)]">{item.detail}</p>
                  ) : null}
                </div>
                <StatusBadge
                  status={
                    item.severity === "blocker"
                      ? "blocked"
                      : item.severity === "warning"
                        ? "at-risk"
                        : "pending"
                  }
                  label={item.severity}
                  size="compact"
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </SectionShell>
  );
}

function MyWorkSection({
  dash,
  organizationId,
}: {
  dash: HomeDashboardResponse;
  organizationId: string | null;
}) {
  const section = dash.myWork;
  const nextSteps =
    section.availability.state === "no_linked_resource" ? (
      <p className="text-sm text-[var(--muted)]">
        Ask an organization admin to link your Principal to a PERSON Resource if
        you should see owned Initiatives and Projects here.
      </p>
    ) : section.drillDown[0] ? (
      <Link
        href={homeHref(section.drillDown[0].href, organizationId)}
        className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        {section.drillDown[0].label}
      </Link>
    ) : null;

  return (
    <SectionShell
      id="home-my-work"
      eyebrow="Owned by you"
      title="My Work"
      description="Items tied to your linked Resource or pending governance responsibilities."
    >
      {section.availability.state !== "available" ? (
        <AvailabilityPanel
          state={section.availability.state}
          reason={section.availability.reason}
          nextSteps={nextSteps}
        />
      ) : null}

      {section.items.length > 0 ? (
        <Panel>
          <ul>
            {section.items.map((item) => (
              <MyWorkRow
                key={item.id}
                item={item}
                organizationId={organizationId}
              />
            ))}
          </ul>
          {section.truncated ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Showing a bounded list — open Initiatives or Approvals for the full
              queue.
            </p>
          ) : null}
        </Panel>
      ) : null}
    </SectionShell>
  );
}

function PortfolioSummarySection({
  dash,
  organizationId,
}: {
  dash: HomeDashboardResponse;
  organizationId: string | null;
}) {
  const section = dash.portfolioSummary;
  // Prefer compact primary KPIs; skip unavailable-only clutter when many.
  const preferredKeys = [
    "active-initiatives",
    "active-projects",
    "pending-governance",
    "delayed-projects",
    "overloaded-teams",
    "projects-at-risk-overview",
  ];
  const metrics = preferredKeys
    .map((key) => section.metrics.find((m) => m.key === key))
    .filter((m): m is HomeMetricValue => Boolean(m));

  return (
    <SectionShell
      id="home-portfolio"
      eyebrow="Portfolio"
      title="Portfolio Summary"
      description="Authorized counts from the portfolio snapshot for the preferred organization."
      action={
        organizationId ? (
          <Link
            href={homeHref(
              `/portfolio?organizationId=${organizationId}`,
              organizationId,
            )}
            className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            Open Portfolio
          </Link>
        ) : null
      }
    >
      {section.availability.state === "forbidden" ||
      section.availability.state === "no_permission" ||
      section.availability.state === "unavailable" ||
      section.availability.state === "no_organization" ? (
        <AvailabilityPanel
          state={section.availability.state}
          reason={section.availability.reason}
        />
      ) : metrics.length === 0 ? (
        <AvailabilityPanel
          state={section.availability.state}
          reason={section.availability.reason}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {metrics.map((metric) => (
            <KpiCard
              key={metric.key}
              metric={metric}
              organizationId={organizationId}
              tone={
                metric.key.includes("risk") ||
                metric.key.includes("delayed") ||
                metric.key.includes("overload")
                  ? metric.available && (metric.value ?? 0) > 0
                    ? "attention"
                    : "teal"
                  : "teal"
              }
            />
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function ActiveProjectsSection({
  dash,
  organizationId,
}: {
  dash: HomeDashboardResponse;
  organizationId: string | null;
}) {
  const section = dash.activeProjects;
  return (
    <SectionShell
      id="home-projects"
      eyebrow="Delivery"
      title="Active Projects"
      description="Attention-ranked sample from delivery health — open Explorer for the full list."
    >
      {section.availability.state !== "available" &&
      section.rows.length === 0 ? (
        <AvailabilityPanel
          state={section.availability.state}
          reason={section.availability.reason}
          nextSteps={
            section.drillDown[0] ? (
              <Link
                href={homeHref(section.drillDown[0].href, organizationId)}
                className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                {section.drillDown[0].label}
              </Link>
            ) : null
          }
        />
      ) : (
        <Panel>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <p>
              <span className="text-[var(--muted)]">Active </span>
              <strong className="text-[var(--ink)]">
                {section.activeProjectCount === null
                  ? "—"
                  : section.activeProjectCount}
              </strong>
            </p>
            <p>
              <span className="text-[var(--muted)]">Blocked / at risk </span>
              <strong className="text-[var(--ink)]">
                {section.blockedOrAtRiskCount === null
                  ? "—"
                  : section.blockedOrAtRiskCount}
              </strong>
            </p>
          </div>
          {section.rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No attention-ranked projects in this sample.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {section.rows.map((row) => (
                <li
                  key={row.projectId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <Link
                    href={homeHref(row.href, organizationId)}
                    className="inline-flex min-h-11 items-center font-medium text-[var(--color-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  >
                    {row.referenceKey} · {row.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--muted)]">
                      {row.departmentName}
                    </span>
                    <StatusBadge
                      status={
                        row.classification === "BLOCKED"
                          ? "blocked"
                          : row.classification === "AT_RISK"
                            ? "at-risk"
                            : "in-progress"
                      }
                      label={row.classification}
                      size="compact"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </SectionShell>
  );
}

function CurrentPiSection({
  dash,
  organizationId,
}: {
  dash: HomeDashboardResponse;
  organizationId: string | null;
}) {
  const section = dash.currentPi;
  return (
    <SectionShell
      id="home-current-pi"
      eyebrow="Planning"
      title="Current PI"
      description="Latest authorized Program Increment for planning entry."
    >
      {section.availability.state !== "available" || !section.pi ? (
        <AvailabilityPanel
          state={
            section.availability.state === "available"
              ? "empty"
              : section.availability.state
          }
          reason={section.availability.reason}
          nextSteps={
            section.drillDown[0] ? (
              <Link
                href={homeHref(section.drillDown[0].href, organizationId)}
                className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                {section.drillDown[0].label}
              </Link>
            ) : null
          }
        />
      ) : (
        <Panel className="border-[var(--color-accent)]/25 bg-[var(--accent-soft)]/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                {section.pi.status}
              </p>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                {section.pi.referenceKey} · {section.pi.name}
              </h3>
              {section.metrics.length > 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {section.metrics
                    .filter((m) => m.available)
                    .slice(0, 3)
                    .map((m) => `${m.label}: ${m.value}`)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <Link
              href={homeHref(section.pi.href, organizationId)}
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-medium text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              Continue planning
            </Link>
          </div>
        </Panel>
      )}
    </SectionShell>
  );
}

function ResourceCapacitySection({
  dash,
  organizationId,
}: {
  dash: HomeDashboardResponse;
  organizationId: string | null;
}) {
  const section = dash.resourceCapacity;
  const totals = section.totals;
  const available =
    totals?.effectiveCapacityHours != null
      ? totals.effectiveCapacityHours
      : 0;
  const committed =
    totals?.plannedLoadHours != null ? totals.plannedLoadHours : 0;
  const utilPct =
    totals?.utilization != null
      ? Math.round(totals.utilization * 100)
      : null;

  return (
    <SectionShell
      id="home-capacity"
      eyebrow="Resources"
      title="Resource Capacity"
      description="CURRENT-revision capacity summary for the selected PI — server-calculated."
      action={
        section.drillDown[0] ? (
          <Link
            href={homeHref(section.drillDown[0].href, organizationId)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {section.drillDown[0].label}
          </Link>
        ) : null
      }
    >
      {section.availability.state !== "available" || !totals ? (
        <AvailabilityPanel
          state={
            section.availability.state === "available"
              ? "empty"
              : section.availability.state
          }
          reason={section.availability.reason}
        />
      ) : (
        <Panel>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-[var(--ink)]">
              {section.piReferenceKey
                ? `PI ${section.piReferenceKey}`
                : "Selected PI"}
            </p>
            {utilPct !== null ? (
              <p className="text-sm text-[var(--muted)]">
                Utilization {utilPct}%
              </p>
            ) : null}
          </div>
          <CapacityBar
            available={available}
            committed={committed}
            showPercent
          />
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Overloaded teams
              </dt>
              <dd className="mt-1 text-lg font-semibold text-[var(--ink)]">
                {section.overloadedTeamCount ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Underutilized teams
              </dt>
              <dd className="mt-1 text-lg font-semibold text-[var(--ink)]">
                {section.underutilizedTeamCount ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Conflicts
              </dt>
              <dd className="mt-1 text-lg font-semibold text-[var(--ink)]">
                {section.conflictCount ?? "—"}
              </dd>
            </div>
          </dl>
        </Panel>
      )}
    </SectionShell>
  );
}

function Warnings({ dash }: { dash: HomeDashboardResponse }) {
  if (dash.warnings.length === 0) return null;
  return (
    <div className="space-y-2" role="status">
      {dash.warnings.map((w) => (
        <Alert key={w.code} tone="info">
          {w.message}
        </Alert>
      ))}
    </div>
  );
}

function layoutOrder(mode: HomeDashboardMode): Array<
  | "attention"
  | "myWork"
  | "quickStart"
  | "portfolio"
  | "projects"
  | "pi"
  | "capacity"
> {
  switch (mode) {
    case "manager":
      return [
        "attention",
        "quickStart",
        "portfolio",
        "projects",
        "pi",
        "capacity",
        "myWork",
      ];
    case "employee":
      return [
        "myWork",
        "quickStart",
        "projects",
        "pi",
        "attention",
        "portfolio",
        "capacity",
      ];
    case "mixed":
      return [
        "attention",
        "myWork",
        "quickStart",
        "portfolio",
        "projects",
        "pi",
        "capacity",
      ];
  }
}

export type HomeDashboardViewProps = {
  dashboard: HomeDashboardResponse;
};

/**
 * Role-aware Home composition. Server-component safe.
 */
export function HomeDashboardView({ dashboard }: HomeDashboardViewProps) {
  const orgId = dashboard.userContext.preferredOrganizationId;
  const order = layoutOrder(dashboard.userContext.mode);

  const sections: Record<(typeof order)[number], React.ReactNode> = {
    attention: (
      <NeedsAttentionSection dash={dashboard} organizationId={orgId} />
    ),
    myWork: <MyWorkSection dash={dashboard} organizationId={orgId} />,
    quickStart: (
      <QuickStartSection dash={dashboard} organizationId={orgId} />
    ),
    portfolio: (
      <PortfolioSummarySection dash={dashboard} organizationId={orgId} />
    ),
    projects: (
      <ActiveProjectsSection dash={dashboard} organizationId={orgId} />
    ),
    pi: <CurrentPiSection dash={dashboard} organizationId={orgId} />,
    capacity: (
      <ResourceCapacitySection dash={dashboard} organizationId={orgId} />
    ),
  };

  // Mixed: attention + my work side-by-side on large screens.
  if (dashboard.userContext.mode === "mixed") {
    return (
      <div className="space-y-8">
        <WelcomeHeader dash={dashboard} />
        <Warnings dash={dashboard} />
        <div className="grid gap-6 lg:grid-cols-2">
          {sections.attention}
          {sections.myWork}
        </div>
        {order
          .filter((k) => k !== "attention" && k !== "myWork")
          .map((key) => (
            <div key={key}>{sections[key]}</div>
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <WelcomeHeader dash={dashboard} />
      <Warnings dash={dashboard} />
      {order.map((key) => (
        <div key={key}>{sections[key]}</div>
      ))}
    </div>
  );
}
