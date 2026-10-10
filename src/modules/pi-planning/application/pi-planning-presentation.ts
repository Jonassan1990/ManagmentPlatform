/**
 * M5D-A — PI Planning workspace presentation helpers.
 * Label / copy mapping only. No capacity formulas — aggregates use service hours.
 */
import type { StatusBadgeMapping } from "@/components/ui/status-adapters";
import {
  mapPiStatusBadge,
  mapScenarioStatusBadge,
} from "@/components/ui/status-adapters";

export type PlanningRevisionKind = "current_plan" | "scenario";

export function formatPiDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  const s = toDateLabel(start);
  const e = toDateLabel(end);
  if (!s && !e) return "Dates not set";
  if (s && e) return `${s} → ${e}`;
  return s ?? e ?? "Dates not set";
}

function toDateLabel(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function planIdentityLabel(input: {
  isCurrent: boolean;
  label?: string | null;
  key?: string | null;
}): string {
  if (input.isCurrent) return "Current plan";
  const name = input.label?.trim() || input.key?.trim();
  return name ? `Scenario · ${name}` : "Scenario";
}

export function scenarioChipLabel(input: {
  isCurrent: boolean;
  label?: string | null;
  key?: string | null;
}): string {
  if (input.isCurrent) return "Current plan";
  return input.label?.trim() || input.key?.trim() || "Scenario";
}

export function describeEditability(input: {
  isCurrent: boolean;
  status: string;
  canAllocate?: boolean;
}): {
  editable: boolean;
  summary: string;
  detail: string;
} {
  if (input.canAllocate === false) {
    return {
      editable: false,
      summary: "View only",
      detail:
        "You can inspect the plan and switch scenarios. Allocation edits require planning permission.",
    };
  }
  if (input.isCurrent) {
    return {
      editable: true,
      summary: "Editable",
      detail:
        "Allocations update the current plan. Create a scenario to explore alternatives safely.",
    };
  }
  if (input.status === "DRAFT") {
    return {
      editable: true,
      summary: "Editable draft",
      detail:
        "Edits stay on this scenario until you apply it to the current plan in Review.",
    };
  }
  return {
    editable: false,
    summary: "Read-only scenario",
    detail:
      "This scenario is not a draft. Reopen a draft to edit, or switch to the current plan. Selected or applied is not plan approval.",
  };
}

export type CapacityRollup = {
  availableHours: number | null;
  committedHours: number;
  remainingHours: number | null;
  utilizationPercent: number | null;
  overloadSlots: number;
  teamSlotCount: number;
  blockerConflictCount: number;
};

/** Roll up existing capacity/conflict service rows — no new utilization engine. */
export function summarizeCapacityFromViews(input: {
  teams: Array<{
    effectiveCapacityHours: number;
    plannedLoadHours: number;
    band: string;
  }>;
  blockerConflictCount?: number;
}): CapacityRollup {
  const teamSlotCount = input.teams.length;
  const availableHours =
    teamSlotCount === 0
      ? null
      : input.teams.reduce((sum, t) => sum + t.effectiveCapacityHours, 0);
  const committedHours = input.teams.reduce(
    (sum, t) => sum + t.plannedLoadHours,
    0,
  );
  const remainingHours =
    availableHours == null ? null : availableHours - committedHours;
  const utilizationPercent =
    availableHours == null || availableHours <= 0
      ? null
      : Math.round((committedHours / availableHours) * 1000) / 10;
  return {
    availableHours,
    committedHours,
    remainingHours,
    utilizationPercent,
    overloadSlots: input.teams.filter((t) => t.band === "overload").length,
    teamSlotCount,
    blockerConflictCount: input.blockerConflictCount ?? 0,
  };
}

export function mapPiLifecycleBadge(status: string): StatusBadgeMapping {
  return mapPiStatusBadge(status);
}

export function mapPlanRevisionBadge(input: {
  isCurrent: boolean;
  status: string;
  archivedAt?: Date | string | null;
}): StatusBadgeMapping {
  if (input.isCurrent) return mapScenarioStatusBadge("ACTIVE_PLAN");
  if (input.archivedAt || input.status === "ARCHIVED") {
    return mapScenarioStatusBadge("ARCHIVED");
  }
  return mapScenarioStatusBadge(input.status);
}

export function readinessSummaryLabel(input: {
  overloadSlots: number;
  blockerConflictCount: number;
  teamSlotCount: number;
  availableHours: number | null;
}): string {
  if (input.teamSlotCount === 0 || input.availableHours == null) {
    return "Capacity unavailable — add participating teams and availability";
  }
  if (input.blockerConflictCount > 0) {
    return `${input.blockerConflictCount} blocker conflict(s) — resolve before applying a scenario`;
  }
  if (input.overloadSlots > 0) {
    return `${input.overloadSlots} overloaded team×iteration slot(s)`;
  }
  return "No overload or blocker conflicts on this view";
}
