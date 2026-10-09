/**
 * M2E-B display helpers — pure transforms over M2E-A contracts.
 * No capacity formulas; hours come from PortfolioPiCapacityQueryService.
 */

import {
  CAPACITY_THRESHOLDS,
  utilizationBand,
} from "@/modules/pi-planning/application/capacity-policy";
import type {
  PortfolioCapacityHours,
  PortfolioPiConflictRow,
  PortfolioPiDepartmentCapacityRow,
  PortfolioPiResourceCapacityRow,
  PortfolioPiTeamCapacityRow,
} from "@/modules/portfolio/domain/types";

function hoursBand(
  availableHours: number,
  committedHours: number,
): {
  remainingHours: number;
  utilization: number | null;
  band: PortfolioCapacityHours["band"];
} {
  const remainingHours = availableHours - committedHours;
  const utilization =
    availableHours > 0
      ? committedHours / availableHours
      : committedHours > 0
        ? Number.POSITIVE_INFINITY
        : null;
  return {
    remainingHours,
    utilization,
    band: utilizationBand(utilization),
  };
}

/** Exported for tests — thresholds must match capacity-policy. */
export const DISPLAY_CAPACITY_THRESHOLDS = CAPACITY_THRESHOLDS;

export type AggregatedResourceRow = {
  resourceId: string;
  resourceName: string;
  teamId: string;
  teamName: string;
  departmentId: string;
  availableHours: number;
  committedHours: number;
  remainingHours: number;
  utilization: number | null;
  band: PortfolioCapacityHours["band"];
  /** Membership % is not project commitment — surfaced for transparency. */
  membershipAllocationPercent: number;
};

export type DepartmentCardModel = {
  departmentId: string;
  departmentName: string;
  availableHours: number;
  committedHours: number;
  remainingHours: number;
  utilization: number | null;
  band: PortfolioCapacityHours["band"];
  teamCount: number;
  resourceCount: number;
  overloadCount: number;
  teams: Array<{
    teamId: string;
    teamName: string;
    availableHours: number;
    committedHours: number;
    remainingHours: number;
    utilization: number | null;
    band: PortfolioCapacityHours["band"];
    resources: AggregatedResourceRow[];
  }>;
};

export function formatCapacityHours(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatUtilizationPct(util: number | null): string {
  if (util == null) return "—";
  if (util === Number.POSITIVE_INFINITY) return "∞";
  if (!Number.isFinite(util)) return "—";
  return `${Math.round(util * 100)}%`;
}

export function utilizationBarPercent(util: number | null): number {
  if (util == null || !Number.isFinite(util)) return 0;
  if (util === Number.POSITIVE_INFINITY) return 100;
  return Math.min(120, Math.max(0, util * 100));
}

/** Track fill capped at 100% of track; overload still uses over styling. */
export function utilTrackWidthPct(util: number | null): number {
  return Math.min(100, utilizationBarPercent(util) / 1.2);
}

export function bandTone(
  band: PortfolioCapacityHours["band"],
): "ok" | "high" | "over" | "none" {
  if (band === "overload") return "over";
  if (band === "near") return "high";
  if (band === "ok" || band === "under") return "ok";
  return "none";
}

export function capacityStatusLabel(
  band: PortfolioCapacityHours["band"],
): string {
  switch (band) {
    case "overload":
      return "Over capacity";
    case "near":
      return "Near limit";
    case "under":
      return "Underutilized";
    case "ok":
      return "Within capacity";
    default:
      return "No load";
  }
}

/**
 * Aggregate resource×iteration rows to resource×team for department cards.
 * Sums hours only — does not recompute capacity-policy.
 */
export function aggregateResourcesByTeam(
  resources: PortfolioPiResourceCapacityRow[],
  teams: PortfolioPiTeamCapacityRow[],
): AggregatedResourceRow[] {
  const teamMeta = new Map(
    teams.map((t) => [
      t.teamId,
      { name: t.teamName, departmentId: t.departmentId },
    ]),
  );
  const map = new Map<string, AggregatedResourceRow>();
  for (const r of resources) {
    const key = `${r.resourceId}:${r.teamId}`;
    const meta = teamMeta.get(r.teamId);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        resourceId: r.resourceId,
        resourceName: r.resourceName,
        teamId: r.teamId,
        teamName: meta?.name ?? r.teamId,
        departmentId: meta?.departmentId ?? "",
        availableHours: r.availableHours,
        committedHours: r.committedHours,
        remainingHours: r.remainingHours,
        utilization: r.utilization,
        band: r.band,
        membershipAllocationPercent: r.membershipAllocationPercent,
      });
      continue;
    }
    existing.availableHours += r.availableHours;
    existing.committedHours += r.committedHours;
    const derived = hoursBand(existing.availableHours, existing.committedHours);
    existing.remainingHours = derived.remainingHours;
    existing.utilization = derived.utilization;
    existing.band = derived.band;
  }
  return [...map.values()].sort((a, b) =>
    a.resourceName.localeCompare(b.resourceName),
  );
}

/**
 * Aggregate team×iteration rows to team-level for expansion.
 */
export function aggregateTeams(
  teams: PortfolioPiTeamCapacityRow[],
): Array<{
  teamId: string;
  teamName: string;
  departmentId: string;
  availableHours: number;
  committedHours: number;
  remainingHours: number;
  utilization: number | null;
  band: PortfolioCapacityHours["band"];
}> {
  const map = new Map<
    string,
    {
      teamId: string;
      teamName: string;
      departmentId: string;
      availableHours: number;
      committedHours: number;
    }
  >();
  for (const t of teams) {
    const row = map.get(t.teamId) ?? {
      teamId: t.teamId,
      teamName: t.teamName,
      departmentId: t.departmentId,
      availableHours: 0,
      committedHours: 0,
    };
    row.availableHours += t.availableHours;
    row.committedHours += t.committedHours;
    map.set(t.teamId, row);
  }
  return [...map.values()]
    .map((t) => ({ ...t, ...hoursBand(t.availableHours, t.committedHours) }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName));
}

export function buildDepartmentCards(
  departments: PortfolioPiDepartmentCapacityRow[],
  teams: PortfolioPiTeamCapacityRow[],
  resources: PortfolioPiResourceCapacityRow[],
): DepartmentCardModel[] {
  const aggregatedResources = aggregateResourcesByTeam(resources, teams);
  const aggregatedTeams = aggregateTeams(teams);

  return departments
    .map((d) => {
      const deptTeams = aggregatedTeams.filter(
        (t) => t.departmentId === d.departmentId,
      );
      const deptResources = aggregatedResources.filter(
        (r) => r.departmentId === d.departmentId,
      );
      const teamsWithResources = deptTeams.map((t) => ({
        ...t,
        resources: deptResources.filter((r) => r.teamId === t.teamId),
      }));
      return {
        departmentId: d.departmentId,
        departmentName: d.departmentName,
        availableHours: d.availableHours,
        committedHours: d.committedHours,
        remainingHours: d.remainingHours,
        utilization: d.utilization,
        band: d.band,
        teamCount: deptTeams.length,
        resourceCount: deptResources.length,
        overloadCount: deptTeams.filter((t) => t.band === "overload").length,
        teams: teamsWithResources,
      };
    })
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

export function filterDepartmentCards(
  cards: DepartmentCardModel[],
  opts: {
    search?: string;
    teamId?: string;
    overloadedOnly?: boolean;
  },
): DepartmentCardModel[] {
  const q = opts.search?.trim().toLowerCase() ?? "";
  return cards
    .map((card) => {
      let teams = card.teams;
      if (opts.teamId) {
        teams = teams.filter((t) => t.teamId === opts.teamId);
      }
      if (opts.overloadedOnly) {
        teams = teams
          .map((t) => ({
            ...t,
            resources: t.resources.filter((r) => r.band === "overload"),
          }))
          .filter((t) => t.band === "overload" || t.resources.length > 0);
      }
      if (q) {
        const deptMatch = card.departmentName.toLowerCase().includes(q);
        teams = teams
          .map((t) => {
            const teamMatch = t.teamName.toLowerCase().includes(q);
            const resources = t.resources.filter(
              (r) =>
                deptMatch ||
                teamMatch ||
                r.resourceName.toLowerCase().includes(q),
            );
            if (deptMatch || teamMatch) return t;
            return { ...t, resources };
          })
          .filter(
            (t) =>
              deptMatch ||
              t.teamName.toLowerCase().includes(q) ||
              t.resources.length > 0,
          );
      }
      if (teams.length === 0 && (opts.teamId || opts.overloadedOnly || q)) {
        return null;
      }
      const resourceCount = teams.reduce((n, t) => n + t.resources.length, 0);
      return {
        ...card,
        teams,
        teamCount: teams.length,
        resourceCount,
        overloadCount: teams.filter((t) => t.band === "overload").length,
      };
    })
    .filter((c): c is DepartmentCardModel => c != null);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function conflictSubjectLabel(
  conflict: PortfolioPiConflictRow,
  teams: PortfolioPiTeamCapacityRow[],
  resources: PortfolioPiResourceCapacityRow[],
): string {
  if (conflict.subjectType === "TEAM") {
    const t = teams.find((x) => x.teamId === conflict.subjectId);
    return t?.teamName ?? conflict.subjectId;
  }
  if (conflict.subjectType === "RESOURCE") {
    const r = resources.find((x) => x.resourceId === conflict.subjectId);
    return r?.resourceName ?? conflict.subjectId;
  }
  return `${conflict.subjectType} ${conflict.subjectId}`;
}

/**
 * Committed-load segment width for the stacked bar track.
 * Uses available as the 100% scale when > 0; otherwise scales to committed.
 * Does not invent project/workstream shares (M2E-A has no per-resource project segments).
 */
export function committedLoadBarPct(
  availableHours: number,
  committedHours: number,
): { committedPct: number; scale: "available" | "committed" | "empty" } {
  if (availableHours <= 0 && committedHours <= 0) {
    return { committedPct: 0, scale: "empty" };
  }
  if (availableHours <= 0) {
    return { committedPct: 100, scale: "committed" };
  }
  return {
    committedPct: Math.min(100, (committedHours / availableHours) * 100),
    scale: "available",
  };
}
