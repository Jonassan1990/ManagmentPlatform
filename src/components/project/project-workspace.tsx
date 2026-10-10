/**
 * M5C-C — Premium Project & Delivery workspace chrome (presentation only).
 */
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Panel } from "@/components/ui/page";
import { NextActionPanel } from "@/components/initiative/workspace";
import {
  completionIndicatorLabel,
  humanizeProjectToken,
  mapHealthBadge,
  mapStatusBadge,
  ownershipBasisLabel,
  type AttentionItem,
  type DeliveryCounts,
  type ProjectNextActionView,
  type ProjectOwnerDisplay,
} from "@/modules/project/application/project-presentation";

export function ProjectHeader({
  projectReference,
  projectName,
  initiativeReference,
  initiativeId,
  initiativeTitle,
  status,
  owner,
  plannedStart,
  plannedEnd,
  healthClassification,
  healthMessage,
  closed,
  purpose,
}: {
  projectReference: string;
  projectName: string;
  initiativeReference: string;
  initiativeId: string;
  initiativeTitle: string;
  status: string;
  owner: ProjectOwnerDisplay;
  plannedStart?: Date | string | null;
  plannedEnd?: Date | string | null;
  healthClassification: string;
  healthMessage?: string | null;
  closed: boolean;
  purpose?: string | null;
}) {
  const statusBadge = mapStatusBadge(status);
  const healthBadge = mapHealthBadge(healthClassification);
  const start =
    plannedStart instanceof Date
      ? plannedStart.toISOString().slice(0, 10)
      : plannedStart
        ? String(plannedStart).slice(0, 10)
        : null;
  const end =
    plannedEnd instanceof Date
      ? plannedEnd.toISOString().slice(0, 10)
      : plannedEnd
        ? String(plannedEnd).slice(0, 10)
        : null;

  return (
    <header className="mb-5 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
            Project · {projectReference}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
            {projectName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Delivery workspace for managers and contributors. Initiative origin
            remains linked for governance history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={statusBadge.status} label={statusBadge.label} />
          <StatusBadge
            status={healthBadge.status}
            label={`Health · ${healthBadge.label}`}
          />
          {closed ? (
            <StatusBadge status="archived" label="Read-only" size="compact" />
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Project owner
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
            {owner.name ?? "Not set"}
          </dd>
          <dd className="text-[11px] text-[var(--muted)]">
            {ownershipBasisLabel(owner.basis)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Initiative origin
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            <Link
              href={`/initiatives/${initiativeId}`}
              className="font-medium text-[#087f78] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {initiativeReference}
            </Link>
          </dd>
          <dd className="truncate text-[11px] text-[var(--muted)]">
            {initiativeTitle}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Planned start
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">{start ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Planned end
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">{end ?? "Not set"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Delivery health
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {healthMessage ?? healthBadge.label}
          </dd>
        </div>
      </dl>

      {purpose?.trim() ? (
        <p className="text-sm text-[var(--ink)]">
          <span className="font-semibold">Purpose: </span>
          {purpose.trim()}
        </p>
      ) : null}
    </header>
  );
}

export function DeliverySummaryStrip({
  counts,
  healthClassification,
}: {
  counts: DeliveryCounts;
  healthClassification: string;
}) {
  const healthBadge = mapHealthBadge(healthClassification);
  const cells = [
    {
      label: "Milestones",
      value: `${counts.milestonesComplete}/${counts.milestonesTotal}`,
      hint:
        counts.milestonesMissed > 0
          ? `${counts.milestonesMissed} delayed/missed`
          : `${counts.milestonesOpen} open`,
      tone:
        counts.milestonesMissed > 0
          ? ("at-risk" as const)
          : ("completed" as const),
    },
    {
      label: "Work items",
      value: `${counts.workDone}/${counts.workTotal}`,
      hint: `${counts.workOpen} open`,
      tone: "in-progress" as const,
    },
    {
      label: "Open issues",
      value: String(counts.issuesOpen),
      hint:
        counts.criticalOpen > 0
          ? `${counts.criticalOpen} critical`
          : "No critical open",
      tone:
        counts.criticalOpen > 0 ? ("at-risk" as const) : ("completed" as const),
    },
    {
      label: "Active blockers",
      value: String(counts.activeBlockers),
      hint: counts.activeBlockers > 0 ? "Needs attention" : "None",
      tone:
        counts.activeBlockers > 0
          ? ("blocked" as const)
          : ("completed" as const),
    },
    {
      label: "Completion",
      value: completionIndicatorLabel(counts),
      hint: "From stored milestone / work statuses",
      tone: healthBadge.status,
    },
  ];

  return (
    <section
      aria-labelledby="delivery-summary"
      className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      <h2 id="delivery-summary" className="sr-only">
        Delivery summary
      </h2>
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {cell.label}
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--ink)]">
            {cell.value}
          </p>
          <div className="mt-1">
            <StatusBadge
              status={cell.tone}
              label={cell.hint}
              size="compact"
            />
          </div>
        </div>
      ))}
    </section>
  );
}

export function ManagementAttentionPanel({
  items,
}: {
  items: AttentionItem[];
}) {
  return (
    <Panel aria-labelledby="management-attention">
      <h2
        id="management-attention"
        className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]"
      >
        Management attention
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Critical issues, delayed milestones, active blockers, and pending work —
        from recorded project data only.
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]" role="status">
          Nothing requires management attention right now.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--line)] pt-2 first:border-0 first:pt-0"
            >
              <div>
                <p className="font-medium text-[var(--ink)]">{item.label}</p>
                <p className="text-xs text-[var(--muted)]">{item.detail}</p>
              </div>
              <a
                href={`#${item.hrefAnchor}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-[#087f78] underline"
              >
                Jump
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ProjectNextActionSlot({
  action,
  children,
}: {
  action: ProjectNextActionView;
  children?: React.ReactNode;
}) {
  return (
    <NextActionPanel
      label={action.label}
      detail={action.detail}
      blocked={action.blocked}
      href={action.href}
      ctaLabel={action.ctaLabel}
    >
      {action.unavailableReason ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          {action.unavailableReason}
        </p>
      ) : null}
      {children}
    </NextActionPanel>
  );
}

export function ProjectSectionNav({
  closed,
}: {
  closed?: boolean;
}) {
  const primary = [
    { id: "overview", label: "Overview" },
    { id: "delivery", label: "Delivery" },
    { id: "issues", label: "Issues & Risks" },
    { id: "resources", label: "Resources" },
    { id: "closure", label: "Closure" },
    { id: "history", label: "History" },
  ];

  return (
    <nav
      aria-label="Project sections"
      className="mb-4 flex flex-wrap gap-2"
    >
      {primary.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {s.label}
        </a>
      ))}
      {closed ? (
        <span className="inline-flex min-h-11 items-center text-xs text-[var(--muted)]">
          Closed project — sections are historical
        </span>
      ) : null}
    </nav>
  );
}

export function ClosedProjectSummary({
  projectStatus,
  closure,
}: {
  projectStatus: string;
  closure: {
    outcome: string;
    closedAt: Date | string;
    summary: string | null;
    lessonsLearned: string | null;
    finalDeliveryNote: string | null;
    closedBy: { displayName: string | null; email: string | null } | null;
  } | null;
}) {
  const closedAt = closure?.closedAt
    ? typeof closure.closedAt === "string"
      ? closure.closedAt.slice(0, 10)
      : closure.closedAt.toISOString().slice(0, 10)
    : null;
  const actor =
    closure?.closedBy?.displayName ||
    closure?.closedBy?.email ||
    (closure ? "Unknown principal" : null);

  return (
    <section
      aria-labelledby="closed-project-summary"
      className="mb-4 rounded-[var(--radius-md)] border-2 border-[var(--line)] bg-[var(--surface)] px-4 py-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        Closed project · read-only
      </p>
      <h2
        id="closed-project-summary"
        className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
      >
        {humanizeProjectToken(projectStatus)}
        {closure ? ` · ${humanizeProjectToken(closure.outcome)}` : ""}
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Closure outcome
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {closure ? humanizeProjectToken(closure.outcome) : "Status only"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Closure date
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {closedAt ?? "Not recorded"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Closed by
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {actor ?? "Not recorded"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-[var(--muted)]" role="status">
        Editable delivery controls are hidden. Historical work, issues, and
        milestones remain visible below.
      </p>
      {closure?.summary ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink)]">
          {closure.summary}
        </p>
      ) : null}
    </section>
  );
}
