/**
 * M2A Portfolio Query Service — read-only, authorization-aware aggregation.
 *
 * Consumes authoritative domain tables only. No Portfolio tables / caches.
 */

import {
  type InitiativeStage,
  type Prisma,
  type PrismaClient,
  type ProjectStatus,
} from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import {
  isActiveBlockerIssue,
  isTerminalIssueStatus,
} from "@/modules/project/application/issue-policy";
import {
  effectiveResourceCapacity,
  toHoursNumber,
  utilization,
  utilizationBand,
} from "@/modules/pi-planning/application/capacity-policy";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import type {
  DependencyExposureCounts,
  ExperimentationCounts,
  GovernancePendingCounts,
  InitiativeLifecycleDistribution,
  IssuePortfolioCounts,
  OwnershipReference,
  PiCapacityPortfolioSummary,
  PiCapacityTeamSummary,
  PortfolioQueryInput,
  PortfolioSnapshot,
  ProjectStatusCounts,
} from "../domain/types";
import { resolvePortfolioVisibility } from "./portfolio-scope";

const STAGES: InitiativeStage[] = [
  "DEMAND",
  "REQUIREMENTS",
  "PRE_STUDY",
  "POC",
  "PILOT",
  "PROJECT",
];

const ACTIVE_POC = ["DRAFT", "READY", "IN_PROGRESS", "EVALUATION"] as const;

const ACTIVE_PILOT = ["DRAFT", "READY", "IN_PROGRESS", "EVALUATION"] as const;

/** PIs for which live capacity aggregation is meaningful. */
const CAPACITY_PI_STATUSES = [
  "PLANNING",
  "REVIEW",
  "BASELINED",
  "ACTIVE",
] as const;

function emptyLifecycle(): InitiativeLifecycleDistribution {
  return {
    total: 0,
    byStage: {
      DEMAND: 0,
      REQUIREMENTS: 0,
      PRE_STUDY: 0,
      POC: 0,
      PILOT: 0,
      PROJECT: 0,
    },
    byStatus: { ACTIVE: 0, ON_HOLD: 0, CANCELLED: 0 },
  };
}

export class PortfolioQueryService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Organization-scoped portfolio snapshot.
   * Enforces Phase 0C visibility before any aggregation.
   */
  async getPortfolioSnapshot(
    principal: Principal,
    input: PortfolioQueryInput,
  ): Promise<PortfolioSnapshot> {
    if (!input.organizationId?.trim()) {
      throw new AppError("VALIDATION", "organizationId is required.");
    }

    const asOf = input.asOf ?? new Date();
    const visibility = await resolvePortfolioVisibility(
      this.db,
      principal,
      input.organizationId,
      input.departmentId,
    );

    const deptFilter = visibility.departmentIds;

    const initiativeWhere: Prisma.InitiativeWhereInput = {
      organizationId: visibility.organizationId,
      status: { not: "ARCHIVED" },
      ...(deptFilter ? { departmentId: { in: deptFilter } } : {}),
    };

    const projectWhere: Prisma.ProjectWhereInput = {
      organizationId: visibility.organizationId,
      status: { not: "ARCHIVED" },
      ...(deptFilter ? { departmentId: { in: deptFilter } } : {}),
    };

    const [
      initiatives,
      projects,
      projectsWithDelaySignals,
      issues,
      pocs,
      pilots,
      submissions,
      pendingApprovalRequests,
      openDependencies,
      ownershipRows,
      piCapacity,
    ] = await Promise.all([
      this.loadInitiatives(initiativeWhere),
      this.loadProjectStatusCounts(projectWhere),
      this.loadProjectsForDelay(projectWhere),
      this.loadIssues(projectWhere),
      this.loadActivePocs(initiativeWhere),
      this.loadActivePilots(initiativeWhere),
      this.loadGovernanceSubmissions(initiativeWhere),
      this.loadPendingApprovalRequests(initiativeWhere),
      this.loadOpenDependencies(visibility.organizationId, deptFilter),
      this.loadOwnership(initiativeWhere, projectWhere),
      this.loadPiCapacity(principal, visibility.organizationId, deptFilter),
    ]);

    const lifecycle = this.summarizeInitiatives(initiatives);
    const delayed = this.classifyDelayedProjects(projectsWithDelaySignals, asOf);
    const issueCounts = this.summarizeIssues(issues);
    const governance = this.summarizeGovernance(
      submissions,
      pendingApprovalRequests,
    );

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "portfolio.query.snapshot",
      subjectType: "Organization",
      subjectId: visibility.organizationId,
      organizationId: visibility.organizationId,
      payload: {
        scopeMode: visibility.applied.mode,
        departmentCount:
          visibility.applied.mode === "departments"
            ? visibility.applied.departmentIds.length
            : null,
        asOf: asOf.toISOString(),
      },
      result: "success",
    });

    return {
      asOf: asOf.toISOString(),
      scope: visibility.applied,
      initiatives: { available: true, value: lifecycle },
      projects: { available: true, value: projects },
      governance: { available: true, value: governance },
      experimentation: {
        available: true,
        value: { activePocs: pocs, activePilots: pilots } satisfies ExperimentationCounts,
      },
      issues: { available: true, value: issueCounts },
      delayedProjects: {
        available: true,
        value: {
          delayedProjects: delayed,
          definition: "milestone_missed_or_planned_end_past",
        },
      },
      ownership: { available: true, value: ownershipRows },
      dependencies: { available: true, value: openDependencies },
      piCapacity,
    };
  }

  private summarizeInitiatives(
    rows: Array<{ currentStage: InitiativeStage; status: string }>,
  ): InitiativeLifecycleDistribution {
    const out = emptyLifecycle();
    out.total = rows.length;
    for (const row of rows) {
      if (STAGES.includes(row.currentStage)) {
        out.byStage[row.currentStage] += 1;
      }
      if (
        row.status === "ACTIVE" ||
        row.status === "ON_HOLD" ||
        row.status === "CANCELLED"
      ) {
        out.byStatus[row.status] += 1;
      }
    }
    return out;
  }

  private async loadInitiatives(where: Prisma.InitiativeWhereInput) {
    return this.db.initiative.findMany({
      where,
      select: { id: true, currentStage: true, status: true },
    });
  }

  private async loadProjectStatusCounts(
    where: Prisma.ProjectWhereInput,
  ): Promise<ProjectStatusCounts> {
    const grouped = await this.db.project.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    const counts: ProjectStatusCounts = {
      active: 0,
      onHold: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const row of grouped) {
      const n = row._count._all;
      const status = row.status as ProjectStatus;
      if (status === "ACTIVE") counts.active = n;
      else if (status === "ON_HOLD") counts.onHold = n;
      else if (status === "COMPLETED") counts.completed = n;
      else if (status === "CANCELLED") counts.cancelled = n;
    }
    return counts;
  }

  private async loadProjectsForDelay(where: Prisma.ProjectWhereInput) {
    return this.db.project.findMany({
      where: {
        ...where,
        status: { in: ["ACTIVE", "ON_HOLD"] },
      },
      select: {
        id: true,
        plannedEnd: true,
        milestones: { select: { status: true } },
      },
    });
  }

  private classifyDelayedProjects(
    projects: Array<{
      plannedEnd: Date | null;
      milestones: Array<{ status: string }>;
    }>,
    asOf: Date,
  ): number {
    let delayed = 0;
    for (const p of projects) {
      const missed = p.milestones.some((m) => m.status === "MISSED");
      const pastEnd = p.plannedEnd != null && p.plannedEnd < asOf;
      if (missed || pastEnd) delayed += 1;
    }
    return delayed;
  }

  private async loadIssues(projectWhere: Prisma.ProjectWhereInput) {
    return this.db.projectIssue.findMany({
      where: { project: projectWhere },
      select: { status: true, severity: true, isBlocker: true },
    });
  }

  private summarizeIssues(
    issues: Array<{ status: string; severity: string; isBlocker: boolean }>,
  ): IssuePortfolioCounts {
    const open = issues.filter(
      (i) => !isTerminalIssueStatus(i.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"),
    );
    return {
      openIssues: open.length,
      criticalOpenIssues: open.filter((i) => i.severity === "CRITICAL").length,
      activeBlockers: issues.filter((i) =>
        isActiveBlockerIssue({
          isBlocker: i.isBlocker,
          status: i.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
        }),
      ).length,
    };
  }

  private async loadActivePocs(initiativeWhere: Prisma.InitiativeWhereInput) {
    return this.db.poC.count({
      where: {
        status: { in: [...ACTIVE_POC] },
        initiative: initiativeWhere,
      },
    });
  }

  private async loadActivePilots(initiativeWhere: Prisma.InitiativeWhereInput) {
    return this.db.pilot.count({
      where: {
        status: { in: [...ACTIVE_PILOT] },
        initiative: initiativeWhere,
      },
    });
  }

  private async loadGovernanceSubmissions(
    initiativeWhere: Prisma.InitiativeWhereInput,
  ) {
    return this.db.governanceSubmission.findMany({
      where: {
        initiative: initiativeWhere,
        status: {
          in: ["SUBMITTED", "IN_REVIEW", "APPROVALS_COMPLETE"],
        },
      },
      select: { id: true, status: true },
    });
  }

  private async loadPendingApprovalRequests(
    initiativeWhere: Prisma.InitiativeWhereInput,
  ) {
    return this.db.approvalRequest.count({
      where: {
        status: "PENDING",
        submission: { initiative: initiativeWhere },
      },
    });
  }

  private summarizeGovernance(
    submissions: Array<{ status: string }>,
    pendingApprovalRequests: number,
  ): GovernancePendingCounts {
    return {
      waitingForApproval: submissions.filter(
        (s) => s.status === "SUBMITTED" || s.status === "IN_REVIEW",
      ).length,
      waitingForDecision: submissions.filter(
        (s) => s.status === "APPROVALS_COMPLETE",
      ).length,
      pendingApprovalRequests,
    };
  }

  private async loadOpenDependencies(
    organizationId: string,
    departmentIds: string[] | null,
  ): Promise<DependencyExposureCounts> {
    // PlanningDependency subjects are PROJECT | WORK_ITEM only (schema).
    // Department-scoped views include a dependency when either endpoint resolves
    // to an in-scope Project (WORK_ITEM → project.departmentId).
    const open = await this.db.planningDependency.findMany({
      where: {
        organizationId,
        status: "OPEN",
      },
      select: {
        id: true,
        criticality: true,
        sourceType: true,
        sourceId: true,
        targetType: true,
        targetId: true,
      },
    });

    if (departmentIds === null) {
      return {
        openDependencies: open.length,
        criticalOpenDependencies: open.filter((d) => d.criticality === "CRITICAL")
          .length,
      };
    }

    const projects = await this.db.project.findMany({
      where: {
        organizationId,
        departmentId: { in: departmentIds },
      },
      select: { id: true },
    });
    const projectIds = new Set(projects.map((p) => p.id));
    const workItems = await this.db.projectWorkItem.findMany({
      where: { projectId: { in: [...projectIds] } },
      select: { id: true },
    });
    const workItemIds = new Set(workItems.map((w) => w.id));

    const endpointInScope = (type: string, id: string) =>
      (type === "PROJECT" && projectIds.has(id)) ||
      (type === "WORK_ITEM" && workItemIds.has(id));

    const inScope = open.filter(
      (d) =>
        endpointInScope(d.sourceType, d.sourceId) ||
        endpointInScope(d.targetType, d.targetId),
    );

    return {
      openDependencies: inScope.length,
      criticalOpenDependencies: inScope.filter((d) => d.criticality === "CRITICAL")
        .length,
    };
  }

  private async loadOwnership(
    initiativeWhere: Prisma.InitiativeWhereInput,
    projectWhere: Prisma.ProjectWhereInput,
  ): Promise<OwnershipReference[]> {
    const [initiatives, projects, pocs, pilots] = await Promise.all([
      this.db.initiative.findMany({
        where: {
          ...initiativeWhere,
          businessOwnerResourceId: { not: null },
        },
        select: {
          businessOwnerResourceId: true,
          businessOwnerResource: { select: { id: true, name: true } },
        },
      }),
      this.db.project.findMany({
        where: { ...projectWhere, ownerResourceId: { not: null } },
        select: {
          ownerResourceId: true,
          ownerResource: { select: { id: true, name: true } },
        },
      }),
      this.db.poC.findMany({
        where: {
          ownerResourceId: { not: null },
          initiative: initiativeWhere,
        },
        select: {
          ownerResourceId: true,
          ownerResource: { select: { id: true, name: true } },
        },
      }),
      this.db.pilot.findMany({
        where: {
          ownerResourceId: { not: null },
          initiative: initiativeWhere,
        },
        select: {
          ownerResourceId: true,
          ownerResource: { select: { id: true, name: true } },
        },
      }),
    ]);

    const map = new Map<string, OwnershipReference>();
    const ensure = (id: string, name: string | null | undefined) => {
      let row = map.get(id);
      if (!row) {
        row = {
          resourceId: id,
          displayName: name ?? null,
          initiativeBusinessOwnerCount: 0,
          projectOwnerCount: 0,
          pocOwnerCount: 0,
          pilotOwnerCount: 0,
        };
        map.set(id, row);
      }
      return row;
    };

    for (const i of initiatives) {
      if (!i.businessOwnerResourceId) continue;
      ensure(i.businessOwnerResourceId, i.businessOwnerResource?.name)
        .initiativeBusinessOwnerCount += 1;
    }
    for (const p of projects) {
      if (!p.ownerResourceId) continue;
      ensure(p.ownerResourceId, p.ownerResource?.name).projectOwnerCount += 1;
    }
    for (const p of pocs) {
      if (!p.ownerResourceId) continue;
      ensure(p.ownerResourceId, p.ownerResource?.name).pocOwnerCount += 1;
    }
    for (const p of pilots) {
      if (!p.ownerResourceId) continue;
      ensure(p.ownerResourceId, p.ownerResource?.name).pilotOwnerCount += 1;
    }

    return [...map.values()].sort((a, b) =>
      (a.displayName ?? a.resourceId).localeCompare(
        b.displayName ?? b.resourceId,
      ),
    );
  }

  /**
   * Live PI capacity using the same capacity-policy helpers as CapacityService.
   * Does not read immutable PiBaseline payloads (those are historical snapshots).
   * Returns unavailable when no in-scope PI has participations / iterations.
   */
  private async loadPiCapacity(
    principal: Principal,
    organizationId: string,
    departmentIds: string[] | null,
  ): Promise<PortfolioSnapshot["piCapacity"]> {
    const pis = await this.db.programIncrement.findMany({
      where: {
        organizationId,
        status: { in: [...CAPACITY_PI_STATUSES] },
      },
      select: {
        id: true,
        organizationId: true,
        sectionId: true,
        status: true,
      },
    });

    const visiblePiIds: string[] = [];
    for (const pi of pis) {
      const allowed = pi.sectionId
        ? await this.authz.can(principal, PERMISSIONS.PI_VIEW, {
            type: "SECTION",
            organizationId: pi.organizationId,
            sectionId: pi.sectionId,
          })
        : await this.authz.can(principal, PERMISSIONS.PI_VIEW, {
            type: "ORGANIZATION",
            organizationId: pi.organizationId,
          });
      if (allowed) visiblePiIds.push(pi.id);
    }

    if (visiblePiIds.length === 0) {
      return {
        available: false,
        reason:
          "No Program Increments with PI_VIEW access in PLANNING/REVIEW/BASELINED/ACTIVE for this scope.",
      };
    }

    const teams: PiCapacityTeamSummary[] = [];

    for (const piId of visiblePiIds) {
      const pi = await this.db.programIncrement.findUnique({
        where: { id: piId },
        include: {
          iterations: { orderBy: { startDate: "asc" } },
          participatingTeams: {
            include: {
              team: { select: { id: true, name: true, departmentId: true } },
            },
          },
        },
      });
      if (!pi || pi.iterations.length === 0) continue;

      const participatingTeams = pi.participatingTeams.filter((pt) =>
        departmentIds === null ? true : departmentIds.includes(pt.departmentId),
      );
      if (participatingTeams.length === 0) continue;

      const revision = await this.db.planningRevision.findFirst({
        where: { piId, isCurrent: true },
        select: { id: true },
      });
      if (!revision) {
        // Without a current revision, planned load is undefined — skip PI rather than fake zeros.
        continue;
      }

      const teamIds = participatingTeams.map((t) => t.teamId);
      const memberships = await this.db.resourceMembership.findMany({
        where: { teamId: { in: teamIds }, effectiveTo: null },
        include: {
          resource: {
            select: { id: true, name: true, capacityHoursPerWeek: true },
          },
        },
      });
      const availabilities = await this.db.resourceAvailability.findMany({
        where: {
          iterationId: { in: pi.iterations.map((i) => i.id) },
          resourceId: { in: memberships.map((m) => m.resourceId) },
        },
      });
      const availMap = new Map(
        availabilities.map(
          (a) => [`${a.resourceId}:${a.iterationId}`, a] as const,
        ),
      );
      const allocations = await this.db.workAllocation.findMany({
        where: { revisionId: revision.id },
      });

      for (const iteration of pi.iterations) {
        for (const pt of participatingTeams) {
          const teamMemberships = memberships.filter(
            (m) => m.teamId === pt.teamId,
          );
          let teamCapacityHours = 0;
          for (const m of teamMemberships) {
            const avail = availMap.get(`${m.resourceId}:${iteration.id}`);
            teamCapacityHours += effectiveResourceCapacity({
              capacityHoursPerWeek: m.resource.capacityHoursPerWeek,
              allocationPercent: m.allocationPercent,
              startDate: iteration.startDate,
              endDate: iteration.endDate,
              availableHoursOverride: avail?.availableHours,
              reductionHours: avail?.reductionHours,
            });
          }
          const teamLoad = allocations
            .filter(
              (a) =>
                a.iterationId === iteration.id && a.teamId === pt.teamId,
            )
            .reduce((s, a) => s + toHoursNumber(a.plannedHours), 0);
          const util = utilization(teamLoad, teamCapacityHours);
          const band = utilizationBand(util);
          teams.push({
            teamId: pt.teamId,
            teamName: pt.team.name,
            departmentId: pt.departmentId,
            piId,
            iterationId: iteration.id,
            effectiveCapacityHours: teamCapacityHours,
            plannedLoadHours: teamLoad,
            utilization: util,
            band,
          });
        }
      }
    }

    if (teams.length === 0) {
      return {
        available: false,
        reason:
          "Visible PIs have no in-scope participating teams with a current planning revision for live capacity aggregation.",
      };
    }

    const summary: PiCapacityPortfolioSummary = {
      source: "live_capacity_policy",
      piCountConsidered: new Set(teams.map((t) => t.piId)).size,
      teamIterationRows: teams.length,
      overloadedTeamIterations: teams.filter((t) => t.band === "overload")
        .length,
      nearCapacityTeamIterations: teams.filter((t) => t.band === "near").length,
      teams,
    };

    return { available: true, value: summary };
  }
}
