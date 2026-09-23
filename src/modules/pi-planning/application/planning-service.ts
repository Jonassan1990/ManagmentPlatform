/**
 * Planning facade — composes PI, allocation, capacity, dependency, baseline.
 * Prefer this entry point from container / server actions.
 */

import { PrismaClient, ScopeType } from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { AllocationService } from "./allocation-service";
import { buildPiAttentionItems } from "./attention";
import { BaselineService } from "./baseline-service";
import { CapacityService } from "./capacity-service";
import { deriveConflicts, type DerivedConflict } from "./conflict-engine";
import { DependencyService } from "./dependency-service";
import { PiService } from "./pi-service";

export class PlanningService {
  readonly pi: PiService;
  readonly allocations: AllocationService;
  readonly capacity: CapacityService;
  readonly dependencies: DependencyService;
  readonly baselines: BaselineService;

  constructor(
    private readonly db: PrismaClient,
    authz: AuthorizationService,
    audit: AuditService,
  ) {
    this.pi = new PiService(db, authz, audit);
    this.allocations = new AllocationService(db, authz, audit, this.pi);
    this.capacity = new CapacityService(db, authz, audit, this.pi);
    this.dependencies = new DependencyService(db, authz, audit);
    this.baselines = new BaselineService(db, authz, audit, this.pi);
  }

  // ---- Convenience delegates ----

  listProgramIncrements = (...args: Parameters<PiService["listProgramIncrements"]>) =>
    this.pi.listProgramIncrements(...args);
  getProgramIncrement = (...args: Parameters<PiService["getProgramIncrement"]>) =>
    this.pi.getProgramIncrement(...args);
  createProgramIncrement = (...args: Parameters<PiService["createProgramIncrement"]>) =>
    this.pi.createProgramIncrement(...args);
  updateProgramIncrement = (...args: Parameters<PiService["updateProgramIncrement"]>) =>
    this.pi.updateProgramIncrement(...args);
  createIteration = (...args: Parameters<PiService["createIteration"]>) =>
    this.pi.createIteration(...args);
  updateIteration = (...args: Parameters<PiService["updateIteration"]>) =>
    this.pi.updateIteration(...args);
  setParticipatingDepartments = (
    ...args: Parameters<PiService["setParticipatingDepartments"]>
  ) => this.pi.setParticipatingDepartments(...args);
  setParticipatingTeams = (...args: Parameters<PiService["setParticipatingTeams"]>) =>
    this.pi.setParticipatingTeams(...args);
  transitionStatus = (...args: Parameters<PiService["transitionStatus"]>) =>
    this.pi.transitionStatus(...args);

  allocateWork = (...args: Parameters<AllocationService["allocateWork"]>) =>
    this.allocations.allocateWork(...args);
  moveAllocation = (...args: Parameters<AllocationService["moveAllocation"]>) =>
    this.allocations.moveAllocation(...args);
  removeAllocation = (...args: Parameters<AllocationService["removeAllocation"]>) =>
    this.allocations.removeAllocation(...args);
  getBacklog = (...args: Parameters<AllocationService["getBacklog"]>) =>
    this.allocations.getBacklog(...args);

  setResourceAvailability = (
    ...args: Parameters<CapacityService["setResourceAvailability"]>
  ) => this.capacity.setResourceAvailability(...args);
  getCapacityViews = (...args: Parameters<CapacityService["getCapacityViews"]>) =>
    this.capacity.getCapacityViews(...args);

  createDependency = (...args: Parameters<DependencyService["createDependency"]>) =>
    this.dependencies.createDependency(...args);
  updateDependency = (...args: Parameters<DependencyService["updateDependency"]>) =>
    this.dependencies.updateDependency(...args);
  listDependencies = (...args: Parameters<DependencyService["listDependencies"]>) =>
    this.dependencies.listDependencies(...args);

  createBaseline = (...args: Parameters<BaselineService["createBaseline"]>) =>
    this.baselines.createBaseline(...args);
  listBaselines = (...args: Parameters<BaselineService["listBaselines"]>) =>
    this.baselines.listBaselines(...args);
  getChangesSince = (...args: Parameters<BaselineService["getChangesSince"]>) =>
    this.baselines.getChangesSince(...args);

  /**
   * Planning board: departments → teams → iterations → cards + capacity/utilization.
   * Conflicts derived on read (no cache).
   */
  async getPlanningBoard(principal: Principal, piId: string) {
    const pi = await this.pi.getProgramIncrement(principal, piId);
    const revision = await this.pi.requireCurrentRevision(piId);
    const [allocations, capacityViews, conflicts, backlog] = await Promise.all([
      this.allocations.listAllocationsForRevision(revision.id),
      this.capacity.computeCapacityViews(piId),
      this.deriveConflictsForPi(piId),
      this.allocations.getBacklog(principal, piId),
    ]);

    const capacityByTeamIteration = new Map(
      capacityViews.teams.map(
        (t) => [`${t.teamId}:${t.iterationId}`, t] as const,
      ),
    );

    const departments = pi.participatingDepartments.map((pd) => {
      const teams = pi.participatingTeams
        .filter((pt) => pt.departmentId === pd.departmentId)
        .map((pt) => {
          const iterations = pi.iterations.map((it) => {
            const cards = allocations.filter(
              (a) => a.teamId === pt.teamId && a.iterationId === it.id,
            );
            const cap = capacityByTeamIteration.get(`${pt.teamId}:${it.id}`);
            const teamConflicts = conflicts.filter(
              (c) =>
                c.subjectId === pt.teamId ||
                c.relatedIds?.includes(it.id) ||
                cards.some(
                  (card) =>
                    c.subjectId === card.id ||
                    c.subjectId === card.workItemId ||
                    c.relatedIds?.includes(card.id),
                ),
            );
            return {
              iteration: it,
              capacity: cap ?? null,
              utilizationBand: cap?.band ?? ("none" as const),
              conflictCount: teamConflicts.length,
              hasOverload: teamConflicts.some(
                (c) =>
                  c.type === "TEAM_OVERLOAD" && c.severity === "BLOCKER",
              ),
              cards: cards.map((c) => ({
                allocationId: c.id,
                version: c.version,
                plannedHours: c.plannedHours.toString(),
                resourceId: c.resourceId,
                hasDependencyConflict: conflicts.some(
                  (conf) =>
                    conf.type === "DEPENDENCY_TIMING" &&
                    (conf.subjectId === c.workItemId ||
                      conf.relatedIds?.includes(c.workItemId) ||
                      conf.subjectId === c.id),
                ),
                workItem: {
                  id: c.workItem.id,
                  referenceKey: c.workItem.referenceKey,
                  title: c.workItem.title,
                  type: c.workItem.type,
                  status: c.workItem.status,
                  priority: c.workItem.priority,
                  estimateHours: c.workItem.estimateHours?.toString() ?? null,
                  project: c.workItem.project,
                },
              })),
            };
          });
          return {
            teamId: pt.teamId,
            teamName: pt.team.name,
            departmentId: pt.departmentId,
            iterations,
          };
        });
      return {
        departmentId: pd.departmentId,
        departmentName: pd.department.name,
        planningOwnerName: pd.planningOwnerName,
        teams,
      };
    });

    return {
      pi,
      revision,
      departments,
      backlog,
      conflicts,
      capacityViews,
      attention: buildPiAttentionItems({
        status: pi.status,
        iterationCount: pi.iterations.length,
        participatingDepartmentCount: pi.participatingDepartments.length,
        allocationCount: allocations.length,
        conflictCount: conflicts.filter((c) => c.severity === "BLOCKER").length,
        baselineCount: pi.baselines.length,
        hasCurrentRevision: true,
      }),
    };
  }

  async getPiOverview(principal: Principal, piId: string) {
    const board = await this.getPlanningBoard(principal, piId);
    const overloadTeams = board.capacityViews.teams.filter(
      (t) => t.band === "overload",
    ).length;
    const nearTeams = board.capacityViews.teams.filter(
      (t) => t.band === "near",
    ).length;
    return {
      pi: board.pi,
      revision: board.revision,
      metrics: {
        iterationCount: board.pi.iterations.length,
        departmentCount: board.pi.participatingDepartments.length,
        teamCount: board.pi.participatingTeams.length,
        allocationCount: board.capacityViews.teams.reduce(
          (s, t) => s + (t.plannedLoadHours > 0 ? 1 : 0),
          0,
        ),
        backlogCount: board.backlog.length,
        conflictCount: board.conflicts.length,
        blockerConflictCount: board.conflicts.filter(
          (c) => c.severity === "BLOCKER",
        ).length,
        overloadTeamSlots: overloadTeams,
        nearCapacityTeamSlots: nearTeams,
        baselineCount: board.pi.baselines.length,
        latestBaselineVersion: board.pi.baselines[0]?.versionNumber ?? null,
      },
      attention: board.attention,
      conflicts: board.conflicts,
    };
  }

  async deriveConflictsForPi(piId: string): Promise<DerivedConflict[]> {
    const pi = await this.db.programIncrement.findUniqueOrThrow({
      where: { id: piId },
      include: {
        iterations: { orderBy: { sequence: "asc" } },
      },
    });
    const revision = await this.pi.requireCurrentRevision(piId);
    const [allocations, capacityViews, dependencies] = await Promise.all([
      this.allocations.listAllocationsForRevision(revision.id),
      this.capacity.computeCapacityViews(piId),
      this.db.planningDependency.findMany({
        where: {
          organizationId: pi.organizationId,
          status: { notIn: ["CANCELLED", "RESOLVED"] },
        },
      }),
    ]);

    const workItemIds = [
      ...new Set(
        dependencies
          .filter(
            (d) =>
              d.sourceType === "WORK_ITEM" || d.targetType === "WORK_ITEM",
          )
          .flatMap((d) => {
            const ids: string[] = [];
            if (d.sourceType === "WORK_ITEM") ids.push(d.sourceId);
            if (d.targetType === "WORK_ITEM") ids.push(d.targetId);
            return ids;
          }),
      ),
    ];
    const sequences =
      await this.dependencies.resolveWorkItemIterationSequences(
        piId,
        workItemIds,
      );

    const memberships = await this.db.resourceMembership.findMany({
      where: { effectiveTo: null },
      select: { resourceId: true, allocationPercent: true },
    });
    const resourceAllocationPercents: Record<string, number> = {};
    for (const m of memberships) {
      resourceAllocationPercents[m.resourceId] =
        (resourceAllocationPercents[m.resourceId] ?? 0) +
        Number(m.allocationPercent.toString());
    }

    const projectIds = [
      ...new Set(allocations.map((a) => a.workItem.project.id)),
    ];
    const milestones =
      projectIds.length === 0
        ? []
        : await this.db.projectMilestone.findMany({
            where: { projectId: { in: projectIds } },
          });

    return deriveConflicts({
      piId: pi.id,
      piStartDate: pi.startDate,
      piEndDate: pi.endDate,
      iterations: pi.iterations.map((i) => ({
        id: i.id,
        sequence: i.sequence,
        startDate: i.startDate,
        endDate: i.endDate,
      })),
      allocations: allocations.map((a) => ({
        id: a.id,
        workItemId: a.workItemId,
        iterationId: a.iterationId,
        teamId: a.teamId,
        resourceId: a.resourceId,
        plannedHours: a.plannedHours,
        workItemProjectId: a.workItem.project.id,
        projectPlannedStart: a.workItem.project.plannedStart,
        projectPlannedEnd: a.workItem.project.plannedEnd,
      })),
      teamCapacities: capacityViews.teams.map((t) => ({
        teamId: t.teamId,
        iterationId: t.iterationId,
        effectiveCapacityHours: t.effectiveCapacityHours,
        plannedLoadHours: t.plannedLoadHours,
      })),
      resourceCapacities: capacityViews.resources.map((r) => ({
        resourceId: r.resourceId,
        iterationId: r.iterationId,
        effectiveCapacityHours: r.effectiveCapacityHours,
        plannedLoadHours: r.plannedLoadHours,
      })),
      dependencies: dependencies.map((d) => ({
        id: d.id,
        type: d.type,
        status: d.status,
        criticality: d.criticality,
        sourceType: d.sourceType,
        sourceId: d.sourceId,
        targetType: d.targetType,
        targetId: d.targetId,
        sourceIterationSequence:
          d.sourceType === "WORK_ITEM"
            ? (sequences.get(d.sourceId) ?? null)
            : null,
        targetIterationSequence:
          d.targetType === "WORK_ITEM"
            ? (sequences.get(d.targetId) ?? null)
            : null,
      })),
      milestones: milestones.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        plannedDate: m.plannedDate,
        status: m.status,
        criticality: m.criticality,
      })),
      resourceAllocationPercents,
    });
  }

  /**
   * Executive overview metrics for home page — live PI counts only.
   */
  async getExecutivePiMetrics(principal: Principal) {
    const bindings = await this.db.roleBinding.findMany({
      where: { principalId: principal.id, effectiveTo: null },
      include: { roleDefinition: true },
    });
    const canReadAll = bindings.some(
      (b) =>
        b.scopeType === ScopeType.PLATFORM &&
        b.roleDefinition.permissions.includes(PERMISSIONS.PI_VIEW),
    );
    const orgIds = canReadAll
      ? undefined
      : bindings
          .filter(
            (b) =>
              b.organizationId &&
              b.roleDefinition.permissions.includes(PERMISSIONS.PI_VIEW),
          )
          .map((b) => b.organizationId!);

    if (!canReadAll && (!orgIds || orgIds.length === 0)) {
      return emptyExecutiveMetrics();
    }

    const where = orgIds ? { organizationId: { in: orgIds } } : {};
    const pis = await this.db.programIncrement.findMany({
      where,
      include: {
        baselines: { orderBy: { versionNumber: "desc" }, take: 1 },
        iterations: true,
        participatingDepartments: true,
      },
    });

    let planning = 0;
    let review = 0;
    let baselined = 0;
    let active = 0;
    let needsAttention = 0;
    let totalConflicts = 0;

    for (const pi of pis) {
      if (pi.status === "PLANNING" || pi.status === "DRAFT") planning += 1;
      if (pi.status === "REVIEW") review += 1;
      if (pi.status === "BASELINED") baselined += 1;
      if (pi.status === "ACTIVE") active += 1;

      let flagged = false;
      const attention = buildPiAttentionItems({
        status: pi.status,
        iterationCount: pi.iterations.length,
        participatingDepartmentCount: pi.participatingDepartments.length,
        allocationCount: 0,
        conflictCount: 0,
        baselineCount: pi.baselines.length,
        hasCurrentRevision: true,
      });
      if (attention.some((a) => a.severity === "blocker")) {
        flagged = true;
      }

      if (
        pi.status === "PLANNING" ||
        pi.status === "REVIEW" ||
        pi.status === "BASELINED" ||
        pi.status === "ACTIVE"
      ) {
        try {
          const conflicts = await this.deriveConflictsForPi(pi.id);
          const blockers = conflicts.filter((c) => c.severity === "BLOCKER");
          totalConflicts += blockers.length;
          if (blockers.length > 0) flagged = true;
        } catch {
          // Missing CURRENT revision should not break overview.
        }
      }

      if (flagged) needsAttention += 1;
    }

    return {
      programIncrements: pis.length,
      piPlanning: planning,
      piInReview: review,
      piBaselined: baselined,
      piActive: active,
      piNeedsAttention: needsAttention,
      piBlockerConflicts: totalConflicts,
    };
  }
}

function emptyExecutiveMetrics() {
  return {
    programIncrements: 0,
    piPlanning: 0,
    piInReview: 0,
    piBaselined: 0,
    piActive: 0,
    piNeedsAttention: 0,
    piBlockerConflicts: 0,
  };
}
