/**
 * M5D-A — Shared PI Planning workspace chrome (presentation only).
 */
import Link from "next/link";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatHours } from "@/components/pi-planning/pi-nav";
import {
  describeEditability,
  formatPiDateRange,
  mapPiLifecycleBadge,
  mapPlanRevisionBadge,
  planIdentityLabel,
  readinessSummaryLabel,
  type CapacityRollup,
} from "@/modules/pi-planning/application/pi-planning-presentation";

export function PiPlanningContextHeader({
  piReference,
  piName,
  piStatus,
  startDate,
  endDate,
  teamCount,
  revision,
  capacity,
  canAllocate,
  capacityHref,
  compareHref,
}: {
  piReference: string;
  piName: string;
  piStatus: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  teamCount?: number | null;
  revision?: {
    isCurrent: boolean;
    label?: string | null;
    key?: string | null;
    status: string;
  } | null;
  capacity?: CapacityRollup | null;
  canAllocate?: boolean;
  capacityHref?: string | null;
  compareHref?: string | null;
}) {
  const piBadge = mapPiLifecycleBadge(piStatus);
  const revBadge = revision
    ? mapPlanRevisionBadge({
        isCurrent: revision.isCurrent,
        status: revision.status,
      })
    : null;
  const editability = revision
    ? describeEditability({
        isCurrent: revision.isCurrent,
        status: revision.status,
        canAllocate,
      })
    : null;
  const capacityUnavailable =
    capacity == null ||
    capacity.availableHours == null ||
    capacity.teamSlotCount === 0;

  return (
    <header className="mb-5 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
            PI Planning · {piReference}
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
            {piName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Plan work across iterations with clear capacity, conflicts, and
            scenarios — without revision jargon in the primary view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={piBadge.status}
            label={`PI · ${piBadge.label}`}
          />
          {revBadge ? (
            <StatusBadge
              status={revBadge.status}
              label={
                revision?.isCurrent
                  ? "Current plan"
                  : revBadge.label
              }
            />
          ) : null}
          {editability ? (
            <StatusBadge
              status={editability.editable ? "in-progress" : "archived"}
              label={editability.summary}
              size="compact"
            />
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Planning period
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {formatPiDateRange(startDate, endDate)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Active plan
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
            {revision
              ? planIdentityLabel(revision)
              : "Current plan"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Teams
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {teamCount != null ? String(teamCount) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Available
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {formatHours(capacity?.availableHours ?? null)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Committed
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {formatHours(capacity?.committedHours ?? null)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Remaining
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {formatHours(capacity?.remainingHours ?? null)}
          </dd>
        </div>
      </dl>

      {capacity ? (
        <section
          aria-labelledby="planning-capacity-summary"
          className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2
                id="planning-capacity-summary"
                className="text-sm font-semibold text-[var(--ink)]"
              >
                Capacity & readiness
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {readinessSummaryLabel(capacity)}
                {capacity.utilizationPercent != null
                  ? ` · Utilization ${capacity.utilizationPercent}%`
                  : ""}
              </p>
            </div>
            <div className="w-full max-w-sm shrink-0">
              <CapacityBar
                available={capacity.availableHours ?? 0}
                committed={capacity.committedHours}
                unavailable={capacityUnavailable}
                showPercent
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {capacityHref ? (
              <Link
                href={capacityHref}
                className="inline-flex min-h-11 items-center text-[#087f78] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Open capacity detail
              </Link>
            ) : null}
            {compareHref ? (
              <Link
                href={compareHref}
                className="inline-flex min-h-11 items-center text-[#087f78] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Compare scenarios
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {editability ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          {editability.detail}
        </p>
      ) : null}
    </header>
  );
}

export function CapacityKpiStrip({
  capacity,
}: {
  capacity: CapacityRollup;
}) {
  const cells = [
    {
      label: "Available",
      value: formatHours(capacity.availableHours),
      hint: `${capacity.teamSlotCount} team slots`,
    },
    {
      label: "Committed",
      value: formatHours(capacity.committedHours),
      hint:
        capacity.utilizationPercent != null
          ? `${capacity.utilizationPercent}% utilized`
          : "Utilization n/a",
    },
    {
      label: "Remaining",
      value: formatHours(capacity.remainingHours),
      hint: "Available − committed",
    },
    {
      label: "Overloaded",
      value: String(capacity.overloadSlots),
      hint:
        capacity.overloadSlots > 0
          ? "Needs attention"
          : "None",
    },
    {
      label: "Blocker conflicts",
      value: String(capacity.blockerConflictCount),
      hint:
        capacity.blockerConflictCount > 0
          ? "Review before apply"
          : "Clear",
    },
  ];

  return (
    <section
      aria-labelledby="capacity-kpi-strip"
      className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      <h2 id="capacity-kpi-strip" className="sr-only">
        Capacity summary
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
          <p className="mt-1 text-xs text-[var(--muted)]">{cell.hint}</p>
        </div>
      ))}
    </section>
  );
}
