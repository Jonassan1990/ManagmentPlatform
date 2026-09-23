/**
 * Central capacity policy for PI Planning.
 *
 * Design: canonical capacity unit = hours (Decimal/number). Never mix story
 * points into utilization math. Multi-team capacity uses membership
 * allocationPercent so a resource is not double-counted across teams.
 *
 * ADR (forthcoming): capacity hours + membership percent model.
 */

export const CAPACITY_THRESHOLDS = {
  /** utilization > overload → TEAM_OVERLOAD / RESOURCE_OVERLOAD */
  overload: 1.0,
  /** utilization ≥ nearCapacity → warning / near-capacity indicator */
  nearCapacity: 0.85,
  /** utilization < underAllocation → optional info (not MVP blocker) */
  underAllocation: 0.5,
} as const;

export type DecimalLike = number | string | { toString(): string };

export function toHoursNumber(value: DecimalLike | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** Inclusive calendar weeks between start and end (fractional via ms / 7d). */
export function weeksBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  // Inclusive: add one day so a 7-day span counts as ~1 week, not 6/7.
  const days = ms / (1000 * 60 * 60 * 24) + 1;
  return days / 7;
}

export type MembershipCapacityInput = {
  capacityHoursPerWeek: DecimalLike | null | undefined;
  allocationPercent: DecimalLike | null | undefined;
  /** Optional override (e.g. leave factor); default 1.0 */
  availabilityFactor?: number;
};

/**
 * Effective capacity for one resource on one team over an iteration window.
 * Formula: capacityHoursPerWeek * (allocationPercent/100) * weeks * availabilityFactor
 * Then apply optional availability override / reduction from ResourceAvailability.
 */
export function effectiveResourceCapacity(params: {
  capacityHoursPerWeek: DecimalLike | null | undefined;
  allocationPercent?: DecimalLike | null | undefined;
  startDate: Date;
  endDate: Date;
  availabilityFactor?: number;
  /** When set, replaces derived weekly capacity for the iteration. */
  availableHoursOverride?: DecimalLike | null | undefined;
  reductionHours?: DecimalLike | null | undefined;
}): number {
  const weeks = weeksBetween(params.startDate, params.endDate);
  const percent = toHoursNumber(params.allocationPercent ?? 100);
  const factor = params.availabilityFactor ?? 1;
  let base: number;
  if (
    params.availableHoursOverride != null &&
    params.availableHoursOverride !== ""
  ) {
    base = toHoursNumber(params.availableHoursOverride);
  } else {
    const weekly = toHoursNumber(params.capacityHoursPerWeek);
    base = weekly * (percent / 100) * weeks * factor;
  }
  const reduction = toHoursNumber(params.reductionHours ?? 0);
  return Math.max(0, base - reduction);
}

export type TeamMemberCapacity = MembershipCapacityInput & {
  resourceId: string;
  startDate: Date;
  endDate: Date;
  availableHoursOverride?: DecimalLike | null;
  reductionHours?: DecimalLike | null;
};

/** Sum of effective capacities for all members of a team in an iteration. */
export function teamCapacity(members: TeamMemberCapacity[]): number {
  return members.reduce(
    (sum, m) =>
      sum +
      effectiveResourceCapacity({
        capacityHoursPerWeek: m.capacityHoursPerWeek,
        allocationPercent: m.allocationPercent,
        startDate: m.startDate,
        endDate: m.endDate,
        availabilityFactor: m.availabilityFactor,
        availableHoursOverride: m.availableHoursOverride,
        reductionHours: m.reductionHours,
      }),
    0,
  );
}

export function utilization(
  plannedLoadHours: number,
  effectiveCapacityHours: number,
): number | null {
  if (effectiveCapacityHours <= 0) {
    return plannedLoadHours > 0 ? Number.POSITIVE_INFINITY : null;
  }
  return plannedLoadHours / effectiveCapacityHours;
}

export function isOverloaded(
  util: number | null,
  threshold = CAPACITY_THRESHOLDS.overload,
): boolean {
  if (util == null) return false;
  return util > threshold;
}

export function isNearCapacity(
  util: number | null,
  near = CAPACITY_THRESHOLDS.nearCapacity,
  overload = CAPACITY_THRESHOLDS.overload,
): boolean {
  if (util == null) return false;
  return util >= near && util <= overload;
}

export function utilizationBand(
  util: number | null,
): "none" | "under" | "ok" | "near" | "overload" {
  if (util == null) return "none";
  if (isOverloaded(util)) return "overload";
  if (isNearCapacity(util)) return "near";
  if (util < CAPACITY_THRESHOLDS.underAllocation) return "under";
  return "ok";
}

/**
 * Validate that allocation percents for active memberships of one resource
 * sum to ≤ 100. Call on assign/update membership.
 */
export function assertAllocationPercentsWithinLimit(
  percents: DecimalLike[],
  limit = 100,
): { ok: true } | { ok: false; total: number; limit: number } {
  const total = percents.reduce<number>(
    (s, p) => s + toHoursNumber(p),
    0,
  );
  // Allow tiny floating error
  if (total > limit + 0.001) {
    return { ok: false, total, limit };
  }
  return { ok: true };
}
