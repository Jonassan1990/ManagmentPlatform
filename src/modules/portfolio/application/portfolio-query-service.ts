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
  DeliveryHealthAttentionInput,
  DeliveryHealthAttentionResult,
  DeliveryHealthAttentionRow,
  DeliveryHealthAttentionSortBy,
  DeliveryHealthClassification,
  DeliveryHealthEvaluation,
  DeliveryHealthProjectInput,
  DeliveryHealthSummary,
  DeliveryHealthSummaryInput,
  DependencyExposureCounts,
  ExperimentationCounts,
  GovernancePendingCounts,
  InitiativeLifecycleDistribution,
  IssuePortfolioCounts,
  OwnershipReference,
  PiCapacityPortfolioSummary,
  PiCapacityTeamSummary,
  PortfolioExplorerEntityKind,
  PortfolioExplorerInput,
  PortfolioExplorerOwner,
  PortfolioExplorerResult,
  PortfolioExplorerRow,
  PortfolioExplorerSortBy,
  PortfolioQueryInput,
  PortfolioQueryScopeApplied,
  PortfolioSnapshot,
  ProjectStatusCounts,
} from "../domain/types";
import {
  ATTENTION_CLASSIFICATIONS,
  classificationSortRank,
  emptyHealthCounts,
  evaluateDeliveryHealth,
  type HealthProjectInput,
} from "./delivery-health";
import { resolvePortfolioVisibility } from "./portfolio-scope";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_EXPLORER_CANDIDATES = 5000;

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

function ownerFrom(
  resource: { id: string; name: string } | null | undefined,
  legacyName: string | null | undefined,
): PortfolioExplorerOwner {
  if (resource) {
    return {
      resourceId: resource.id,
      displayName: resource.name,
      source: "resource",
    };
  }
  return {
    resourceId: null,
    displayName: legacyName?.trim() || "Unassigned",
    source: "legacy",
  };
}

export class PortfolioQueryService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Department labels for portfolio scope controls.
   * Returns only departments already visible under Phase 0C (never expands access).
   */
  async listDepartmentOptions(
    principal: Principal,
    organizationId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const visibility = await resolvePortfolioVisibility(
      this.db,
      principal,
      organizationId,
    );
    const where: Prisma.DepartmentWhereInput = {
      status: "ACTIVE",
      section: { organizationId: visibility.organizationId },
      ...(visibility.departmentIds
        ? { id: { in: visibility.departmentIds } }
        : {}),
    };
    return this.db.department.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Section labels that contain at least one visible department.
   */
  async listSectionOptions(
    principal: Principal,
    organizationId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const visibility = await resolvePortfolioVisibility(
      this.db,
      principal,
      organizationId,
    );
    const depts = await this.db.department.findMany({
      where: {
        status: "ACTIVE",
        section: { organizationId: visibility.organizationId },
        ...(visibility.departmentIds
          ? { id: { in: visibility.departmentIds } }
          : {}),
      },
      select: {
        section: { select: { id: true, name: true } },
      },
    });
    const map = new Map<string, string>();
    for (const d of depts) map.set(d.section.id, d.section.name);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Resource owners appearing on in-scope initiatives/projects (structured only).
   */
  async listOwnerOptions(
    principal: Principal,
    organizationId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const visibility = await resolvePortfolioVisibility(
      this.db,
      principal,
      organizationId,
    );
    const deptFilter = visibility.departmentIds;
    const initiativeWhere: Prisma.InitiativeWhereInput = {
      organizationId: visibility.organizationId,
      status: { not: "ARCHIVED" },
      ...(deptFilter ? { departmentId: { in: deptFilter } } : {}),
      businessOwnerResourceId: { not: null },
    };
    const projectWhere: Prisma.ProjectWhereInput = {
      organizationId: visibility.organizationId,
      status: { not: "ARCHIVED" },
      ...(deptFilter ? { departmentId: { in: deptFilter } } : {}),
      ownerResourceId: { not: null },
    };
    const [initOwners, projectOwners] = await Promise.all([
      this.db.initiative.findMany({
        where: initiativeWhere,
        select: {
          businessOwnerResource: { select: { id: true, name: true } },
        },
        distinct: ["businessOwnerResourceId"],
      }),
      this.db.project.findMany({
        where: projectWhere,
        select: {
          ownerResource: { select: { id: true, name: true } },
        },
        distinct: ["ownerResourceId"],
      }),
    ]);
    const map = new Map<string, string>();
    for (const row of initOwners) {
      if (row.businessOwnerResource) {
        map.set(row.businessOwnerResource.id, row.businessOwnerResource.name);
      }
    }
    for (const row of projectOwners) {
      if (row.ownerResource) {
        map.set(row.ownerResource.id, row.ownerResource.name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * M2C — paginated, filtered, sorted portfolio explorer.
   * Authorization via resolvePortfolioVisibility before any reads.
   */
  async explorePortfolio(
    principal: Principal,
    input: PortfolioExplorerInput,
  ): Promise<PortfolioExplorerResult> {
    if (!input.organizationId?.trim()) {
      throw new AppError("VALIDATION", "organizationId is required.");
    }

    const asOf = input.asOf ?? new Date();
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    );
    const sortBy: PortfolioExplorerSortBy = input.sortBy ?? "updatedAt";
    const sortDir = input.sortDir === "asc" ? "asc" : "desc";
    const kinds: PortfolioExplorerEntityKind[] =
      input.entityKinds && input.entityKinds.length > 0
        ? input.entityKinds
        : ["INITIATIVE", "PROJECT"];

    const visibility = await resolvePortfolioVisibility(
      this.db,
      principal,
      input.organizationId,
      input.departmentId,
    );

    let deptIds = visibility.departmentIds;
    if (input.sectionId) {
      const section = await this.db.section.findUnique({
        where: { id: input.sectionId },
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
          "No department in this section is visible for portfolio exploration.",
        );
      }
      deptIds = allowed;
    }

    const q = input.q?.trim();
    const includeInitiatives =
      kinds.includes("INITIATIVE") &&
      !input.delivery &&
      !input.deliveryHealth &&
      !input.projectStatus;
    const includeProjects = kinds.includes("PROJECT") && !input.initiativeStage;

    type Candidate = {
      kind: PortfolioExplorerEntityKind;
      id: string;
      initiativeId: string;
      referenceKey: string;
      title: string;
      statusLabel: string;
      statusSort: string;
      departmentId: string;
      departmentName: string;
      sectionId: string;
      sectionName: string;
      owner: PortfolioExplorerOwner;
      updatedAt: Date;
      targetDate: Date | null;
      delayed: boolean | null;
      activeBlocker: boolean | null;
      criticalOpenIssue: boolean | null;
      deliveryHealth: DeliveryHealthClassification | null;
    };

    const candidates: Candidate[] = [];

    if (includeInitiatives) {
      const initiativeWhere: Prisma.InitiativeWhereInput = {
        organizationId: visibility.organizationId,
        status: { not: "ARCHIVED" },
        ...(deptIds ? { departmentId: { in: deptIds } } : {}),
        ...(input.initiativeStage
          ? { currentStage: input.initiativeStage }
          : {}),
        ...(input.ownerResourceId
          ? { businessOwnerResourceId: input.ownerResourceId }
          : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { referenceKey: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const initiatives = await this.db.initiative.findMany({
        where: initiativeWhere,
        take: MAX_EXPLORER_CANDIDATES,
        select: {
          id: true,
          referenceKey: true,
          title: true,
          currentStage: true,
          updatedAt: true,
          departmentId: true,
          businessOwnerName: true,
          businessOwnerResourceId: true,
          businessOwnerResource: { select: { id: true, name: true } },
          department: {
            select: {
              id: true,
              name: true,
              section: { select: { id: true, name: true } },
            },
          },
        },
      });
      for (const row of initiatives) {
        candidates.push({
          kind: "INITIATIVE",
          id: row.id,
          initiativeId: row.id,
          referenceKey: row.referenceKey,
          title: row.title,
          statusLabel: row.currentStage,
          statusSort: row.currentStage,
          departmentId: row.department.id,
          departmentName: row.department.name,
          sectionId: row.department.section.id,
          sectionName: row.department.section.name,
          owner: ownerFrom(
            row.businessOwnerResource,
            row.businessOwnerName,
          ),
          updatedAt: row.updatedAt,
          targetDate: null,
          delayed: null,
          activeBlocker: null,
          criticalOpenIssue: null,
          deliveryHealth: null,
        });
      }
    }

    if (includeProjects) {
      const projectWhere: Prisma.ProjectWhereInput = {
        organizationId: visibility.organizationId,
        status: { not: "ARCHIVED" },
        ...(deptIds ? { departmentId: { in: deptIds } } : {}),
        ...(input.projectStatus ? { status: input.projectStatus } : {}),
        ...(input.ownerResourceId
          ? { ownerResourceId: input.ownerResourceId }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { referenceKey: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const projects = await this.db.project.findMany({
        where: projectWhere,
        take: MAX_EXPLORER_CANDIDATES,
        select: {
          id: true,
          initiativeId: true,
          referenceKey: true,
          name: true,
          status: true,
          updatedAt: true,
          plannedEnd: true,
          plannedStart: true,
          departmentId: true,
          ownerName: true,
          ownerResourceId: true,
          ownerResource: { select: { id: true, name: true } },
          department: {
            select: {
              id: true,
              name: true,
              section: { select: { id: true, name: true } },
            },
          },
          closure: { select: { outcome: true } },
          milestones: {
            select: {
              id: true,
              status: true,
              criticality: true,
              plannedDate: true,
            },
          },
          issues: {
            select: {
              id: true,
              status: true,
              severity: true,
              isBlocker: true,
            },
          },
          workItems: { select: { id: true } },
        },
      });

      const depsByProject = await this.loadCriticalOpenDependenciesByProject(
        visibility.organizationId,
        projects.map((p) => ({
          id: p.id,
          workItemIds: p.workItems.map((w) => w.id),
        })),
      );

      for (const row of projects) {
        const delayed =
          (row.status === "ACTIVE" || row.status === "ON_HOLD") &&
          (row.milestones.some((m) => m.status === "MISSED") ||
            (row.plannedEnd != null && row.plannedEnd < asOf));
        const openIssues = row.issues.filter(
          (i) =>
            !isTerminalIssueStatus(
              i.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
            ),
        );
        const activeBlocker = row.issues.some((i) =>
          isActiveBlockerIssue({
            isBlocker: i.isBlocker,
            status: i.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
          }),
        );
        const criticalOpenIssue = openIssues.some(
          (i) => i.severity === "CRITICAL",
        );

        if (input.delivery === "DELAYED" && !delayed) continue;
        if (input.delivery === "ACTIVE_BLOCKER" && !activeBlocker) continue;
        if (input.delivery === "CRITICAL_ISSUE" && !criticalOpenIssue) continue;

        const healthEval = evaluateDeliveryHealth(
          {
            id: row.id,
            initiativeId: row.initiativeId,
            status: row.status,
            plannedEnd: row.plannedEnd,
            plannedStart: row.plannedStart,
            closureOutcome: row.closure?.outcome ?? null,
            issues: row.issues,
            milestones: row.milestones,
            criticalOpenDependencies: depsByProject.get(row.id) ?? [],
          },
          asOf,
        );

        if (
          input.deliveryHealth &&
          healthEval.classification !== input.deliveryHealth
        ) {
          continue;
        }

        candidates.push({
          kind: "PROJECT",
          id: row.id,
          initiativeId: row.initiativeId,
          referenceKey: row.referenceKey,
          title: row.name,
          statusLabel: row.status,
          statusSort: row.status,
          departmentId: row.department.id,
          departmentName: row.department.name,
          sectionId: row.department.section.id,
          sectionName: row.department.section.name,
          owner: ownerFrom(row.ownerResource, row.ownerName),
          updatedAt: row.updatedAt,
          targetDate: row.plannedEnd,
          delayed,
          activeBlocker,
          criticalOpenIssue,
          deliveryHealth: healthEval.classification,
        });
      }
    }

    const dir = sortDir === "asc" ? 1 : -1;
    candidates.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = a.statusSort.localeCompare(b.statusSort);
          break;
        case "targetDate": {
          const at = a.targetDate?.getTime() ?? null;
          const bt = b.targetDate?.getTime() ?? null;
          if (at == null && bt == null) cmp = 0;
          else if (at == null) cmp = 1;
          else if (bt == null) cmp = -1;
          else cmp = at - bt;
          break;
        }
        case "updatedAt":
        default:
          cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }
      if (cmp !== 0) return cmp * dir;
      // Stable tie-breaker: kind then referenceKey then id
      cmp = a.kind.localeCompare(b.kind);
      if (cmp !== 0) return cmp;
      cmp = a.referenceKey.localeCompare(b.referenceKey);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

    const total = candidates.length;
    const start = (page - 1) * pageSize;
    const pageRows = candidates.slice(start, start + pageSize);

    const rows: PortfolioExplorerRow[] = pageRows.map((c) => ({
      kind: c.kind,
      id: c.id,
      initiativeId: c.initiativeId,
      referenceKey: c.referenceKey,
      title: c.title,
      href:
        c.kind === "INITIATIVE"
          ? `/initiatives/${c.initiativeId}`
          : `/initiatives/${c.initiativeId}/project`,
      statusLabel: c.statusLabel,
      departmentId: c.departmentId,
      departmentName: c.departmentName,
      sectionId: c.sectionId,
      sectionName: c.sectionName,
      owner: c.owner,
      updatedAt: c.updatedAt.toISOString(),
      targetDate: c.targetDate ? c.targetDate.toISOString() : null,
      delivery: {
        delayed: c.delayed,
        activeBlocker: c.activeBlocker,
        criticalOpenIssue: c.criticalOpenIssue,
        health: c.deliveryHealth,
      },
    }));

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "portfolio.query.explore",
      subjectType: "Organization",
      subjectId: visibility.organizationId,
      organizationId: visibility.organizationId,
      payload: {
        scopeMode: visibility.applied.mode,
        page,
        pageSize,
        total,
        sortBy,
        sortDir,
        q: q ?? null,
        delivery: input.delivery ?? null,
        deliveryHealth: input.deliveryHealth ?? null,
      },
      result: "success",
    });

    return {
      asOf: asOf.toISOString(),
      scope:
        deptIds === null
          ? { mode: "organization", organizationId: visibility.organizationId }
          : {
              mode: "departments",
              organizationId: visibility.organizationId,
              departmentIds: deptIds,
            },
      page,
      pageSize,
      total,
      sortBy,
      sortDir,
      rows,
    };
  }

  /**
   * M2D-A — delivery-health counts by classification + attention count.
   * Derived at query time; no persisted health ledger.
   */
  async getDeliveryHealthSummary(
    principal: Principal,
    input: DeliveryHealthSummaryInput,
  ): Promise<DeliveryHealthSummary> {
    if (!input.organizationId?.trim()) {
      throw new AppError("VALIDATION", "organizationId is required.");
    }
    const asOf = input.asOf ?? new Date();
    const { visibility, deptIds, scope } = await this.resolveHealthScope(
      principal,
      input.organizationId,
      input.departmentId,
      input.sectionId,
    );

    const evaluated = await this.evaluateScopedProjects(
      visibility.organizationId,
      deptIds,
      asOf,
    );

    const counts = emptyHealthCounts();
    for (const row of evaluated) {
      counts[row.evaluation.classification] += 1;
    }
    const attentionCount =
      counts.BLOCKED + counts.AT_RISK;

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "portfolio.query.delivery_health_summary",
      subjectType: "Organization",
      subjectId: visibility.organizationId,
      organizationId: visibility.organizationId,
      payload: {
        scopeMode: scope.mode,
        asOf: asOf.toISOString(),
        attentionCount,
        totalProjects: evaluated.length,
      },
      result: "success",
    });

    return {
      asOf: asOf.toISOString(),
      scope,
      counts,
      attentionCount,
      totalProjects: evaluated.length,
    };
  }

  /**
   * M2D-A — paginated Projects matching attention (or explicit) classifications.
   */
  async listDeliveryHealthAttention(
    principal: Principal,
    input: DeliveryHealthAttentionInput,
  ): Promise<DeliveryHealthAttentionResult> {
    if (!input.organizationId?.trim()) {
      throw new AppError("VALIDATION", "organizationId is required.");
    }
    const asOf = input.asOf ?? new Date();
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
    );
    const sortBy: DeliveryHealthAttentionSortBy =
      input.sortBy ?? "classification";
    const sortDir = input.sortDir === "asc" ? "asc" : "desc";
    const classifications: DeliveryHealthClassification[] =
      input.classifications && input.classifications.length > 0
        ? input.classifications
        : [...ATTENTION_CLASSIFICATIONS];

    const { visibility, deptIds, scope } = await this.resolveHealthScope(
      principal,
      input.organizationId,
      input.departmentId,
      input.sectionId,
    );

    const evaluated = await this.evaluateScopedProjects(
      visibility.organizationId,
      deptIds,
      asOf,
    );

    const attentionCount = evaluated.filter((r) =>
      ATTENTION_CLASSIFICATIONS.includes(r.evaluation.classification),
    ).length;

    const matched = evaluated.filter((r) =>
      classifications.includes(r.evaluation.classification),
    );

    const dir = sortDir === "asc" ? 1 : -1;
    matched.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.project.name.localeCompare(b.project.name);
          break;
        case "plannedEnd": {
          const at = a.project.plannedEnd?.getTime() ?? null;
          const bt = b.project.plannedEnd?.getTime() ?? null;
          if (at == null && bt == null) cmp = 0;
          else if (at == null) cmp = 1;
          else if (bt == null) cmp = -1;
          else cmp = at - bt;
          break;
        }
        case "updatedAt":
          cmp =
            a.project.updatedAt.getTime() - b.project.updatedAt.getTime();
          break;
        case "classification":
        default:
          cmp =
            classificationSortRank(a.evaluation.classification) -
            classificationSortRank(b.evaluation.classification);
          break;
      }
      if (cmp !== 0) return cmp * dir;
      cmp = a.project.referenceKey.localeCompare(b.project.referenceKey);
      if (cmp !== 0) return cmp;
      return a.project.id.localeCompare(b.project.id);
    });

    const total = matched.length;
    const start = (page - 1) * pageSize;
    const pageRows = matched.slice(start, start + pageSize);

    const rows: DeliveryHealthAttentionRow[] = pageRows.map((r) => ({
      projectId: r.project.id,
      initiativeId: r.project.initiativeId,
      referenceKey: r.project.referenceKey,
      name: r.project.name,
      href: r.evaluation.href,
      projectStatus: r.evaluation.projectStatus,
      classification: r.evaluation.classification,
      closureOutcome: r.evaluation.closureOutcome,
      departmentId: r.project.departmentId,
      departmentName: r.project.departmentName,
      sectionId: r.project.sectionId,
      sectionName: r.project.sectionName,
      owner: r.project.owner,
      plannedEnd: r.project.plannedEnd
        ? r.project.plannedEnd.toISOString()
        : null,
      updatedAt: r.project.updatedAt.toISOString(),
      reasons: r.evaluation.reasons,
    }));

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "portfolio.query.delivery_health_attention",
      subjectType: "Organization",
      subjectId: visibility.organizationId,
      organizationId: visibility.organizationId,
      payload: {
        scopeMode: scope.mode,
        page,
        pageSize,
        total,
        classifications,
        asOf: asOf.toISOString(),
      },
      result: "success",
    });

    return {
      asOf: asOf.toISOString(),
      scope,
      page,
      pageSize,
      total,
      sortBy,
      sortDir,
      classifications,
      attentionCount,
      rows,
    };
  }

  /**
   * M2D-A — single Project delivery-health evaluation (scoped).
   */
  async getProjectDeliveryHealth(
    principal: Principal,
    input: DeliveryHealthProjectInput,
  ): Promise<DeliveryHealthEvaluation> {
    if (!input.organizationId?.trim() || !input.projectId?.trim()) {
      throw new AppError(
        "VALIDATION",
        "organizationId and projectId are required.",
      );
    }
    const asOf = input.asOf ?? new Date();
    const visibility = await resolvePortfolioVisibility(
      this.db,
      principal,
      input.organizationId,
    );

    const project = await this.db.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: visibility.organizationId,
        status: { not: "ARCHIVED" },
        ...(visibility.departmentIds
          ? { departmentId: { in: visibility.departmentIds } }
          : {}),
      },
      select: {
        id: true,
        initiativeId: true,
        status: true,
        plannedEnd: true,
        plannedStart: true,
        closure: { select: { outcome: true } },
        issues: {
          select: {
            id: true,
            status: true,
            severity: true,
            isBlocker: true,
          },
        },
        milestones: {
          select: {
            id: true,
            status: true,
            criticality: true,
            plannedDate: true,
          },
        },
        workItems: { select: { id: true } },
      },
    });

    if (!project) {
      throw new AppError("NOT_FOUND", "Project not found in portfolio scope.", {
        details: { projectId: input.projectId },
      });
    }

    const depsByProject = await this.loadCriticalOpenDependenciesByProject(
      visibility.organizationId,
      [
        {
          id: project.id,
          workItemIds: project.workItems.map((w) => w.id),
        },
      ],
    );

    const healthInput: HealthProjectInput = {
      id: project.id,
      initiativeId: project.initiativeId,
      status: project.status,
      plannedEnd: project.plannedEnd,
      plannedStart: project.plannedStart,
      closureOutcome: project.closure?.outcome ?? null,
      issues: project.issues,
      milestones: project.milestones,
      criticalOpenDependencies: depsByProject.get(project.id) ?? [],
    };

    const evaluation = evaluateDeliveryHealth(healthInput, asOf);

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "portfolio.query.delivery_health_project",
      subjectType: "Project",
      subjectId: project.id,
      organizationId: visibility.organizationId,
      payload: {
        classification: evaluation.classification,
        asOf: asOf.toISOString(),
      },
      result: "success",
    });

    return evaluation;
  }

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

  private async resolveHealthScope(
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
          "No department in this section is visible for delivery health.",
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

  private async evaluateScopedProjects(
    organizationId: string,
    deptIds: string[] | null,
    asOf: Date,
  ): Promise<
    Array<{
      project: {
        id: string;
        initiativeId: string;
        referenceKey: string;
        name: string;
        departmentId: string;
        departmentName: string;
        sectionId: string;
        sectionName: string;
        owner: PortfolioExplorerOwner;
        plannedEnd: Date | null;
        updatedAt: Date;
      };
      evaluation: DeliveryHealthEvaluation;
    }>
  > {
    const projects = await this.db.project.findMany({
      where: {
        organizationId,
        status: { not: "ARCHIVED" },
        ...(deptIds ? { departmentId: { in: deptIds } } : {}),
      },
      select: {
        id: true,
        initiativeId: true,
        referenceKey: true,
        name: true,
        status: true,
        plannedEnd: true,
        plannedStart: true,
        updatedAt: true,
        departmentId: true,
        ownerName: true,
        ownerResource: { select: { id: true, name: true } },
        department: {
          select: {
            id: true,
            name: true,
            section: { select: { id: true, name: true } },
          },
        },
        closure: { select: { outcome: true } },
        issues: {
          select: {
            id: true,
            status: true,
            severity: true,
            isBlocker: true,
          },
        },
        milestones: {
          select: {
            id: true,
            status: true,
            criticality: true,
            plannedDate: true,
          },
        },
        workItems: { select: { id: true } },
      },
    });

    const depsByProject = await this.loadCriticalOpenDependenciesByProject(
      organizationId,
      projects.map((p) => ({
        id: p.id,
        workItemIds: p.workItems.map((w) => w.id),
      })),
    );

    return projects.map((p) => {
      const healthInput: HealthProjectInput = {
        id: p.id,
        initiativeId: p.initiativeId,
        status: p.status,
        plannedEnd: p.plannedEnd,
        plannedStart: p.plannedStart,
        closureOutcome: p.closure?.outcome ?? null,
        issues: p.issues,
        milestones: p.milestones,
        criticalOpenDependencies: depsByProject.get(p.id) ?? [],
      };
      return {
        project: {
          id: p.id,
          initiativeId: p.initiativeId,
          referenceKey: p.referenceKey,
          name: p.name,
          departmentId: p.department.id,
          departmentName: p.department.name,
          sectionId: p.department.section.id,
          sectionName: p.department.section.name,
          owner: ownerFrom(p.ownerResource, p.ownerName),
          plannedEnd: p.plannedEnd,
          updatedAt: p.updatedAt,
        },
        evaluation: evaluateDeliveryHealth(healthInput, asOf),
      };
    });
  }

  /**
   * Batch-load critical OPEN PlanningDependencies attributable to projects.
   * Attribution: PROJECT endpoint is the project, or WORK_ITEM belongs to it.
   */
  private async loadCriticalOpenDependenciesByProject(
    organizationId: string,
    projects: Array<{ id: string; workItemIds: string[] }>,
  ): Promise<Map<string, Array<{ id: string; status: string; criticality: string }>>> {
    const result = new Map<
      string,
      Array<{ id: string; status: string; criticality: string }>
    >();
    for (const p of projects) result.set(p.id, []);
    if (projects.length === 0) return result;

    const projectIds = new Set(projects.map((p) => p.id));
    const workItemToProject = new Map<string, string>();
    for (const p of projects) {
      for (const wid of p.workItemIds) workItemToProject.set(wid, p.id);
    }

    const openCritical = await this.db.planningDependency.findMany({
      where: {
        organizationId,
        status: "OPEN",
        criticality: "CRITICAL",
      },
      select: {
        id: true,
        status: true,
        criticality: true,
        sourceType: true,
        sourceId: true,
        targetType: true,
        targetId: true,
      },
    });

    const attribute = (type: string, id: string): string | null => {
      if (type === "PROJECT" && projectIds.has(id)) return id;
      if (type === "WORK_ITEM") return workItemToProject.get(id) ?? null;
      return null;
    };

    for (const dep of openCritical) {
      const attributed = new Set<string>();
      const sourceProject = attribute(dep.sourceType, dep.sourceId);
      const targetProject = attribute(dep.targetType, dep.targetId);
      if (sourceProject) attributed.add(sourceProject);
      if (targetProject) attributed.add(targetProject);
      for (const pid of attributed) {
        result.get(pid)!.push({
          id: dep.id,
          status: dep.status,
          criticality: dep.criticality,
        });
      }
    }

    return result;
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
