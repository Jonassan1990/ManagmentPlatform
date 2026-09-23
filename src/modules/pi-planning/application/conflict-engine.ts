/**
 * Pure conflict derivation for PI Planning.
 *
 * MVP: derive on read — no PlanningConflictCache table. Stale overload as
 * "healthy" is worse than recomputing from the current allocation snapshot.
 */

import {
  CAPACITY_THRESHOLDS,
  isOverloaded,
  toHoursNumber,
  utilization,
  type DecimalLike,
} from "./capacity-policy";

export type ConflictSubjectType =
  | "TEAM"
  | "RESOURCE"
  | "WORK_ITEM"
  | "PROJECT"
  | "MILESTONE"
  | "DEPENDENCY"
  | "ALLOCATION"
  | "PI"
  | "ITERATION";

export type DerivedConflict = {
  type:
    | "TEAM_OVERLOAD"
    | "RESOURCE_OVERLOAD"
    | "DEPENDENCY_TIMING"
    | "MILESTONE_TIMING"
    | "OUTSIDE_PROJECT_DATES"
    | "OUTSIDE_PI_DATES"
    | "OUTSIDE_ITERATION_DATES"
    | "RESOURCE_ALLOCATION_CONFLICT";
  severity: "INFO" | "WARNING" | "BLOCKER";
  message: string;
  subjectType: ConflictSubjectType;
  subjectId: string;
  relatedIds?: string[];
  meta?: Record<string, unknown>;
};

export type ConflictSnapshotAllocation = {
  id: string;
  workItemId: string;
  iterationId: string;
  teamId: string;
  resourceId?: string | null;
  plannedHours: DecimalLike;
  workItemProjectId?: string;
  projectPlannedStart?: Date | null;
  projectPlannedEnd?: Date | null;
};

export type ConflictSnapshotIteration = {
  id: string;
  sequence: number;
  startDate: Date;
  endDate: Date;
};

export type ConflictSnapshotTeamCapacity = {
  teamId: string;
  iterationId: string;
  effectiveCapacityHours: number;
  plannedLoadHours: number;
};

export type ConflictSnapshotResourceCapacity = {
  resourceId: string;
  iterationId: string;
  effectiveCapacityHours: number;
  plannedLoadHours: number;
};

export type ConflictSnapshotDependency = {
  id: string;
  type: "BLOCKS" | "DEPENDS_ON" | "RELATED";
  status: string;
  criticality: string;
  sourceType: "WORK_ITEM" | "PROJECT";
  sourceId: string;
  targetType: "WORK_ITEM" | "PROJECT";
  targetId: string;
  /** Iteration sequence of predecessor (source for DEPENDS_ON / BLOCKS). */
  sourceIterationSequence?: number | null;
  /** Iteration sequence of successor (target). */
  targetIterationSequence?: number | null;
};

export type ConflictSnapshotMilestone = {
  id: string;
  projectId: string;
  plannedDate: Date | null;
  status: string;
  criticality: boolean;
};

export type ConflictSnapshot = {
  piId: string;
  piStartDate: Date;
  piEndDate: Date;
  iterations: ConflictSnapshotIteration[];
  allocations: ConflictSnapshotAllocation[];
  teamCapacities: ConflictSnapshotTeamCapacity[];
  resourceCapacities: ConflictSnapshotResourceCapacity[];
  dependencies: ConflictSnapshotDependency[];
  milestones?: ConflictSnapshotMilestone[];
  /** Active membership allocation percents by resource (sum should be ≤ 100). */
  resourceAllocationPercents?: Record<string, number>;
};

export function deriveConflicts(snapshot: ConflictSnapshot): DerivedConflict[] {
  const conflicts: DerivedConflict[] = [];
  const iterationById = new Map(
    snapshot.iterations.map((i) => [i.id, i] as const),
  );

  for (const tc of snapshot.teamCapacities) {
    const util = utilization(tc.plannedLoadHours, tc.effectiveCapacityHours);
    if (isOverloaded(util)) {
      conflicts.push({
        type: "TEAM_OVERLOAD",
        severity: "BLOCKER",
        message: `Team overload in iteration (utilization ${formatUtil(util)})`,
        subjectType: "TEAM",
        subjectId: tc.teamId,
        relatedIds: [tc.iterationId],
        meta: {
          plannedLoadHours: tc.plannedLoadHours,
          effectiveCapacityHours: tc.effectiveCapacityHours,
          utilization: util,
          threshold: CAPACITY_THRESHOLDS.overload,
        },
      });
    } else if (
      util != null &&
      util >= CAPACITY_THRESHOLDS.nearCapacity &&
      util <= CAPACITY_THRESHOLDS.overload
    ) {
      conflicts.push({
        type: "TEAM_OVERLOAD",
        severity: "WARNING",
        message: `Team near capacity in iteration (utilization ${formatUtil(util)})`,
        subjectType: "TEAM",
        subjectId: tc.teamId,
        relatedIds: [tc.iterationId],
        meta: {
          plannedLoadHours: tc.plannedLoadHours,
          effectiveCapacityHours: tc.effectiveCapacityHours,
          utilization: util,
        },
      });
    }
  }

  for (const rc of snapshot.resourceCapacities) {
    const util = utilization(rc.plannedLoadHours, rc.effectiveCapacityHours);
    if (isOverloaded(util)) {
      conflicts.push({
        type: "RESOURCE_OVERLOAD",
        severity: "BLOCKER",
        message: `Resource overload in iteration (utilization ${formatUtil(util)})`,
        subjectType: "RESOURCE",
        subjectId: rc.resourceId,
        relatedIds: [rc.iterationId],
        meta: {
          plannedLoadHours: rc.plannedLoadHours,
          effectiveCapacityHours: rc.effectiveCapacityHours,
          utilization: util,
        },
      });
    }
  }

  for (const alloc of snapshot.allocations) {
    const iteration = iterationById.get(alloc.iterationId);
    if (!iteration) continue;

    if (
      iteration.startDate < snapshot.piStartDate ||
      iteration.endDate > snapshot.piEndDate
    ) {
      conflicts.push({
        type: "OUTSIDE_PI_DATES",
        severity: "WARNING",
        message: "Allocation iteration falls outside PI date range",
        subjectType: "ALLOCATION",
        subjectId: alloc.id,
        relatedIds: [alloc.iterationId, snapshot.piId],
      });
    }

    if (alloc.projectPlannedStart || alloc.projectPlannedEnd) {
      const projStart = alloc.projectPlannedStart;
      const projEnd = alloc.projectPlannedEnd;
      if (
        (projStart && iteration.endDate < projStart) ||
        (projEnd && iteration.startDate > projEnd)
      ) {
        conflicts.push({
          type: "OUTSIDE_PROJECT_DATES",
          severity: "WARNING",
          message: "Allocation iteration is outside project planned dates",
          subjectType: "ALLOCATION",
          subjectId: alloc.id,
          relatedIds: [
            alloc.workItemId,
            alloc.workItemProjectId ?? "",
            alloc.iterationId,
          ].filter(Boolean),
        });
      }
    }
  }

  for (const dep of snapshot.dependencies) {
    if (dep.status === "CANCELLED" || dep.status === "RESOLVED") continue;
    if (dep.type === "RELATED") continue;
    if (
      dep.sourceIterationSequence == null ||
      dep.targetIterationSequence == null
    ) {
      continue;
    }
    // DEPENDS_ON / BLOCKS: successor (target) must not precede predecessor (source).
    if (dep.targetIterationSequence < dep.sourceIterationSequence) {
      conflicts.push({
        type: "DEPENDENCY_TIMING",
        severity:
          dep.criticality === "CRITICAL" || dep.criticality === "HIGH"
            ? "BLOCKER"
            : "WARNING",
        message:
          "Successor work is scheduled before predecessor (dependency timing)",
        subjectType: "DEPENDENCY",
        subjectId: dep.id,
        relatedIds: [dep.sourceId, dep.targetId],
        meta: {
          sourceIterationSequence: dep.sourceIterationSequence,
          targetIterationSequence: dep.targetIterationSequence,
          dependencyType: dep.type,
        },
      });
    }
  }

  for (const ms of snapshot.milestones ?? []) {
    if (!ms.plannedDate || ms.status === "CANCELLED" || ms.status === "COMPLETED") {
      continue;
    }
    if (
      ms.plannedDate < snapshot.piStartDate ||
      ms.plannedDate > snapshot.piEndDate
    ) {
      conflicts.push({
        type: "MILESTONE_TIMING",
        severity: ms.criticality ? "WARNING" : "INFO",
        message: "Milestone planned date falls outside PI window",
        subjectType: "MILESTONE",
        subjectId: ms.id,
        relatedIds: [ms.projectId, snapshot.piId],
      });
    }
  }

  if (snapshot.resourceAllocationPercents) {
    for (const [resourceId, total] of Object.entries(
      snapshot.resourceAllocationPercents,
    )) {
      if (toHoursNumber(total) > 100.001) {
        conflicts.push({
          type: "RESOURCE_ALLOCATION_CONFLICT",
          severity: "BLOCKER",
          message: `Resource membership allocation percents sum to ${total} (limit 100)`,
          subjectType: "RESOURCE",
          subjectId: resourceId,
          meta: { totalPercent: total },
        });
      }
    }
  }

  return conflicts;
}

function formatUtil(util: number | null): string {
  if (util == null) return "n/a";
  if (!Number.isFinite(util)) return "∞";
  return `${Math.round(util * 100)}%`;
}
