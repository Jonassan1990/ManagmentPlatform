import { Prisma, PrismaClient, type ProjectStatus } from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { resolveOptionalBusinessOwner } from "@/modules/organization/application/ownership-policy";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  canProceedWithClosure,
  evaluateClosureReadiness,
  isProjectClosedStatus,
  projectStatusForOutcome,
} from "./closure-policy";
import {
  closeProjectInputSchema,
  createMilestoneInputSchema,
  createWorkItemInputSchema,
  evaluateClosureReadinessInputSchema,
  updateBudgetInputSchema,
  updateMilestoneInputSchema,
  updateProjectInputSchema,
  updateWorkItemInputSchema,
} from "./schemas";

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

function toDecimal(value: string | null | undefined): Prisma.Decimal | null {
  if (value == null || value === "") return null;
  return new Prisma.Decimal(value);
}

const projectInclude = {
  initiative: true,
  department: { include: { section: true } },
  participatingDepartments: { include: { department: true } },
  milestones: { orderBy: { plannedDate: "asc" as const } },
  workItems: { orderBy: { referenceKey: "asc" as const } },
  closure: { include: { closedBy: true } },
} satisfies Prisma.ProjectInclude;

export class ProjectService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async getProjectWorkspace(principal: Principal, projectId: string) {
    const project = await this.db.project.findUnique({
      where: { id: projectId },
      include: projectInclude,
    });
    if (!project || project.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Project not found.");
    }
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PROJECT_VIEW,
      {
        type: "DEPARTMENT",
        organizationId: project.organizationId,
        departmentId: project.departmentId,
      },
      { kind: "PROJECT_OWNER", projectId: project.id },
    );
    return project;
  }

  async getProjectByInitiative(principal: Principal, initiativeId: string) {
    const project = await this.db.project.findUnique({
      where: { initiativeId },
      include: projectInclude,
    });
    if (!project) return null;
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PROJECT_VIEW,
      {
        type: "DEPARTMENT",
        organizationId: project.organizationId,
        departmentId: project.departmentId,
      },
      { kind: "PROJECT_OWNER", projectId: project.id },
    );
    return project;
  }

  async updateProject(principal: Principal, raw: unknown) {
    const input = parse(updateProjectInputSchema, raw);
    const project = await this.requireProject(input.projectId);
    this.assertProjectMutable(project.status);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PROJECT_EDIT,
      {
        type: "DEPARTMENT",
        organizationId: project.organizationId,
        departmentId: project.departmentId,
      },
      { kind: "PROJECT_OWNER", projectId: project.id },
    );
    this.assertVersion(project.version, input.expectedVersion, "project");

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: project.organizationId,
      roleLabel: "project owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    try {
      const updated = await this.db.$transaction(async (tx) => {
        const next = await tx.project.update({
          where: { id: project.id, version: input.expectedVersion },
          data: {
            name: input.name,
            description: input.description ?? null,
            ownerName,
            ownerResourceId: owner?.id ?? null,
            status: input.status,
            priority: input.priority,
            plannedStart: input.plannedStart ?? null,
            plannedEnd: input.plannedEnd ?? null,
            objectives: input.objectives ?? null,
            version: { increment: 1 },
          },
        });

        if (input.participatingDepartmentIds) {
          await tx.projectParticipatingDepartment.deleteMany({
            where: { projectId: project.id },
          });
          if (input.participatingDepartmentIds.length > 0) {
            await tx.projectParticipatingDepartment.createMany({
              data: input.participatingDepartmentIds.map((departmentId) => ({
                projectId: project.id,
                departmentId,
              })),
            });
          }
        }

        return next;
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "project.updated",
        subjectType: "Project",
        subjectId: updated.id,
        organizationId: project.organizationId,
        payload: {
          version: updated.version,
          oldOwnerResourceId: project.ownerResourceId,
          newOwnerResourceId: updated.ownerResourceId,
          oldOwnerName: project.ownerName,
          newOwnerName: updated.ownerName,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "project");
    }
  }

  async updateBudget(principal: Principal, raw: unknown) {
    const input = parse(updateBudgetInputSchema, raw);
    const project = await this.requireProject(input.projectId);
    this.assertProjectMutable(project.status);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PROJECT_EDIT,
      {
        type: "DEPARTMENT",
        organizationId: project.organizationId,
        departmentId: project.departmentId,
      },
      { kind: "PROJECT_OWNER", projectId: project.id },
    );
    this.assertVersion(project.version, input.expectedVersion, "project");

    try {
      const updated = await this.db.project.update({
        where: { id: project.id, version: input.expectedVersion },
        data: {
          estimatedCost: toDecimal(input.estimatedCost),
          approvedBudget: toDecimal(input.approvedBudget),
          plannedCost: toDecimal(input.plannedCost),
          forecastCost: toDecimal(input.forecastCost),
          actualCost: toDecimal(input.actualCost),
          ...(input.currencyCode
            ? { currencyCode: input.currencyCode.toUpperCase() }
            : {}),
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "project.budget.updated",
        subjectType: "Project",
        subjectId: updated.id,
        organizationId: project.organizationId,
        payload: { version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "project");
    }
  }

  async createMilestone(principal: Principal, raw: unknown) {
    const input = parse(createMilestoneInputSchema, raw);
    const project = await this.requireProject(input.projectId);
    this.assertProjectMutable(project.status);
    await this.authz.assertCan(principal, PERMISSIONS.PROJECT_MANAGE_MILESTONES, {
      type: "DEPARTMENT",
      organizationId: project.organizationId,
      departmentId: project.departmentId,
    });

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: project.organizationId,
      roleLabel: "milestone owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    const referenceKey = await this.allocateMilestoneReference(project.id);
    const created = await this.db.projectMilestone.create({
      data: {
        projectId: project.id,
        referenceKey,
        title: input.title,
        description: input.description ?? null,
        ownerName,
        ownerResourceId: owner?.id ?? null,
        plannedDate: input.plannedDate ?? null,
        actualDate: input.actualDate ?? null,
        status: input.status,
        criticality: input.criticality,
      },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "project.milestone.created",
      subjectType: "ProjectMilestone",
      subjectId: created.id,
      organizationId: project.organizationId,
      payload: { referenceKey: created.referenceKey },
      result: "success",
    });
    return created;
  }

  async updateMilestone(principal: Principal, raw: unknown) {
    const input = parse(updateMilestoneInputSchema, raw);
    const milestone = await this.db.projectMilestone.findUnique({
      where: { id: input.milestoneId },
      include: { project: true },
    });
    if (!milestone) throw new AppError("NOT_FOUND", "Milestone not found.");
    this.assertProjectMutable(milestone.project.status);
    await this.authz.assertCan(principal, PERMISSIONS.PROJECT_MANAGE_MILESTONES, {
      type: "DEPARTMENT",
      organizationId: milestone.project.organizationId,
      departmentId: milestone.project.departmentId,
    });
    this.assertVersion(milestone.version, input.expectedVersion, "milestone");

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: milestone.project.organizationId,
      roleLabel: "milestone owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    try {
      const updated = await this.db.projectMilestone.update({
        where: { id: milestone.id, version: input.expectedVersion },
        data: {
          title: input.title,
          description: input.description ?? null,
          ownerName,
          ownerResourceId: owner?.id ?? null,
          plannedDate: input.plannedDate ?? null,
          actualDate: input.actualDate ?? null,
          status: input.status,
          criticality: input.criticality,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "project.milestone.updated",
        subjectType: "ProjectMilestone",
        subjectId: updated.id,
        organizationId: milestone.project.organizationId,
        payload: { version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "milestone");
    }
  }

  async createWorkItem(principal: Principal, raw: unknown) {
    const input = parse(createWorkItemInputSchema, raw);
    const project = await this.requireProject(input.projectId);
    this.assertProjectMutable(project.status);
    await this.authz.assertCan(principal, PERMISSIONS.PROJECT_MANAGE_WORKITEMS, {
      type: "DEPARTMENT",
      organizationId: project.organizationId,
      departmentId: project.departmentId,
    });

    if (input.parentId) {
      const parent = await this.db.projectWorkItem.findUnique({
        where: { id: input.parentId },
      });
      if (!parent || parent.projectId !== project.id) {
        throw new AppError("VALIDATION", "Parent work item must belong to the same project.");
      }
    }

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: project.organizationId,
      roleLabel: "work item owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    const referenceKey = await this.allocateWorkItemReference(project.id);
    const created = await this.db.projectWorkItem.create({
      data: {
        projectId: project.id,
        type: input.type,
        referenceKey,
        title: input.title,
        description: input.description ?? null,
        ownerName,
        ownerResourceId: owner?.id ?? null,
        status: input.status,
        priority: input.priority,
        estimateHours: toDecimal(input.estimateHours),
        parentId: input.parentId ?? null,
      },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "project.workitem.created",
      subjectType: "ProjectWorkItem",
      subjectId: created.id,
      organizationId: project.organizationId,
      payload: { referenceKey: created.referenceKey, type: created.type },
      result: "success",
    });
    return created;
  }

  async updateWorkItem(principal: Principal, raw: unknown) {
    const input = parse(updateWorkItemInputSchema, raw);
    const workItem = await this.db.projectWorkItem.findUnique({
      where: { id: input.workItemId },
      include: { project: true },
    });
    if (!workItem) throw new AppError("NOT_FOUND", "Work item not found.");
    this.assertProjectMutable(workItem.project.status);
    await this.authz.assertCan(principal, PERMISSIONS.PROJECT_MANAGE_WORKITEMS, {
      type: "DEPARTMENT",
      organizationId: workItem.project.organizationId,
      departmentId: workItem.project.departmentId,
    });
    this.assertVersion(workItem.version, input.expectedVersion, "work item");

    if (input.parentId) {
      if (input.parentId === workItem.id) {
        throw new AppError("VALIDATION", "A work item cannot be its own parent.");
      }
      const parent = await this.db.projectWorkItem.findUnique({
        where: { id: input.parentId },
      });
      if (!parent || parent.projectId !== workItem.projectId) {
        throw new AppError("VALIDATION", "Parent work item must belong to the same project.");
      }
    }

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: workItem.project.organizationId,
      roleLabel: "work item owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    try {
      const updated = await this.db.projectWorkItem.update({
        where: { id: workItem.id, version: input.expectedVersion },
        data: {
          title: input.title,
          description: input.description ?? null,
          ownerName,
          ownerResourceId: owner?.id ?? null,
          status: input.status,
          priority: input.priority,
          estimateHours: toDecimal(input.estimateHours),
          parentId: input.parentId ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "project.workitem.updated",
        subjectType: "ProjectWorkItem",
        subjectId: updated.id,
        organizationId: workItem.project.organizationId,
        payload: { version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "work item");
    }
  }

  /**
   * Evaluate closure readiness for a Project + outcome (Phase 1D).
   * Does not mutate state. Authorization: PROJECT_VIEW (readiness is visible to viewers).
   */
  async getClosureReadiness(principal: Principal, raw: unknown) {
    const input = parse(evaluateClosureReadinessInputSchema, raw);
    const project = await this.db.project.findUnique({
      where: { id: input.projectId },
      include: {
        milestones: true,
        workItems: true,
        issues: true,
        closure: true,
      },
    });
    if (!project || project.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Project not found.");
    }
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PROJECT_VIEW,
      {
        type: "DEPARTMENT",
        organizationId: project.organizationId,
        departmentId: project.departmentId,
      },
      { kind: "PROJECT_OWNER", projectId: project.id },
    );

    const readiness = evaluateClosureReadiness({
      projectStatus: project.status,
      outcome: input.outcome,
      milestones: project.milestones,
      workItems: project.workItems,
      issues: project.issues,
    });

    return {
      projectId: project.id,
      outcome: input.outcome,
      projectStatus: project.status,
      alreadyClosed: Boolean(project.closure) || isProjectClosedStatus(project.status),
      closure: project.closure,
      readiness,
    };
  }

  /**
   * Explicit authorized Project closure (Phase 1D).
   * Creates immutable ProjectClosure, transitions status, audits.
   * Does not rewrite Issues / Milestones / Work Items / PI history.
   * Idempotency: CONFLICT if already closed (no second closure record).
   * Authorization: PROJECT_CLOSE only — Project Owner ownership does not grant close.
   */
  async closeProject(principal: Principal, raw: unknown) {
    const input = parse(closeProjectInputSchema, raw);
    const project = await this.db.project.findUnique({
      where: { id: input.projectId },
      include: {
        milestones: true,
        workItems: true,
        issues: true,
        closure: true,
      },
    });
    if (!project || project.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Project not found.");
    }

    await this.authz.assertCan(principal, PERMISSIONS.PROJECT_CLOSE, {
      type: "DEPARTMENT",
      organizationId: project.organizationId,
      departmentId: project.departmentId,
    });
    // Intentionally no PROJECT_OWNER ownership grant for close (ADR-025).

    if (project.closure || isProjectClosedStatus(project.status)) {
      throw new AppError(
        "CONFLICT",
        "Project is already closed. Closure is final for Phase 1D.",
        {
          details: {
            projectId: project.id,
            status: project.status,
            closureId: project.closure?.id ?? null,
          },
        },
      );
    }

    this.assertVersion(project.version, input.expectedVersion, "project");

    const readiness = evaluateClosureReadiness({
      projectStatus: project.status,
      outcome: input.outcome,
      milestones: project.milestones,
      workItems: project.workItems,
      issues: project.issues,
    });
    const proceed = canProceedWithClosure(
      readiness,
      input.acknowledgeWarnings,
    );
    if (!proceed.ok) {
      throw new AppError("VALIDATION", proceed.reason, {
        details: { readiness },
      });
    }

    const nextStatus = projectStatusForOutcome(input.outcome);
    const closedAt = new Date();
    const readinessSnapshot = {
      outcome: input.outcome,
      hardBlockers: readiness.hardBlockers,
      warnings: readiness.warnings,
      counts: readiness.counts,
      acknowledgedWarnings: input.acknowledgeWarnings,
    };

    try {
      const result = await this.db.$transaction(async (tx) => {
        const updated = await tx.project.update({
          where: { id: project.id, version: input.expectedVersion },
          data: {
            status: nextStatus,
            version: { increment: 1 },
          },
        });

        const closure = await tx.projectClosure.create({
          data: {
            projectId: project.id,
            closedAt,
            closedByPrincipalId: principal.id,
            outcome: input.outcome,
            summary: input.summary ?? null,
            lessonsLearned: input.lessonsLearned ?? null,
            finalDeliveryNote: input.finalDeliveryNote ?? null,
            readinessSnapshot,
          },
          include: { closedBy: true },
        });

        return { project: updated, closure };
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "project.closed",
        subjectType: "Project",
        subjectId: result.project.id,
        organizationId: project.organizationId,
        payload: {
          closureId: result.closure.id,
          outcome: input.outcome,
          closedAt: closedAt.toISOString(),
          status: nextStatus,
          version: result.project.version,
          summary: input.summary ?? null,
          readinessSnapshot,
          initiativeId: project.initiativeId,
        },
        result: "success",
      });

      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "CONFLICT",
          "Project is already closed. Closure is final for Phase 1D.",
        );
      }
      this.rethrowStale(error, "project");
    }
  }

  /**
   * Traceability view: initiative → PoC → Pilot → Project with decisions.
   */
  async getTraceability(principal: Principal, initiativeId: string) {
    const initiative = await this.db.initiative.findUnique({
      where: { id: initiativeId },
      include: {
        demand: true,
        preStudy: true,
        poc: { include: { criteria: true } },
        pilot: {
          include: {
            criteria: true,
            extensions: { orderBy: { createdAt: "asc" } },
          },
        },
        project: {
          include: {
            milestones: true,
            workItems: true,
          },
        },
        decisions: {
          include: { conditions: true, gate: true },
          orderBy: { decidedAt: "asc" },
        },
        lifecycleTransitions: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!initiative || initiative.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Initiative not found.");
    }
    await this.authz.assertCan(
      principal,
      PERMISSIONS.INITIATIVE_VIEW,
      {
        type: "DEPARTMENT",
        organizationId: initiative.organizationId,
        departmentId: initiative.departmentId,
      },
      { kind: "INITIATIVE_BUSINESS_OWNER", initiativeId: initiative.id },
    );
    return initiative;
  }

  private async requireProject(projectId: string) {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project || project.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Project not found.");
    }
    return project;
  }

  /** Closed projects are historical/read-only for delivery mutations (Phase 1D). */
  private assertProjectMutable(status: ProjectStatus): void {
    if (isProjectClosedStatus(status)) {
      throw new AppError(
        "CONFLICT",
        "Closed projects are read-only for delivery mutations.",
        { details: { status } },
      );
    }
  }

  private async allocateMilestoneReference(projectId: string): Promise<string> {
    const existing = await this.db.projectMilestone.findMany({
      where: { projectId },
      select: { referenceKey: true },
    });
    let max = 0;
    for (const row of existing) {
      const match = /^MS-(\d+)$/.exec(row.referenceKey);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `MS-${String(max + 1).padStart(3, "0")}`;
  }

  private async allocateWorkItemReference(projectId: string): Promise<string> {
    const existing = await this.db.projectWorkItem.findMany({
      where: { projectId },
      select: { referenceKey: true },
    });
    let max = 0;
    for (const row of existing) {
      const match = /^WI-(\d+)$/.exec(row.referenceKey);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `WI-${String(max + 1).padStart(3, "0")}`;
  }

  private assertVersion(
    current: number,
    expected: number,
    entity: string,
  ): void {
    if (current !== expected) {
      throw new AppError(
        "STALE_VERSION",
        `This ${entity} was changed by someone else. Refresh and try again.`,
        { details: { currentVersion: current } },
      );
    }
  }

  private rethrowStale(error: unknown, entity: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new AppError(
        "STALE_VERSION",
        `This ${entity} was changed by someone else. Refresh and try again.`,
      );
    }
    throw error;
  }
}
