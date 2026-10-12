/**
 * Portfolio cost rollup — sums Project money fields already stored in domain.
 * Missing/null costs are excluded from each total (never coerced to 0 invent).
 */

export type ProjectCostFields = {
  estimatedCost: unknown;
  plannedCost: unknown;
  forecastCost: unknown;
  actualCost: unknown;
};

export type PortfolioCostRollup = {
  /** Projects considered (ACTIVE / ON_HOLD in authorized scope). */
  projectsInScope: number;
  /** Projects that have at least one non-null cost field. */
  projectsWithAnyCost: number;
  estimatedTotal: number | null;
  plannedTotal: number | null;
  forecastTotal: number | null;
  actualTotal: number | null;
  /**
   * Forecast − planned when both present; positive = over plan.
   * Null when either side missing.
   */
  forecastVsPlannedDelta: number | null;
  note: string;
};

function toMoneyNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    try {
      const n = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function sumField(
  rows: ProjectCostFields[],
  key: keyof ProjectCostFields,
): number | null {
  let sum = 0;
  let seen = 0;
  for (const row of rows) {
    const n = toMoneyNumber(row[key]);
    if (n == null) continue;
    sum += n;
    seen += 1;
  }
  return seen === 0 ? null : Math.round(sum * 100) / 100;
}

export function rollupProjectCosts(
  rows: ProjectCostFields[],
): PortfolioCostRollup {
  const projectsWithAnyCost = rows.filter((r) =>
    [r.estimatedCost, r.plannedCost, r.forecastCost, r.actualCost].some(
      (v) => toMoneyNumber(v) != null,
    ),
  ).length;

  const plannedTotal = sumField(rows, "plannedCost");
  const forecastTotal = sumField(rows, "forecastCost");

  return {
    projectsInScope: rows.length,
    projectsWithAnyCost,
    estimatedTotal: sumField(rows, "estimatedCost"),
    plannedTotal,
    forecastTotal,
    actualTotal: sumField(rows, "actualCost"),
    forecastVsPlannedDelta:
      plannedTotal != null && forecastTotal != null
        ? Math.round((forecastTotal - plannedTotal) * 100) / 100
        : null,
    note:
      "Sums Project estimated/planned/forecast/actual money fields in authorized scope. Null fields are omitted — not treated as zero.",
  };
}

export function formatMoneyAmount(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}
