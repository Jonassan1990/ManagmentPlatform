import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { formatMoneyAmount } from "@/modules/portfolio/application/portfolio-cost-rollup";
import type {
  PortfolioMetric,
  PortfolioCostRollup,
  InitiativeLifecycleDistribution,
  PiCapacityPortfolioSummary,
  DependencyExposureCounts,
  DelayedProjectCounts,
} from "@/modules/portfolio/domain/types";
import { CAPACITY_BAND_LABELS } from "./metric";

/**
 * Leadership one-glance: Cost · Resources · Planning.
 * Inspired by QE Portfolio Tracker funnel + PI planning board templates
 * (sanitized mapping in docs/EXECUTIVE-PORTFOLIO-TEMPLATES.md).
 */

const FUNNEL: Array<{
  stage: keyof InitiativeLifecycleDistribution["byStage"];
  label: string;
  tracker: string;
}> = [
  { stage: "DEMAND", label: "Demand", tracker: "Idea inbox" },
  { stage: "REQUIREMENTS", label: "Requirements", tracker: "Elicitation" },
  { stage: "PRE_STUDY", label: "Pre-study", tracker: "Prestudy" },
  { stage: "POC", label: "PoC", tracker: "Experiment" },
  { stage: "PILOT", label: "Pilot", tracker: "Pilot" },
  { stage: "PROJECT", label: "Project", tracker: "Execution" },
];

function Pillar({
  title,
  eyebrow,
  children,
  footer,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <article className="tegel-card flex min-h-[11rem] flex-col p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--scania-blue-700)]">
        {eyebrow}
      </p>
      <h3 className="mp-card-title mt-1 text-[var(--scania-blue-900)]">
        {title}
      </h3>
      <div className="mt-3 flex-1 space-y-2 text-sm">{children}</div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </article>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn" | "critical" | "muted";
}) {
  const color =
    tone === "critical"
      ? "text-[var(--color-error)]"
      : tone === "warn"
        ? "text-[var(--color-warning)]"
        : tone === "ok"
          ? "text-[var(--color-success)]"
          : tone === "muted"
            ? "text-[var(--muted)]"
            : "text-[var(--ink)]";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={`font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function utilLabel(capacity: PortfolioMetric<PiCapacityPortfolioSummary>): {
  text: string;
  tone: "ok" | "warn" | "critical" | "muted";
} {
  if (!capacity.available) {
    return { text: "Unavailable", tone: "muted" };
  }
  const teams = capacity.value.teams;
  if (teams.length === 0) {
    return { text: "No PI load yet", tone: "muted" };
  }
  const withUtil = teams.filter((t) => t.utilization != null);
  if (withUtil.length === 0) {
    return { text: "—", tone: "muted" };
  }
  const avg =
    withUtil.reduce((s, t) => s + (t.utilization as number), 0) /
    withUtil.length;
  const pct = `${Math.round(avg * 100)}%`;
  if (capacity.value.overloadedTeamIterations > 0) {
    return { text: pct, tone: "critical" };
  }
  if (capacity.value.nearCapacityTeamIterations > 0) {
    return { text: pct, tone: "warn" };
  }
  return { text: pct, tone: "ok" };
}

export function ExecutiveBrief({
  cost,
  capacity,
  initiatives,
  dependencies,
  delayed,
  organizationId,
  departmentId,
  capacityHref,
  piHref,
  explorerHref,
  initiativesHref,
}: {
  cost: PortfolioMetric<PortfolioCostRollup>;
  capacity: PortfolioMetric<PiCapacityPortfolioSummary>;
  initiatives: PortfolioMetric<InitiativeLifecycleDistribution>;
  dependencies: PortfolioMetric<DependencyExposureCounts>;
  delayed: PortfolioMetric<DelayedProjectCounts>;
  organizationId: string;
  departmentId?: string | null;
  capacityHref: string;
  piHref: string;
  explorerHref: string;
  initiativesHref: string;
}) {
  const util = utilLabel(capacity);
  const overload = capacity.available
    ? capacity.value.overloadedTeamIterations
    : null;
  const criticalDeps = dependencies.available
    ? dependencies.value.criticalOpenDependencies
    : null;
  const delayedCount = delayed.available ? delayed.value.delayedProjects : null;
  const delta =
    cost.available && cost.value.forecastVsPlannedDelta != null
      ? cost.value.forecastVsPlannedDelta
      : null;

  return (
    <section
      aria-labelledby="executive-brief-heading"
      data-testid="executive-brief"
      className="space-y-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--scania-blue-700)]">
            Leadership brief
          </p>
          <h2
            id="executive-brief-heading"
            className="mp-section-title text-[var(--scania-blue-900)]"
          >
            Cost · Resources · Planning
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            One glance for the portfolio owner: money on active projects, PI
            capacity load, and where work sits in the stage funnel — same model
            as the portfolio tracker wall and PI planning board, live in the
            app.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Pillar
          eyebrow="1 · Cost"
          title="Budget glance"
          footer={
            <Link
              href={explorerHref}
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Open projects
            </Link>
          }
        >
          {!cost.available ? (
            <p className="text-[var(--muted)]">{cost.reason}</p>
          ) : (
            <>
              <Row
                label="Planned"
                value={formatMoneyAmount(cost.value.plannedTotal)}
              />
              <Row
                label="Forecast"
                value={formatMoneyAmount(cost.value.forecastTotal)}
                tone={
                  delta == null
                    ? undefined
                    : delta > 0
                      ? "warn"
                      : delta < 0
                        ? "ok"
                        : undefined
                }
              />
              <Row
                label="Actual"
                value={formatMoneyAmount(cost.value.actualTotal)}
              />
              <Row
                label="Forecast vs plan"
                value={
                  delta == null
                    ? "—"
                    : `${delta > 0 ? "+" : ""}${formatMoneyAmount(delta)}`
                }
                tone={
                  delta == null
                    ? "muted"
                    : delta > 0
                      ? "warn"
                      : delta < 0
                        ? "ok"
                        : "muted"
                }
              />
              <p className="pt-1 text-[10px] text-[var(--muted)]">
                {cost.value.projectsWithAnyCost} of {cost.value.projectsInScope}{" "}
                active/on-hold projects have cost data. Missing values are not
                treated as zero.
              </p>
            </>
          )}
        </Pillar>

        <Pillar
          eyebrow="2 · Resources"
          title="PI capacity load"
          footer={
            <Link
              href={capacityHref}
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Resource management
            </Link>
          }
        >
          {!capacity.available ? (
            <p className="text-[var(--muted)]">{capacity.reason}</p>
          ) : (
            <>
              <Row label="Avg. utilization" value={util.text} tone={util.tone} />
              <Row
                label="Overloaded team×iteration"
                value={String(overload ?? "—")}
                tone={
                  overload != null && overload > 0 ? "critical" : "muted"
                }
              />
              <Row
                label="Near capacity"
                value={String(capacity.value.nearCapacityTeamIterations)}
                tone={
                  capacity.value.nearCapacityTeamIterations > 0
                    ? "warn"
                    : "muted"
                }
              />
              <Row
                label="PIs in capacity scope"
                value={String(capacity.value.piCountConsidered)}
              />
              {capacity.value.teams[0] ? (
                <p className="pt-1 text-[10px] text-[var(--muted)]">
                  Example: {capacity.value.teams[0].teamName} —{" "}
                  {CAPACITY_BAND_LABELS[capacity.value.teams[0].band] ??
                    capacity.value.teams[0].band}
                </p>
              ) : (
                <p className="pt-1 text-[10px] text-[var(--muted)]">
                  Select a PI in Resource management for team-level bars.
                </p>
              )}
            </>
          )}
        </Pillar>

        <Pillar
          eyebrow="3 · Planning"
          title="Commitments & risks"
          footer={
            <div className="flex flex-wrap gap-2">
              <Link
                href={piHref}
                className={buttonClassName({ variant: "primary", size: "sm" })}
              >
                PI planning
              </Link>
              <Link
                href={initiativesHref}
                className={buttonClassName({
                  variant: "secondary",
                  size: "sm",
                })}
              >
                Initiatives
              </Link>
            </div>
          }
        >
          <Row
            label="Delayed projects"
            value={delayedCount == null ? "—" : String(delayedCount)}
            tone={
              delayedCount != null && delayedCount > 0 ? "critical" : "muted"
            }
          />
          <Row
            label="Critical dependencies"
            value={criticalDeps == null ? "—" : String(criticalDeps)}
            tone={
              criticalDeps != null && criticalDeps > 0 ? "warn" : "muted"
            }
          />
          <Row
            label="Initiatives in funnel"
            value={
              initiatives.available
                ? String(initiatives.value.total)
                : "—"
            }
          />
          <p className="pt-1 text-[10px] text-[var(--muted)]">
            PI board pattern: objectives → MVP / Definition of Done →
            dependencies → ownership. Open PI planning for the live board.
          </p>
        </Pillar>
      </div>

      {/* Stage funnel — Excel tracker wall, live counts */}
      <div
        className="tegel-card p-4"
        data-testid="executive-stage-funnel"
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="mp-card-title text-[var(--scania-blue-900)]">
              Portfolio stage funnel
            </h3>
            <p className="text-[11px] text-[var(--muted)]">
              Same idea as the tracker wall (Idea → Prestudy → Requirements →
              Execution). Counts are authorized initiative stages.
            </p>
          </div>
          <Link
            href={`/portfolio/explorer?organizationId=${organizationId}${departmentId ? `&departmentId=${departmentId}` : ""}`}
            className={buttonClassName({ variant: "ghost", size: "sm" })}
          >
            Explorer
          </Link>
        </div>
        {!initiatives.available ? (
          <p className="text-sm text-[var(--muted)]">{initiatives.reason}</p>
        ) : (
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {FUNNEL.map((step, index) => {
              const count = initiatives.value.byStage[step.stage];
              return (
                <li
                  key={step.stage}
                  className="rounded-[4px] border border-[var(--scania-grey-200)] bg-[var(--scania-grey-50)] px-3 py-3"
                >
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                    {index + 1}. {step.tracker}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[var(--scania-blue-900)]">
                    {step.label}
                  </p>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums text-[var(--scania-blue-700)]">
                    {count}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
