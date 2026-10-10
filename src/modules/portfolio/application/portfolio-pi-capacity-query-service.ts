/**
 * M2E-A — Portfolio PI & capacity read queries.
 *
 * Reuses capacity-policy + CapacityService + conflict derivation.
 * No second calculation engine; no Portfolio tables; no baseline/live mix-up.
 */

import type { PiStatus, PrismaClient } from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import {
  CAPACITY_THRESHOLDS,
  toHoursNumber,
  utilization,
  utilizationBand,
} from "@/modules/pi-planning/application/capacity-policy";
import type { PlanningService } from "@/modules/pi-planning/application/planning-service";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import type {
  PortfolioCapacityHours,
  PortfolioPiBaselineComparison,
  PortfolioPiCapacityInput,
  PortfolioPiCapacityResult,
  PortfolioPiConflictRow,
  PortfolioPiDepartmentCapacityRow,
  PortfolioPiLifecycleBucket,
  PortfolioPiListInput,
  PortfolioPiListItem,
  PortfolioPiListResult,
  PortfolioPiProjectCommitmentRow,
  PortfolioPiResourceProjectSegment,
  PortfolioPiStatus,
  PortfolioPiTeamCapacityRow,
  PortfolioQueryScopeApplied,
} from "../domain/types";
import { resolvePortfolioVisibility } from "./portfolio-scope";

const DEFAULT_PAGE = 25;
const MAX_PAGE = 100;

function hoursSummary(
  availableHours: number,
  committedHours: number,
): PortfolioCapacityHours {
  const util = utilization(committedHours, availableHours);
  return {
    availableHours,
    committedHours,
    remainingHours: availableHours - committedHours,
    utilization: util,
    band: utilizationBand(util),
  };
}

/**
 * Lifecycle bucket from PI status + dates (asOf).
 * ACTIVE: status ACTIVE.
 * COMPLETED: status CLOSED.
 * UPCOMING: not CLOSED/ACTIVE and startDate > asOf.
 * OTHER: everything else (e.g. past-dated DRAFT/PLANNING, or ACTIVE edge cases).
 */
export function classifyPiLifecycle(
  status: PiStatus | string,
  startDate: Date,
  _endDate: Date,
  asOf: Date,
): PortfolioPiLifecycleBucket {
  if (status === "CLOSED") return "COMPLETED";
  if (status === "ACTIVE") return "ACTIVE";
  if (startDate.getTime() > asOf.getTime()) return "UPCOMING";
  return "OTHER";
}

export class PortfolioPiCapacityQueryService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly planning: PlanningService,
  ) {}

  async listProgramIncrements(
    principal: Principal,
    input: PortfolioPiListInput,
  ): Promise<PortfolioPiListResult> {
    if (!input.organizationId?.trim()) {
      throw new AppError("VALIDATION", "organizationId is required.");
    }
    const asOf = input.asOf ?? new Date();
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(MAX_PAGE, Math.max(1, input.pageSize ?? DEFAULT_PAGE));

    const { visibility, deptIds, scope } = await this.resolveScope(
      principal,
      input.organizationId,
      input.departmentId,
      input.sectionId,
    );

    const pis = await this.db.programIncrement.findMany({
      where: {
        organizationId: visibility.organizationId,
        ...(input.sectionId ? { sectionId: input.sectionId } : {}),
        ...(input.piId ? { id: input.piId } : {}),
      },
      select: {
        id: true,
        referenceKey: true,
        name: true,
        status: true,
        sectionId: true,
        startDate: true,
        endDate: true,
        organizationId: true,
        revisions: {
          where: { isCurrent: true },
          select: { id: true },
          take: 1,
        },
        baselines: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { versionNumber: true },
        },
        _count: { select: { baselines: true } },
        participatingDepartments: { select: { departmentId: true } },
      },
      orderBy: [{ startDate: "desc" }, { referenceKey: "asc" }],
    });

    const lifecycleFilter =
      input.lifecycle && input.lifecycle.length > 0
        ? new Set(input.lifecycle)
        : null;

    const rows: PortfolioPiListItem[] = [];
    for (const pi of pis) {
      const canView = await this.canViewPi(principal, pi);
      if (!canView) continue;

      // Department filter: PI included when any participating dept is in scope,
      // or when org-wide with no dept filter, or PI has no participating depts yet
      // and section/org scope already matched.
      if (deptIds !== null) {
        const partDepts = pi.participatingDepartments.map((d) => d.departmentId);
        if (partDepts.length > 0) {
          const overlap = partDepts.some((id) => deptIds.includes(id));
          if (!overlap) continue;
        }
      }

      const lifecycle = classifyPiLifecycle(
        pi.status,
        pi.startDate,
        pi.endDate,
        asOf,
      );
      if (lifecycleFilter && !lifecycleFilter.has(lifecycle)) continue;

      rows.push({
        piId: pi.id,
        referenceKey: pi.referenceKey,
        name: pi.name,
        status: pi.status as PortfolioPiStatus,
        lifecycle,
        sectionId: pi.sectionId,
        startDate: pi.startDate.toISOString(),
        endDate: pi.endDate.toISOString(),
        href: `/pi/${pi.id}`,
        hasCurrentRevision: pi.revisions.length > 0,
        baselineCount: pi._count.baselines,
        latestBaselineVersion: pi.baselines[0]?.versionNumber ?? null,
      });
    }

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "portfolio.query.pi_list",
      subjectType: "Organization",
      subjectId: visibility.organizationId,
      organizationId: visibility.organizationId,
      payload: { total, page, pageSize, asOf: asOf.toISOString() },
      result: "success",
    });

    return {
      asOf: asOf.toISOString(),
      scope,
      page,
      pageSize,
      total,
      rows: pageRows,
    };
  }

  async getPiCapacityOverview(
    principal: Principal,
    input: PortfolioPiCapacityInput,
  ): Promise<PortfolioPiCapacityResult> {
    if (!input.organizationId?.trim()) {
      throw new AppError("VALIDATION", "organizationId is required.");
    }
    const asOf = input.asOf ?? new Date();
    const { visibility, deptIds, scope } = await this.resolveScope(
      principal,
      input.organizationId,
      input.departmentId,
      input.sectionId,
    );

    if (!input.piId) {
      return {
        asOf: asOf.toISOString(),
        scope,
        capacity: {
          state: "no_pi_selected",
          reason: "Select a Program Increment to load live capacity metrics.",
        },
      };
    }

    const pi = await this.db.programIncrement.findFirst({
      where: {
        id: input.piId,
        organizationId: visibility.organizationId,
      },
      include: {
        iterations: { orderBy: { sequence: "asc" } },
        participatingTeams: {
          include: {
            team: { select: { id: true, name: true, departmentId: true } },
          },
        },
        participatingDepartments: { select: { departmentId: true } },
      },
    });

    if (!pi) {
      throw new AppError("NOT_FOUND", "Program Increment not found.", {
        details: { piId: input.piId },
      });
    }

    if (!(await this.canViewPi(principal, pi))) {
      throw new AppError("FORBIDDEN", "Missing PI view permission.", {
        details: { piId: pi.id },
      });
    }

    if (deptIds !== null) {
      const partDepts = pi.participatingDepartments.map((d) => d.departmentId);
      if (
        partDepts.length > 0 &&
        !partDepts.some((id) => deptIds.includes(id))
      ) {
        throw new AppError(
          "FORBIDDEN",
          "Program Increment is outside portfolio department scope.",
          { details: { piId: pi.id } },
        );
      }
    }

    const revision = await this.db.planningRevision.findFirst({
      where: { piId: pi.id, isCurrent: true },
      select: { id: true, key: true, version: true, isCurrent: true },
    });

    if (!revision) {
      return {
        asOf: asOf.toISOString(),
        scope,
        capacity: {
          state: "unavailable",
          reason:
            "No CURRENT planning revision exists for this PI; live capacity cannot be calculated.",
        },
      };
    }

    const participatingTeams = pi.participatingTeams.filter((pt) =>
      deptIds === null ? true : deptIds.includes(pt.departmentId),
    );

    if (participatingTeams.length === 0) {
      return {
        asOf: asOf.toISOString(),
        scope,
        capacity: {
          state: "unavailable",
          reason:
            pi.participatingTeams.length === 0
              ? "No participating teams are registered on this Program Increment."
              : "No participating teams are visible in the current portfolio department scope.",
        },
      };
    }

    if (pi.iterations.length === 0) {
      return {
        asOf: asOf.toISOString(),
        scope,
        capacity: {
          state: "unavailable",
          reason: "Program Increment has no iterations; capacity period is undefined.",
        },
      };
    }

    // Live capacity via CapacityService.computeCapacityViews (same formulas as
    // planning board). Auth already enforced above; avoid double PI_VIEW assert.
    const capacityViews = await this.planning.capacity.computeCapacityViews(
      pi.id,
    );

    const teamIdSet = new Set(participatingTeams.map((t) => t.teamId));
    const iterationName = new Map(
      pi.iterations.map((i) => [i.id, i.name] as const),
    );
    const teamMeta = new Map(
      participatingTeams.map((t) => [
        t.teamId,
        { name: t.team.name, departmentId: t.departmentId },
      ]),
    );

    const teamsScoped = capacityViews.teams.filter((t) => teamIdSet.has(t.teamId));
    const resourcesScoped = capacityViews.resources.filter((r) =>
      teamIdSet.has(r.teamId),
    );

    const teams: PortfolioPiTeamCapacityRow[] = teamsScoped.map((t) => {
      const meta = teamMeta.get(t.teamId);
      const h = hoursSummary(t.effectiveCapacityHours, t.plannedLoadHours);
      return {
        teamId: t.teamId,
        teamName: meta?.name ?? t.teamName,
        departmentId: meta?.departmentId ?? t.departmentId,
        iterationId: t.iterationId,
        iterationName: iterationName.get(t.iterationId) ?? t.iterationId,
        ...h,
      };
    });

    const overloadedTeams = teams.filter((t) => t.band === "overload");
    const underutilizedTeams = teams.filter((t) => t.band === "under");

    // Department roll-up across team-iteration rows (sum hours; util recalculated).
    const deptAgg = new Map<
      string,
      { name: string; available: number; committed: number }
    >();
    const deptIdsNeeded = [...new Set(teams.map((t) => t.departmentId))];
    const departments = await this.db.department.findMany({
      where: { id: { in: deptIdsNeeded } },
      select: { id: true, name: true },
    });
    const deptName = new Map(departments.map((d) => [d.id, d.name] as const));
    for (const t of teams) {
      const row = deptAgg.get(t.departmentId) ?? {
        name: deptName.get(t.departmentId) ?? t.departmentId,
        available: 0,
        committed: 0,
      };
      row.available += t.availableHours;
      row.committed += t.committedHours;
      deptAgg.set(t.departmentId, row);
    }
    const departmentRows: PortfolioPiDepartmentCapacityRow[] = [
      ...deptAgg.entries(),
    ]
      .map(([departmentId, v]) => ({
        departmentId,
        departmentName: v.name,
        ...hoursSummary(v.available, v.committed),
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));

    const totals = hoursSummary(
      teams.reduce((s, t) => s + t.availableHours, 0),
      teams.reduce((s, t) => s + t.committedHours, 0),
    );

    // Resources (bounded pagination) — only members of participating teams.
    const includeResources = input.includeResources !== false;
    const resourcePage = Math.max(1, input.resourcePage ?? 1);
    const resourcePageSize = Math.min(
      MAX_PAGE,
      Math.max(1, input.resourcePageSize ?? DEFAULT_PAGE),
    );
    // Project commitments + per-resource segments from the same CURRENT allocations.
    let projectCommitments: PortfolioPiProjectCommitmentRow[] = [];
    let resourceProjectSegments = new Map<
      string,
      PortfolioPiResourceProjectSegment[]
    >();
    if (
      input.includeProjectCommitments !== false ||
      includeResources
    ) {
      const loaded = await this.loadAllocationProjectBreakdown(
        revision.id,
        teamIdSet,
      );
      if (input.includeProjectCommitments !== false) {
        projectCommitments = loaded.commitments;
      }
      resourceProjectSegments = loaded.byResourceTeamIteration;
    }

    const resourceRowsAll = includeResources
      ? resourcesScoped.map((r) => ({
          resourceId: r.resourceId,
          resourceName: r.resourceName,
          teamId: r.teamId,
          iterationId: r.iterationId,
          membershipAllocationPercent: r.allocationPercent,
          projectSegments:
            resourceProjectSegments.get(
              `${r.resourceId}:${r.teamId}:${r.iterationId}`,
            ) ?? [],
          ...hoursSummary(r.effectiveCapacityHours, r.plannedLoadHours),
        }))
      : [];
    resourceRowsAll.sort((a, b) => {
      const byName = a.resourceName.localeCompare(b.resourceName);
      if (byName !== 0) return byName;
      return a.iterationId.localeCompare(b.iterationId);
    });
    const resources = {
      page: resourcePage,
      pageSize: resourcePageSize,
      total: resourceRowsAll.length,
      rows: resourceRowsAll.slice(
        (resourcePage - 1) * resourcePageSize,
        resourcePage * resourcePageSize,
      ),
    };

    // Conflicts via existing engine
    let conflicts: PortfolioPiConflictRow[] = [];
    if (input.includeConflicts !== false) {
      const derived = await this.planning.deriveConflictsForPi(pi.id);
      conflicts = derived
        .filter((c) => {
          if (c.subjectType === "TEAM" && !teamIdSet.has(c.subjectId)) {
            return false;
          }
          return true;
        })
        .map((c) => ({
          type: c.type,
          severity: c.severity,
          message: c.message,
          subjectType: c.subjectType,
          subjectId: c.subjectId,
          relatedIds: c.relatedIds ?? [],
        }));
    }

    const baselineComparison = await this.compareBaseline(
      pi.id,
      totals.committedHours,
    );

    const dataQuality = await this.assessDataQuality(
      [...teamIdSet],
      pi.iterations.map((i) => i.id),
    );

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "portfolio.query.pi_capacity",
      subjectType: "ProgramIncrement",
      subjectId: pi.id,
      organizationId: visibility.organizationId,
      payload: {
        revisionId: revision.id,
        teamRows: teams.length,
        asOf: asOf.toISOString(),
        nearThreshold: CAPACITY_THRESHOLDS.nearCapacity,
        underThreshold: CAPACITY_THRESHOLDS.underAllocation,
        missingCapacityInputs: dataQuality.missingCapacityInputs,
      },
      result: "success",
    });

    return {
      asOf: asOf.toISOString(),
      scope,
      capacity: {
        state: "ready",
        meta: {
          piId: pi.id,
          referenceKey: pi.referenceKey,
          name: pi.name,
          status: pi.status as PortfolioPiStatus,
          startDate: pi.startDate.toISOString(),
          endDate: pi.endDate.toISOString(),
          revision: {
            id: revision.id,
            key: revision.key,
            version: revision.version,
            isCurrent: true,
          },
          source: "live_capacity_policy",
        },
        totals,
        departments: departmentRows,
        teams,
        overloadedTeams,
        underutilizedTeams,
        resources,
        projectCommitments,
        conflicts,
        baselineComparison,
        dataQuality,
      },
    };
  }

  private async assessDataQuality(
    teamIds: string[],
    iterationIds: string[],
  ): Promise<{ missingCapacityInputs: boolean; notes: string[] }> {
    const notes: string[] = [];
    if (teamIds.length === 0) {
      return { missingCapacityInputs: false, notes };
    }
    const memberships = await this.db.resourceMembership.findMany({
      where: { teamId: { in: teamIds }, effectiveTo: null },
      select: {
        resourceId: true,
        resource: { select: { capacityHoursPerWeek: true, name: true } },
      },
    });
    const availOverrides = await this.db.resourceAvailability.findMany({
      where: {
        iterationId: { in: iterationIds },
        resourceId: { in: memberships.map((m) => m.resourceId) },
        availableHours: { not: null },
      },
      select: { resourceId: true },
    });
    const overridden = new Set(availOverrides.map((a) => a.resourceId));
    const missing = memberships.filter(
      (m) =>
        m.resource.capacityHoursPerWeek == null &&
        !overridden.has(m.resourceId),
    );
    if (missing.length > 0) {
      notes.push(
        `${missing.length} resource membership(s) lack capacityHoursPerWeek and have no ResourceAvailability availableHours override; effective capacity treats them as 0 hours (not unavailable).`,
      );
    }
    return { missingCapacityInputs: missing.length > 0, notes };
  }

  /**
   * CURRENT revision WorkAllocation → Project breakdown for portfolio commitments
   * and per-resource stacked bars (hours only — no invented FTE/workstream %).
   */
  private async loadAllocationProjectBreakdown(
    revisionId: string,
    teamIdSet: Set<string>,
  ): Promise<{
    commitments: PortfolioPiProjectCommitmentRow[];
    byResourceTeamIteration: Map<string, PortfolioPiResourceProjectSegment[]>;
  }> {
    const allocations = await this.db.workAllocation.findMany({
      where: {
        revisionId,
        teamId: { in: [...teamIdSet] },
      },
      select: {
        id: true,
        plannedHours: true,
        workItemId: true,
        resourceId: true,
        teamId: true,
        iterationId: true,
        workItem: {
          select: {
            id: true,
            projectId: true,
            project: {
              select: {
                id: true,
                initiativeId: true,
                referenceKey: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const map = new Map<
      string,
      {
        project: {
          id: string;
          initiativeId: string;
          referenceKey: string;
          name: string;
        };
        hours: number;
        workItems: Set<string>;
        allocations: number;
      }
    >();

    type SegAgg = {
      projectId: string;
      initiativeId: string;
      referenceKey: string;
      name: string;
      href: string;
      committedHours: number;
    };
    const byKey = new Map<string, Map<string, SegAgg>>();

    for (const a of allocations) {
      const p = a.workItem.project;
      const row = map.get(p.id) ?? {
        project: p,
        hours: 0,
        workItems: new Set<string>(),
        allocations: 0,
      };
      const hours = toHoursNumber(a.plannedHours);
      row.hours += hours;
      row.workItems.add(a.workItemId);
      row.allocations += 1;
      map.set(p.id, row);

      if (!a.resourceId) continue;
      const key = `${a.resourceId}:${a.teamId}:${a.iterationId}`;
      let segMap = byKey.get(key);
      if (!segMap) {
        segMap = new Map();
        byKey.set(key, segMap);
      }
      const existing = segMap.get(p.id);
      if (existing) {
        existing.committedHours += hours;
      } else {
        segMap.set(p.id, {
          projectId: p.id,
          initiativeId: p.initiativeId,
          referenceKey: p.referenceKey,
          name: p.name,
          href: `/initiatives/${p.initiativeId}/project`,
          committedHours: hours,
        });
      }
    }

    const byResourceTeamIteration = new Map<
      string,
      PortfolioPiResourceProjectSegment[]
    >();
    for (const [key, segMap] of byKey) {
      byResourceTeamIteration.set(
        key,
        [...segMap.values()].sort(
          (a, b) => b.committedHours - a.committedHours,
        ),
      );
    }

    const commitments = [...map.values()]
      .map((r) => ({
        projectId: r.project.id,
        initiativeId: r.project.initiativeId,
        referenceKey: r.project.referenceKey,
        name: r.project.name,
        href: `/initiatives/${r.project.initiativeId}/project`,
        committedHours: r.hours,
        workItemCount: r.workItems.size,
        allocationCount: r.allocations,
      }))
      .sort((a, b) => b.committedHours - a.committedHours);

    return { commitments, byResourceTeamIteration };
  }

  private async compareBaseline(
    piId: string,
    liveCommittedHours: number,
  ): Promise<PortfolioPiBaselineComparison> {
    const baseline = await this.db.piBaseline.findFirst({
      where: { piId },
      orderBy: { versionNumber: "desc" },
      select: {
        id: true,
        versionNumber: true,
        createdAt: true,
        revisionIdCaptured: true,
        payload: true,
      },
    });

    if (!baseline) {
      return {
        available: false,
        reason: "No approved PiBaseline exists for this Program Increment.",
      };
    }

    const payload = baseline.payload as {
      schemaVersion?: number;
      allocations?: Array<{ plannedHours?: string | number }>;
      capturedAt?: string;
    };

    if (
      payload?.schemaVersion !== 1 ||
      !Array.isArray(payload.allocations)
    ) {
      return {
        available: false,
        reason:
          "Latest baseline payload is not a recognized schemaVersion=1 snapshot; comparison unavailable.",
      };
    }

    const baselineCommittedHours = payload.allocations.reduce(
      (s, a) => s + toHoursNumber(a.plannedHours),
      0,
    );

    return {
      available: true,
      baselineId: baseline.id,
      versionNumber: baseline.versionNumber,
      capturedAt:
        payload.capturedAt ?? baseline.createdAt.toISOString(),
      revisionIdCaptured: baseline.revisionIdCaptured,
      baselineCommittedHours,
      liveCommittedHours,
      deltaHours: liveCommittedHours - baselineCommittedHours,
    };
  }

  private async canViewPi(
    principal: Principal,
    pi: { organizationId: string; sectionId: string | null },
  ): Promise<boolean> {
    if (pi.sectionId) {
      return this.authz.can(principal, PERMISSIONS.PI_VIEW, {
        type: "SECTION",
        organizationId: pi.organizationId,
        sectionId: pi.sectionId,
      });
    }
    return this.authz.can(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
  }

  private async resolveScope(
    principal: Principal,
    organizationId: string,
    departmentId?: string,
    sectionId?: string,
  ): Promise<{
    visibility: Awaited<ReturnType<typeof resolvePortfolioVisibility>>;
    deptIds: string[] | null;
    scope: PortfolioQueryScopeApplied;
  }> {
    const visibility = await resolvePortfolioVisibility(
      this.db,
      principal,
      organizationId,
      departmentId,
    );

    let deptIds = visibility.departmentIds;
    if (sectionId) {
      const section = await this.db.section.findUnique({
        where: { id: sectionId },
        select: {
          id: true,
          status: true,
          organizationId: true,
          departments: {
            where: { status: "ACTIVE" },
            select: { id: true },
          },
        },
      });
      if (
        !section ||
        section.status !== "ACTIVE" ||
        section.organizationId !== visibility.organizationId
      ) {
        throw new AppError("NOT_FOUND", "Section not found in organization.");
      }
      const sectionDeptIds = section.departments.map((d) => d.id);
      const allowed =
        deptIds === null
          ? sectionDeptIds
          : sectionDeptIds.filter((id) => deptIds!.includes(id));
      if (allowed.length === 0) {
        throw new AppError(
          "FORBIDDEN",
          "No department in this section is visible for portfolio PI queries.",
        );
      }
      deptIds = allowed;
    }

    const scope: PortfolioQueryScopeApplied =
      deptIds === null
        ? { mode: "organization", organizationId: visibility.organizationId }
        : {
            mode: "departments",
            organizationId: visibility.organizationId,
            departmentIds: deptIds,
          };

    return { visibility, deptIds, scope };
  }
}
