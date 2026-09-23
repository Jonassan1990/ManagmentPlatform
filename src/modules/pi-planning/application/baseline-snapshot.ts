/**
 * Baseline snapshot builders for PI Planning.
 *
 * PiBaseline.payload is immutable after insert. Rebaseline creates version N+1.
 * CURRENT PlanningRevision remains mutable; baseline captures a point-in-time
 * revision snapshot for compare / audit.
 */

import { toHoursNumber, type DecimalLike } from "./capacity-policy";

export type BaselineAllocationRow = {
  id: string;
  workItemId: string;
  workItemReferenceKey?: string;
  iterationId: string;
  iterationReferenceKey?: string;
  teamId: string;
  resourceId?: string | null;
  plannedHours: DecimalLike;
};

export type BaselineIterationRow = {
  id: string;
  referenceKey: string;
  name: string;
  sequence: number;
  startDate: Date | string;
  endDate: Date | string;
};

export type BaselineDependencyRow = {
  id: string;
  type: string;
  status: string;
  criticality: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  neededByDate?: Date | string | null;
};

export type BaselinePayloadInput = {
  pi: {
    id: string;
    referenceKey: string;
    name: string;
    status: string;
    startDate: Date | string;
    endDate: Date | string;
    version: number;
  };
  revision: {
    id: string;
    key: string;
    version: number;
  };
  iterations: BaselineIterationRow[];
  allocations: BaselineAllocationRow[];
  participatingDepartmentIds: string[];
  participatingTeamIds: string[];
  dependencies?: BaselineDependencyRow[];
  capturedAt?: Date | string;
};

export type BaselinePayload = {
  schemaVersion: 1;
  capturedAt: string;
  pi: BaselinePayloadInput["pi"] & {
    startDate: string;
    endDate: string;
  };
  revision: BaselinePayloadInput["revision"];
  iterations: Array<
    BaselineIterationRow & { startDate: string; endDate: string }
  >;
  allocations: Array<{
    id: string;
    workItemId: string;
    workItemReferenceKey?: string;
    iterationId: string;
    iterationReferenceKey?: string;
    teamId: string;
    resourceId?: string | null;
    plannedHours: string;
  }>;
  participatingDepartmentIds: string[];
  participatingTeamIds: string[];
  dependencies: Array<
    BaselineDependencyRow & { neededByDate?: string | null }
  >;
};

export function buildBaselinePayload(
  input: BaselinePayloadInput,
): BaselinePayload {
  const capturedAt = input.capturedAt
    ? new Date(input.capturedAt).toISOString()
    : new Date().toISOString();

  return {
    schemaVersion: 1,
    capturedAt,
    pi: {
      ...input.pi,
      startDate: new Date(input.pi.startDate).toISOString(),
      endDate: new Date(input.pi.endDate).toISOString(),
    },
    revision: input.revision,
    iterations: input.iterations.map((it) => ({
      ...it,
      startDate: new Date(it.startDate).toISOString(),
      endDate: new Date(it.endDate).toISOString(),
    })),
    allocations: input.allocations.map((a) => ({
      id: a.id,
      workItemId: a.workItemId,
      workItemReferenceKey: a.workItemReferenceKey,
      iterationId: a.iterationId,
      iterationReferenceKey: a.iterationReferenceKey,
      teamId: a.teamId,
      resourceId: a.resourceId ?? null,
      plannedHours: String(toHoursNumber(a.plannedHours)),
    })),
    participatingDepartmentIds: [...input.participatingDepartmentIds].sort(),
    participatingTeamIds: [...input.participatingTeamIds].sort(),
    dependencies: (input.dependencies ?? []).map((d) => ({
      ...d,
      neededByDate: d.neededByDate
        ? new Date(d.neededByDate).toISOString()
        : null,
    })),
  };
}

export type BaselineChange = {
  kind:
    | "allocation_added"
    | "allocation_removed"
    | "allocation_moved"
    | "allocation_hours_changed"
    | "iteration_changed"
    | "participation_changed"
    | "dependency_changed"
    | "pi_meta_changed";
  message: string;
  subjectId?: string;
  before?: unknown;
  after?: unknown;
};

export function compareChangesSinceBaseline(
  baseline: BaselinePayload,
  current: BaselinePayloadInput,
): BaselineChange[] {
  const currentPayload = buildBaselinePayload(current);
  const changes: BaselineChange[] = [];

  if (
    baseline.pi.name !== currentPayload.pi.name ||
    baseline.pi.startDate !== currentPayload.pi.startDate ||
    baseline.pi.endDate !== currentPayload.pi.endDate ||
    baseline.pi.status !== currentPayload.pi.status
  ) {
    changes.push({
      kind: "pi_meta_changed",
      message: "PI metadata differs from baseline",
      before: baseline.pi,
      after: currentPayload.pi,
    });
  }

  const baseAlloc = new Map(
    baseline.allocations.map((a) => [a.workItemId, a] as const),
  );
  const curAlloc = new Map(
    currentPayload.allocations.map((a) => [a.workItemId, a] as const),
  );

  for (const [workItemId, cur] of curAlloc) {
    const prev = baseAlloc.get(workItemId);
    if (!prev) {
      changes.push({
        kind: "allocation_added",
        message: `Work item ${workItemId} allocated since baseline`,
        subjectId: workItemId,
        after: cur,
      });
      continue;
    }
    if (prev.iterationId !== cur.iterationId || prev.teamId !== cur.teamId) {
      changes.push({
        kind: "allocation_moved",
        message: `Work item ${workItemId} moved since baseline`,
        subjectId: workItemId,
        before: prev,
        after: cur,
      });
    } else if (prev.plannedHours !== cur.plannedHours) {
      changes.push({
        kind: "allocation_hours_changed",
        message: `Planned hours changed for work item ${workItemId}`,
        subjectId: workItemId,
        before: prev.plannedHours,
        after: cur.plannedHours,
      });
    }
  }

  for (const [workItemId, prev] of baseAlloc) {
    if (!curAlloc.has(workItemId)) {
      changes.push({
        kind: "allocation_removed",
        message: `Work item ${workItemId} unallocated since baseline`,
        subjectId: workItemId,
        before: prev,
      });
    }
  }

  const baseDepts = baseline.participatingDepartmentIds.join(",");
  const curDepts = currentPayload.participatingDepartmentIds.join(",");
  const baseTeams = baseline.participatingTeamIds.join(",");
  const curTeams = currentPayload.participatingTeamIds.join(",");
  if (baseDepts !== curDepts || baseTeams !== curTeams) {
    changes.push({
      kind: "participation_changed",
      message: "Participating departments/teams differ from baseline",
    });
  }

  const baseDepIds = new Set(baseline.dependencies.map((d) => d.id));
  const curDepIds = new Set(currentPayload.dependencies.map((d) => d.id));
  for (const id of curDepIds) {
    if (!baseDepIds.has(id)) {
      changes.push({
        kind: "dependency_changed",
        message: `Dependency ${id} added since baseline`,
        subjectId: id,
      });
    }
  }
  for (const id of baseDepIds) {
    if (!curDepIds.has(id)) {
      changes.push({
        kind: "dependency_changed",
        message: `Dependency ${id} removed since baseline`,
        subjectId: id,
      });
    }
  }

  return changes;
}
