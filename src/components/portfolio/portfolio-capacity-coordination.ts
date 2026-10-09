/**
 * M4E-C presentation helpers — conflict explanations, available-capacity
 * departments, and PlanningDependency display rows.
 * No capacity formulas; no new AuthZ; no invented dependency types.
 */

import type {
  PortfolioCapacityHours,
  PortfolioPiConflictRow,
  PortfolioPiDepartmentCapacityRow,
  PortfolioPiProjectCommitmentRow,
  PortfolioPiResourceCapacityRow,
  PortfolioPiTeamCapacityRow,
} from "@/modules/portfolio/domain/types";
import { capacityStatusLabel, conflictSubjectLabel } from "./portfolio-capacity-model";

export type CapacityDependencyRow = {
  id: string;
  type: string;
  status: string;
  criticality: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  ownerName: string | null;
  neededByDate: string | null;
  description: string | null;
  sourceLabel: string;
  targetLabel: string;
};

export type CapacityDependenciesView =
  | {
      state: "ready";
      rows: CapacityDependencyRow[];
      openCount: number;
      criticalCount: number;
    }
  | {
      state: "unavailable";
      reason: string;
      /** Scoped counts from portfolio snapshot when list is unauthorized. */
      openCount?: number;
      criticalCount?: number;
    };

export type ConflictExplanation = {
  type: string;
  severity: PortfolioPiConflictRow["severity"];
  headline: string;
  what: string;
  affected: string;
  iterationHint: string | null;
  actionLabel: string;
  actionKind: "expand_team" | "open_dependencies" | "open_pi_board" | "none";
  teamId?: string;
  departmentId?: string;
};

export type AvailableDepartmentRow = {
  departmentId: string;
  departmentName: string;
  remainingHours: number;
  availableHours: number;
  committedHours: number;
  utilization: number | null;
  band: PortfolioCapacityHours["band"];
  statusLabel: string;
};

const CRITICALITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function mapPlanningDependencyRows(
  deps: Array<{
    id: string;
    type: string;
    status: string;
    criticality: string;
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    ownerName: string | null;
    neededByDate: Date | string | null;
    description: string | null;
  }>,
  projectCommitments: PortfolioPiProjectCommitmentRow[],
): CapacityDependencyRow[] {
  const projectLabel = new Map(
    projectCommitments.map((p) => [
      p.projectId,
      `${p.referenceKey} · ${p.name}`,
    ]),
  );

  return deps
    .map((d) => {
      const neededByDate =
        d.neededByDate == null
          ? null
          : typeof d.neededByDate === "string"
            ? d.neededByDate
            : d.neededByDate.toISOString();
      return {
        id: d.id,
        type: d.type,
        status: d.status,
        criticality: d.criticality,
        sourceType: d.sourceType,
        sourceId: d.sourceId,
        targetType: d.targetType,
        targetId: d.targetId,
        ownerName: d.ownerName,
        neededByDate,
        description: d.description,
        sourceLabel: subjectLabel(
          d.sourceType,
          d.sourceId,
          projectLabel,
        ),
        targetLabel: subjectLabel(
          d.targetType,
          d.targetId,
          projectLabel,
        ),
      };
    })
    .sort((a, b) => {
      const openFirst =
        Number(a.status !== "OPEN") - Number(b.status !== "OPEN");
      if (openFirst !== 0) return openFirst;
      return (
        (CRITICALITY_RANK[a.criticality] ?? 9) -
        (CRITICALITY_RANK[b.criticality] ?? 9)
      );
    });
}

function subjectLabel(
  type: string,
  id: string,
  projectLabel: Map<string, string>,
): string {
  if (type === "PROJECT") {
    return projectLabel.get(id) ?? `Project ${id.slice(0, 8)}…`;
  }
  if (type === "WORK_ITEM") {
    return `Work item ${id.slice(0, 8)}…`;
  }
  return `${type} ${id.slice(0, 8)}…`;
}

export function summarizeDependencyCounts(
  rows: CapacityDependencyRow[],
): { openCount: number; criticalCount: number } {
  const open = rows.filter((r) => r.status === "OPEN");
  return {
    openCount: open.length,
    criticalCount: open.filter(
      (r) => r.criticality === "CRITICAL" || r.criticality === "HIGH",
    ).length,
  };
}

/** Departments with remaining capacity — from returned M2E rows only. */
export function availableCapacityDepartments(
  departments: PortfolioPiDepartmentCapacityRow[],
): AvailableDepartmentRow[] {
  return departments
    .filter(
      (d) =>
        d.remainingHours > 0 &&
        (d.band === "under" || d.band === "ok" || d.band === "none"),
    )
    .map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.departmentName,
      remainingHours: d.remainingHours,
      availableHours: d.availableHours,
      committedHours: d.committedHours,
      utilization: d.utilization,
      band: d.band,
      statusLabel: capacityStatusLabel(d.band),
    }))
    .sort((a, b) => b.remainingHours - a.remainingHours);
}

export function explainConflict(
  conflict: PortfolioPiConflictRow,
  teams: PortfolioPiTeamCapacityRow[],
  resources: PortfolioPiResourceCapacityRow[],
): ConflictExplanation {
  const affected = conflictSubjectLabel(conflict, teams, resources);
  const iterationHint = iterationHintFor(conflict, teams, resources);

  if (conflict.type === "TEAM_OVERLOAD" || conflict.subjectType === "TEAM") {
    const team = teams.find((t) => t.teamId === conflict.subjectId);
    return {
      type: conflict.type,
      severity: conflict.severity,
      headline: conflict.message,
      what: "Team committed hours exceed available capacity for an iteration.",
      affected,
      iterationHint:
        iterationHint ??
        (team ? `${team.iterationName}` : null),
      actionLabel: "Inspect team capacity",
      actionKind: "expand_team",
      teamId: conflict.subjectId,
      departmentId: team?.departmentId,
    };
  }

  if (
    conflict.type === "RESOURCE_OVERLOAD" ||
    conflict.subjectType === "RESOURCE"
  ) {
    const resource = resources.find(
      (r) => r.resourceId === conflict.subjectId,
    );
    const team = resource
      ? teams.find((t) => t.teamId === resource.teamId)
      : undefined;
    return {
      type: conflict.type,
      severity: conflict.severity,
      headline: conflict.message,
      what: "A Resource’s committed load exceeds their available hours (membership % already applied by capacity-policy).",
      affected,
      iterationHint,
      actionLabel: team ? "Inspect team capacity" : "Open PI board",
      actionKind: team ? "expand_team" : "open_pi_board",
      teamId: team?.teamId,
      departmentId: team?.departmentId,
    };
  }

  if (
    conflict.type === "DEPENDENCY_TIMING" ||
    conflict.subjectType === "DEPENDENCY"
  ) {
    return {
      type: conflict.type,
      severity: conflict.severity,
      headline: conflict.message,
      what: "Successor work is scheduled before its predecessor on a PlanningDependency.",
      affected: `Dependency ${conflict.subjectId.slice(0, 8)}…`,
      iterationHint: null,
      actionLabel: "Open PI dependencies",
      actionKind: "open_dependencies",
    };
  }

  if (
    conflict.type === "MILESTONE_TIMING" ||
    conflict.type.startsWith("OUTSIDE_")
  ) {
    return {
      type: conflict.type,
      severity: conflict.severity,
      headline: conflict.message,
      what: "A planning date or milestone falls outside the allowed PI/project/iteration window.",
      affected,
      iterationHint,
      actionLabel: "Open PI board",
      actionKind: "open_pi_board",
    };
  }

  return {
    type: conflict.type,
    severity: conflict.severity,
    headline: conflict.message,
    what: "Planning conflict reported by the existing conflict engine.",
    affected,
    iterationHint,
    actionLabel: "Open PI board",
    actionKind: "open_pi_board",
  };
}

function iterationHintFor(
  conflict: PortfolioPiConflictRow,
  teams: PortfolioPiTeamCapacityRow[],
  resources: PortfolioPiResourceCapacityRow[],
): string | null {
  const related = conflict.relatedIds ?? [];
  for (const id of related) {
    const team = teams.find((t) => t.iterationId === id);
    if (team) return team.iterationName;
  }
  if (conflict.subjectType === "TEAM") {
    const team = teams.find((t) => t.teamId === conflict.subjectId);
    return team?.iterationName ?? null;
  }
  if (conflict.subjectType === "RESOURCE") {
    const resource = resources.find(
      (r) => r.resourceId === conflict.subjectId,
    );
    if (!resource) return null;
    const team = teams.find(
      (t) =>
        t.teamId === resource.teamId && t.iterationId === resource.iterationId,
    );
    return team?.iterationName ?? null;
  }
  return null;
}

export function isPiViewForbiddenMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("missing pi view") ||
    m.includes("pi view permission") ||
    m.includes("forbidden")
  );
}

export function criticalityToBadge(
  criticality: string,
): "blocked" | "at-risk" | "pending" | "completed" {
  if (criticality === "CRITICAL" || criticality === "HIGH") return "blocked";
  if (criticality === "MEDIUM") return "at-risk";
  if (criticality === "LOW") return "pending";
  return "completed";
}

export function dependencyStatusToBadge(
  status: string,
): "in-progress" | "completed" | "approved" | "cancelled" {
  if (status === "OPEN") return "in-progress";
  if (status === "RESOLVED") return "completed";
  if (status === "ACCEPTED") return "approved";
  return "cancelled";
}

export function formatNeededBy(iso: string | null): string {
  if (!iso) return "No required-by date";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
