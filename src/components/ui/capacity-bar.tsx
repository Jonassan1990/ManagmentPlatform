import { cn } from "@/components/ui/cn";

export type CapacityBarProps = {
  /** Total available capacity (hours). Ignored when unavailable. */
  available: number;
  /** Committed / allocated capacity (hours). */
  committed: number;
  /** When true, show unavailable chrome — no invented capacity. */
  unavailable?: boolean;
  /** Display unit label, default "h". */
  unit?: string;
  /** Show percentage of committed/available when available > 0. */
  showPercent?: boolean;
  className?: string;
  /** Optional id for aria labelling. */
  id?: string;
};

export type CapacityBarDerived = {
  remaining: number;
  overload: boolean;
  utilization: number | null;
  fillRatio: number;
  label: string;
};

/** Pure derivation for tests — component does not invent domain formulas. */
export function deriveCapacityBar(input: {
  available: number;
  committed: number;
  unavailable?: boolean;
  unit?: string;
  showPercent?: boolean;
}): CapacityBarDerived {
  const unit = input.unit ?? "h";
  if (input.unavailable) {
    return {
      remaining: 0,
      overload: false,
      utilization: null,
      fillRatio: 0,
      label: "Capacity unavailable",
    };
  }

  const available = Number.isFinite(input.available)
    ? Math.max(0, input.available)
    : 0;
  const committed = Number.isFinite(input.committed) ? input.committed : 0;
  const remaining = available - committed;
  const overload = committed > available && available >= 0;
  const utilization =
    available > 0 ? Math.round((committed / available) * 100) : null;
  const fillRatio =
    available > 0
      ? Math.min(1, Math.max(0, committed / available))
      : committed > 0
        ? 1
        : 0;

  const parts = [
    `Available ${formatNum(available)}${unit}`,
    `committed ${formatNum(committed)}${unit}`,
    overload
      ? `overload ${formatNum(committed - available)}${unit}`
      : `remaining ${formatNum(remaining)}${unit}`,
  ];
  if (input.showPercent && utilization !== null) {
    parts.push(`${utilization}% utilized`);
  }

  return {
    remaining,
    overload,
    utilization,
    fillRatio,
    label: parts.join(", "),
  };
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Presentational capacity visualization. Values must come from application services.
 */
export function CapacityBar({
  available,
  committed,
  unavailable = false,
  unit = "h",
  showPercent = true,
  className,
  id,
}: CapacityBarProps) {
  const derived = deriveCapacityBar({
    available,
    committed,
    unavailable,
    unit,
    showPercent,
  });

  if (unavailable) {
    return (
      <div
        id={id}
        className={cn("space-y-1", className)}
        role="img"
        aria-label={derived.label}
      >
        <div className="h-2.5 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--status-unavailable-bg)] border border-[var(--status-unavailable-border)]">
          <div className="h-full w-full bg-[repeating-linear-gradient(135deg,var(--status-unavailable-border),var(--status-unavailable-border)_4px,transparent_4px,transparent_8px)] opacity-60" />
        </div>
        <p className="text-xs text-[var(--status-unavailable-fg)]">
          Unavailable
        </p>
      </div>
    );
  }

  const fillColor = derived.overload
    ? "var(--color-error)"
    : derived.utilization !== null && derived.utilization >= 85
      ? "var(--color-warning)"
      : "var(--color-accent)";

  return (
    <div
      id={id}
      className={cn("space-y-1", className)}
      role="img"
      aria-label={derived.label}
    >
      <div className="h-2.5 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-bg)] border border-[var(--color-border)]">
        <div
          className="h-full transition-[width] duration-[var(--transition-normal)]"
          style={{
            width: `${Math.round(derived.fillRatio * 100)}%`,
            background: fillColor,
          }}
        />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
        <span>
          {formatNum(committed)}
          {unit} / {formatNum(Math.max(0, available))}
          {unit}
          {showPercent && derived.utilization !== null
            ? ` · ${derived.utilization}%`
            : null}
        </span>
        <span
          className={
            derived.overload
              ? "font-semibold text-[var(--color-error)]"
              : undefined
          }
        >
          {derived.overload
            ? `Overload +${formatNum(committed - Math.max(0, available))}${unit}`
            : `Remaining ${formatNum(derived.remaining)}${unit}`}
        </span>
      </div>
    </div>
  );
}
