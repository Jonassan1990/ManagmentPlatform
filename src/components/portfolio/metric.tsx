import Link from "next/link";
import type { PortfolioMetric } from "@/modules/portfolio/domain/types";

/** Format an available count; never treat unavailable as zero. */
export function metricNumber(
  metric: PortfolioMetric<number> | undefined,
): { kind: "value"; value: number } | { kind: "unavailable"; reason: string } {
  if (!metric) {
    return { kind: "unavailable", reason: "Metric was not returned." };
  }
  if (!metric.available) {
    return { kind: "unavailable", reason: metric.reason };
  }
  return { kind: "value", value: metric.value };
}

export function MetricFigure({
  metric,
  emptyLabel = "0",
}: {
  metric: PortfolioMetric<number> | undefined;
  emptyLabel?: string;
}) {
  const resolved = metricNumber(metric);
  if (resolved.kind === "unavailable") {
    return (
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--muted)]">
        <span className="sr-only">Unavailable: {resolved.reason}</span>
        <span aria-hidden="true">Unavailable</span>
      </p>
    );
  }
  return (
    <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tabular-nums">
      {resolved.value === 0 ? emptyLabel : resolved.value}
    </p>
  );
}

export function UnavailableNotice({ reason }: { reason: string }) {
  return (
    <p
      role="status"
      className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--muted)]"
    >
      Unavailable — {reason}
    </p>
  );
}

export function DistributionBar({
  label,
  value,
  max,
  href,
}: {
  label: string;
  value: number;
  max: number;
  href?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const bar = (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate text-[var(--muted)]">{label}</span>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--line)]"
        role="img"
        aria-label={`${label}: ${value} (${pct}% of total)`}
      >
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right tabular-nums font-medium">{value}</span>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-sm py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        {bar}
      </Link>
    );
  }
  return <div className="py-1">{bar}</div>;
}

export const STAGE_LABELS: Record<string, string> = {
  DEMAND: "Demand",
  REQUIREMENTS: "Requirements",
  PRE_STUDY: "Pre-study",
  POC: "PoC",
  PILOT: "Pilot",
  PROJECT: "Project",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  onHold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const CAPACITY_BAND_LABELS: Record<string, string> = {
  none: "No load",
  under: "Under capacity",
  ok: "Within capacity",
  near: "Near capacity",
  overload: "Overloaded",
};
