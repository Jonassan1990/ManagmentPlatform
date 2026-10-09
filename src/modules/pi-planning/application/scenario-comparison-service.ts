/**
 * M3C-A — Read-only multi-revision PI scenario comparison.
 * Reuses CapacityService + deriveConflictsForPi; never mutates revisions or baselines.
 */

import { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import type { CapacityService } from "./capacity-service";
import type { DerivedConflict } from "./conflict-engine";
import { isOverloaded, toHoursNumber } from "./capacity-policy";
import { piAuthScope } from "./pi-auth-scope";
import type { PiService } from "./pi-service";
import type { PlanningService } from "./planning-service";
import { compareScenariosInputSchema } from "./schemas";
import {
  SCENARIO_COMPARISON_LIMITS,
  type MetricDelta,
  type MetricScalar,
  type ProjectCommitmentRow,
  type ResourceAllocationDiffRow,
  type ScenarioComparisonResult,
  type ScenarioComparisonRevisionRef,
  type TeamMetricRow,
  type WorkItemAllocationDiff,
  type WorkItemAllocationSide,
} from "./scenario-comparison-types";

function fromZod(error: ZodError): AppError {
  return new AppError("VALIDATION", "Validation failed", {
    details: error.flatten(),
  });
}

function parse<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) throw fromZod(error);
    throw error;
  }
}

function utilPercent(util: number | null): number | null {
  if (util == null) return null;
  if (!Number.isFinite(util)) return null;
  return Math.round(util * 10000) / 100;
}

function conflictKey(c: DerivedConflict): string {
  const related = (c.relatedIds ?? []).slice().sort().join(",");
  return `${c.type}|${c.subjectType}|${c.subjectId}|${related}`;
}

function placementKey(side: {
  iterationId: string | null;
  teamId: string | null;
  resourceId: string | null;
}): string {
  return `${side.iterationId ?? ""}|${side.teamId ?? ""}|${side.resourceId ?? ""}`;
}

function classifyChange(
  reference: WorkItemAllocationSide,
  other: WorkItemAllocationSide,
): WorkItemAllocationDiff["change"] {
  if (!reference.present && other.present) return "added";
  if (reference.present && !other.present) return "removed";
  if (!reference.present && !other.present) return "unchanged";
  const hoursChanged =
    Number(reference.plannedHours ?? 0) !== Number(other.plannedHours ?? 0);
  const placementChanged =
    placementKey(reference) !== placementKey(other);
  if (hoursChanged && placementChanged) return "hours_and_placement_changed";
  if (hoursChanged) return "hours_changed";
  if (placementChanged) return "placement_changed";
  return "unchanged";
}

export class ScenarioComparisonService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly piService: PiService,
    private readonly capacity: CapacityService,
    private readonly planning: PlanningService,
  ) {}

  async compareScenarios(
    principal: Principal,
    raw: unknown,
  ): Promise<ScenarioComparisonResult> {
    const input = parse(compareScenariosInputSchema, raw);
    const asOf = input.asOf ?? new Date();
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_VIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );

    const revisionIds = [...new Set(input.revisionIds)];
    if (revisionIds.length < SCENARIO_COMPARISON_LIMITS.minRevisions) {
      throw new AppError(
        "VALIDATION",
        `Compare requires at least ${SCENARIO_COMPARISON_LIMITS.minRevisions} distinct revisions.`,
      );
    }
    if (revisionIds.length > SCENARIO_COMPARISON_LIMITS.maxRevisions) {
      throw new AppError(
        "VALIDATION",
        `Compare supports at most ${SCENARIO_COMPARISON_LIMITS.maxRevisions} revisions.`,
      );
    }

    const revisions = await this.db.planningRevision.findMany({
      where: { piId: pi.id, id: { in: revisionIds } },
    });
    if (revisions.length !== revisionIds.length) {
      const found = new Set(revisions.map((r) => r.id));
      const missing = revisionIds.filter((id) => !found.has(id));
      throw new AppError(
        "NOT_FOUND",
        "One or more revisions were not found on this PI.",
        { details: { missingRevisionIds: missing } },
      );
    }

    // Preserve caller order
    const ordered = revisionIds.map(
      (id) => revisions.find((r) => r.id === id)!,
    );

    const referenceRevisionId =
      input.referenceRevisionId ?? ordered[0]!.id;
    if (!revisionIds.includes(referenceRevisionId)) {
      throw new AppError(
        "VALIDATION",
        "referenceRevisionId must be one of the compared revisionIds.",
      );
    }

    const [iterations, participatingTeams, memberships] = await Promise.all([
      this.db.piIteration.findMany({
        where: { piId: pi.id },
        orderBy: { sequence: "asc" },
        select: { id: true },
      }),
      this.db.piParticipatingTeam.findMany({
        where: { piId: pi.id },
        select: { teamId: true },
      }),
      this.db.resourceMembership.findMany({
        where: {
          effectiveTo: null,
          team: {
            piParticipations: { some: { piId: pi.id } },
          },
        },
        select: {
          resourceId: true,
          teamId: true,
          resource: {
            select: {
              id: true,
              name: true,
              capacityHoursPerWeek: true,
            },
          },
        },
      }),
    ]);

    // Batch capacity + conflicts + allocations per revision (max 3)
    const snapshots = await Promise.all(
      ordered.map(async (revision) => {
        const [capacityViews, conflicts, allocations] = await Promise.all([
          this.capacity.computeCapacityViews(pi.id, revision.id),
          this.planning.deriveConflictsForPi(pi.id, revision.id),
          this.db.workAllocation.findMany({
            where: { revisionId: revision.id },
            include: {
              workItem: {
                select: {
                  id: true,
                  referenceKey: true,
                  title: true,
                  projectId: true,
                  project: {
                    select: {
                      id: true,
                      referenceKey: true,
                      name: true,
                    },
                  },
                },
              },
            },
          }),
        ]);
        return { revision, capacityViews, conflicts, allocations };
      }),
    );

    const revisionRefs: ScenarioComparisonRevisionRef[] = ordered.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      status: r.status,
      isCurrent: r.isCurrent,
      kind: r.isCurrent ? "CURRENT" : "SCENARIO",
      version: r.version,
      archivedAt: r.archivedAt?.toISOString() ?? null,
      clonedFromRevisionId: r.clonedFromRevisionId,
    }));

    const totals = snapshots.map((snap) => {
      const metrics = this.rollupMetrics(snap.capacityViews.teams, snap.conflicts);
      return {
        revisionId: snap.revision.id,
        metrics,
        deltaFromReference: this.zeroDelta(),
      };
    });
    const refTotals = totals.find((t) => t.revisionId === referenceRevisionId)!;
    for (const col of totals) {
      col.deltaFromReference = this.deltaMetrics(
        refTotals.metrics,
        col.metrics,
      );
    }

    const byTeam = this.buildTeamRows(snapshots);
    const byProject = this.buildProjectRows(snapshots, referenceRevisionId);
    const byResource = this.buildResourceRows(snapshots);
    const workItemDiffs = this.buildWorkItemDiffs(
      snapshots,
      referenceRevisionId,
    );

    const added = workItemDiffs.filter((d) => d.change === "added");
    const removed = workItemDiffs.filter((d) => d.change === "removed");
    const changed = workItemDiffs.filter(
      (d) =>
        d.change === "hours_changed" ||
        d.change === "placement_changed" ||
        d.change === "hours_and_placement_changed",
    );
    const unchangedCount = workItemDiffs.filter(
      (d) => d.change === "unchanged",
    ).length;

    const refConflicts = snapshots.find(
      (s) => s.revision.id === referenceRevisionId,
    )!.conflicts;
    const refKeys = new Set(refConflicts.map(conflictKey));
    const conflicts = {
      byRevision: snapshots.map((s) => ({
        revisionId: s.revision.id,
        conflicts: s.conflicts,
      })),
      onlyOnRevision: snapshots
        .filter((s) => s.revision.id !== referenceRevisionId)
        .map((s) => ({
          revisionId: s.revision.id,
          conflicts: s.conflicts.filter((c) => !refKeys.has(conflictKey(c))),
        })),
      onlyOnReference: refConflicts.filter((c) => {
        // present on reference but missing from ALL other revisions
        return snapshots
          .filter((s) => s.revision.id !== referenceRevisionId)
          .every(
            (s) => !s.conflicts.some((x) => conflictKey(x) === conflictKey(c)),
          );
      }),
    };

    const dataQuality = this.assessDataQuality(
      memberships,
      iterations.map((i) => i.id),
      snapshots.reduce((n, s) => n + s.allocations.length, 0),
    );

    return {
      piId: pi.id,
      asOf: asOf.toISOString(),
      referenceRevisionId,
      revisions: revisionRefs,
      capacityAssumptions: {
        iterationIds: iterations.map((i) => i.id),
        participatingTeamIds: participatingTeams.map((t) => t.teamId),
        note: "SHARED_PI_CAPACITY_INPUTS",
        piStartDate: pi.startDate.toISOString(),
        piEndDate: pi.endDate.toISOString(),
      },
      totals,
      byTeam,
      byProject,
      byResource,
      workItemDiffs,
      allocationChanges: {
        added,
        removed,
        changed,
        unchangedCount,
      },
      conflicts,
      dataQuality,
      limits: SCENARIO_COMPARISON_LIMITS,
    };
  }

  private rollupMetrics(
    teams: {
      effectiveCapacityHours: number;
      plannedLoadHours: number;
      utilization: number | null;
      band: string;
    }[],
    conflicts: DerivedConflict[],
  ): MetricScalar {
    const availableHours = teams.reduce(
      (s, t) => s + t.effectiveCapacityHours,
      0,
    );
    const committedHours = teams.reduce((s, t) => s + t.plannedLoadHours, 0);
    const remainingHours = availableHours - committedHours;
    let utilization: number | null = null;
    if (availableHours > 0) {
      utilization = committedHours / availableHours;
    } else if (committedHours > 0) {
      utilization = Number.POSITIVE_INFINITY;
    }
    const finiteUtil = Number.isFinite(utilization) ? utilization : null;
    return {
      availableHours,
      committedHours,
      remainingHours,
      utilization: finiteUtil,
      utilizationPercent: utilPercent(finiteUtil),
      overloadedTeamCount: teams.filter((t) => t.band === "overload").length,
      conflictCount: conflicts.length,
      blockerConflictCount: conflicts.filter((c) => c.severity === "BLOCKER")
        .length,
    };
  }

  private zeroDelta(): MetricDelta {
    return {
      availableHours: 0,
      committedHours: 0,
      remainingHours: 0,
      utilizationPercent: 0,
      overloadedTeamCount: 0,
      conflictCount: 0,
      blockerConflictCount: 0,
    };
  }

  private deltaMetrics(reference: MetricScalar, other: MetricScalar): MetricDelta {
    const utilDelta =
      reference.utilizationPercent == null && other.utilizationPercent == null
        ? null
        : (other.utilizationPercent ?? 0) - (reference.utilizationPercent ?? 0);
    return {
      availableHours: other.availableHours - reference.availableHours,
      committedHours: other.committedHours - reference.committedHours,
      remainingHours: other.remainingHours - reference.remainingHours,
      utilizationPercent: utilDelta,
      overloadedTeamCount:
        other.overloadedTeamCount - reference.overloadedTeamCount,
      conflictCount: other.conflictCount - reference.conflictCount,
      blockerConflictCount:
        other.blockerConflictCount - reference.blockerConflictCount,
    };
  }

  private buildTeamRows(
    snapshots: Array<{
      revision: { id: string };
      capacityViews: {
        teams: Array<{
          teamId: string;
          teamName: string;
          departmentId: string;
          iterationId: string;
          effectiveCapacityHours: number;
          plannedLoadHours: number;
          utilization: number | null;
          band: string;
        }>;
      };
    }>,
  ): TeamMetricRow[] {
    const keys = new Map<
      string,
      { teamId: string; teamName: string; departmentId: string; iterationId: string }
    >();
    for (const snap of snapshots) {
      for (const t of snap.capacityViews.teams) {
        const k = `${t.teamId}:${t.iterationId}`;
        if (!keys.has(k)) {
          keys.set(k, {
            teamId: t.teamId,
            teamName: t.teamName,
            departmentId: t.departmentId,
            iterationId: t.iterationId,
          });
        }
      }
    }
    return [...keys.values()].map((meta) => ({
      ...meta,
      columns: snapshots.map((snap) => {
        const row = snap.capacityViews.teams.find(
          (t) =>
            t.teamId === meta.teamId && t.iterationId === meta.iterationId,
        );
        const availableHours = row?.effectiveCapacityHours ?? 0;
        const committedHours = row?.plannedLoadHours ?? 0;
        const utilization = row?.utilization ?? null;
        return {
          revisionId: snap.revision.id,
          availableHours,
          committedHours,
          remainingHours: availableHours - committedHours,
          utilization: Number.isFinite(utilization as number)
            ? utilization
            : null,
          band: row?.band ?? "none",
          overloaded: isOverloaded(
            Number.isFinite(utilization as number) ? utilization : null,
          ),
        };
      }),
    }));
  }

  private buildProjectRows(
    snapshots: Array<{
      revision: { id: string };
      allocations: Array<{
        plannedHours: { toString(): string } | number | string;
        workItem: {
          projectId: string;
          project: { id: string; referenceKey: string; name: string };
        };
      }>;
    }>,
    referenceRevisionId: string,
  ): ProjectCommitmentRow[] {
    const projects = new Map<
      string,
      { projectId: string; projectReferenceKey: string; projectName: string }
    >();
    for (const snap of snapshots) {
      for (const a of snap.allocations) {
        const p = a.workItem.project;
        if (!projects.has(p.id)) {
          projects.set(p.id, {
            projectId: p.id,
            projectReferenceKey: p.referenceKey,
            projectName: p.name,
          });
        }
      }
    }
    return [...projects.values()].map((meta) => {
      const columns = snapshots.map((snap) => {
        const rows = snap.allocations.filter(
          (a) => a.workItem.project.id === meta.projectId,
        );
        return {
          revisionId: snap.revision.id,
          committedHours: rows.reduce(
            (s, a) => s + toHoursNumber(a.plannedHours),
            0,
          ),
          allocationCount: rows.length,
        };
      });
      const refHours =
        columns.find((c) => c.revisionId === referenceRevisionId)
          ?.committedHours ?? 0;
      return {
        ...meta,
        columns,
        deltaFromReferenceHours: columns.map((c) => ({
          revisionId: c.revisionId,
          deltaHours: c.committedHours - refHours,
        })),
      };
    });
  }

  private buildResourceRows(
    snapshots: Array<{
      revision: { id: string };
      capacityViews: {
        resources: Array<{
          resourceId: string;
          resourceName: string;
          iterationId: string;
          effectiveCapacityHours: number;
          plannedLoadHours: number;
          band: string;
        }>;
      };
    }>,
  ): ResourceAllocationDiffRow[] {
    const keys = new Map<
      string,
      { resourceId: string; resourceName: string; iterationId: string }
    >();
    for (const snap of snapshots) {
      for (const r of snap.capacityViews.resources) {
        const k = `${r.resourceId}:${r.iterationId}`;
        if (!keys.has(k)) {
          keys.set(k, {
            resourceId: r.resourceId,
            resourceName: r.resourceName,
            iterationId: r.iterationId,
          });
        }
      }
    }
    return [...keys.values()].map((meta) => ({
      ...meta,
      columns: snapshots.map((snap) => {
        const row = snap.capacityViews.resources.find(
          (r) =>
            r.resourceId === meta.resourceId &&
            r.iterationId === meta.iterationId,
        );
        return {
          revisionId: snap.revision.id,
          committedHours: row?.plannedLoadHours ?? 0,
          availableHours: row?.effectiveCapacityHours ?? 0,
          band: row?.band ?? "none",
        };
      }),
    }));
  }

  private buildWorkItemDiffs(
    snapshots: Array<{
      revision: { id: string };
      allocations: Array<{
        id: string;
        workItemId: string;
        iterationId: string;
        teamId: string;
        resourceId: string | null;
        plannedHours: { toString(): string } | number | string;
        workItem: {
          id: string;
          referenceKey: string;
          title: string;
          projectId: string;
        };
      }>;
    }>,
    referenceRevisionId: string,
  ): WorkItemAllocationDiff[] {
    const workItemMeta = new Map<
      string,
      {
        workItemId: string;
        workItemReferenceKey: string | null;
        workItemTitle: string | null;
        projectId: string | null;
      }
    >();
    for (const snap of snapshots) {
      for (const a of snap.allocations) {
        if (!workItemMeta.has(a.workItemId)) {
          workItemMeta.set(a.workItemId, {
            workItemId: a.workItemId,
            workItemReferenceKey: a.workItem.referenceKey,
            workItemTitle: a.workItem.title,
            projectId: a.workItem.projectId,
          });
        }
      }
    }

    return [...workItemMeta.values()].map((meta) => {
      const sides: WorkItemAllocationSide[] = snapshots.map((snap) => {
        const a = snap.allocations.find(
          (row) => row.workItemId === meta.workItemId,
        );
        if (!a) {
          return {
            revisionId: snap.revision.id,
            allocationId: null,
            present: false,
            plannedHours: null,
            iterationId: null,
            teamId: null,
            resourceId: null,
          };
        }
        return {
          revisionId: snap.revision.id,
          allocationId: a.id,
          present: true,
          plannedHours: toHoursNumber(a.plannedHours),
          iterationId: a.iterationId,
          teamId: a.teamId,
          resourceId: a.resourceId,
        };
      });
      const reference =
        sides.find((s) => s.revisionId === referenceRevisionId) ?? sides[0]!;
      // Overall change: if any non-reference side differs, pick strongest change label
      let change: WorkItemAllocationDiff["change"] = "unchanged";
      for (const side of sides) {
        if (side.revisionId === referenceRevisionId) continue;
        const c = classifyChange(reference, side);
        if (c === "unchanged") continue;
        if (change === "unchanged") {
          change = c;
          continue;
        }
        // escalate to combined when mixed signals across revisions
        if (
          (change === "hours_changed" && c === "placement_changed") ||
          (change === "placement_changed" && c === "hours_changed") ||
          c === "hours_and_placement_changed"
        ) {
          change = "hours_and_placement_changed";
        } else if (
          (change === "added" || change === "removed") &&
          c !== change
        ) {
          change = "hours_and_placement_changed";
        }
      }
      return { ...meta, change, sides };
    });
  }

  private assessDataQuality(
    memberships: Array<{
      resourceId: string;
      resource: {
        capacityHoursPerWeek: { toString(): string } | number | null;
        name: string;
      };
    }>,
    iterationIds: string[],
    allocationCount: number,
  ): { missingCapacityInputs: boolean; notes: string[] } {
    const notes: string[] = [];
    const missing = memberships.filter(
      (m) => m.resource.capacityHoursPerWeek == null,
    );
    // Overrides can still supply hours; check availabilities
    // Lightweight: if capacityHoursPerWeek null, note as missing unless overridden on all iterations
    let missingCapacityInputs = false;
    if (missing.length > 0) {
      missingCapacityInputs = true;
      notes.push(
        `${missing.length} resource membership(s) lack capacityHoursPerWeek; effective capacity treats missing weekly capacity as 0 hours when no ResourceAvailability override applies (not unavailable).`,
      );
    }
    if (
      allocationCount >
      SCENARIO_COMPARISON_LIMITS.recommendedMaxAllocationsTotal
    ) {
      notes.push(
        `Compared allocation row count (${allocationCount}) exceeds recommended soft limit (${SCENARIO_COMPARISON_LIMITS.recommendedMaxAllocationsTotal}).`,
      );
    }
    if (iterationIds.length === 0) {
      notes.push("PI has no iterations; capacity totals are zero.");
    }
    notes.push(
      "Capacity inputs (Resource / membership / availability) are shared across compared revisions; only WorkAllocation commitments differ.",
    );
    notes.push(
      "Baseline snapshots are not mixed into this comparison; compare live CURRENT/scenario revisions only.",
    );
    return { missingCapacityInputs, notes };
  }
}
