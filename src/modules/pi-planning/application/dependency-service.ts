import {
  DependencySubjectType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  createDependencyInputSchema,
  updateDependencyInputSchema,
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

/**
 * Canonical PlanningDependency CRUD.
 * WorkItem→WorkItem and Project→Project; reject self/duplicate.
 */
export class DependencyService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async listDependencies(principal: Principal, organizationId: string) {
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId,
    });
    return this.db.planningDependency.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createDependency(principal: Principal, raw: unknown) {
    const input = parse(createDependencyInputSchema, raw);
    await this.authz.assertCan(principal, PERMISSIONS.PI_MANAGE_DEPENDENCY, {
      type: "ORGANIZATION",
      organizationId: input.organizationId,
    });

    if (input.sourceType !== input.targetType) {
      throw new AppError(
        "VALIDATION",
        "MVP dependencies must be WorkItem→WorkItem or Project→Project.",
      );
    }

    await this.assertSubjectsExist(
      input.organizationId,
      input.sourceType,
      input.sourceId,
      input.targetType,
      input.targetId,
    );

    try {
      const created = await this.db.planningDependency.create({
        data: {
          organizationId: input.organizationId,
          type: input.type,
          criticality: input.criticality,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          targetType: input.targetType,
          targetId: input.targetId,
          ownerName: input.ownerName ?? null,
          neededByDate: input.neededByDate ?? null,
          description: input.description ?? null,
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.dependency.created",
        subjectType: "PlanningDependency",
        subjectId: created.id,
        organizationId: input.organizationId,
        payload: {
          type: created.type,
          sourceType: created.sourceType,
          sourceId: created.sourceId,
          targetType: created.targetType,
          targetId: created.targetId,
        },
        result: "success",
      });
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "CONFLICT",
          "An identical dependency already exists.",
          { details: error.meta },
        );
      }
      throw error;
    }
  }

  async updateDependency(principal: Principal, raw: unknown) {
    const input = parse(updateDependencyInputSchema, raw);
    const dep = await this.db.planningDependency.findUnique({
      where: { id: input.dependencyId },
    });
    if (!dep) throw new AppError("NOT_FOUND", "Dependency not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PI_MANAGE_DEPENDENCY, {
      type: "ORGANIZATION",
      organizationId: dep.organizationId,
    });
    if (dep.version !== input.expectedVersion) {
      throw new AppError(
        "STALE_VERSION",
        "This dependency was changed by someone else. Refresh and try again.",
        { details: { currentVersion: dep.version } },
      );
    }

    try {
      const updated = await this.db.planningDependency.update({
        where: { id: dep.id, version: input.expectedVersion },
        data: {
          status: input.status,
          criticality: input.criticality,
          ownerName: input.ownerName ?? null,
          neededByDate: input.neededByDate ?? null,
          description: input.description ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.dependency.updated",
        subjectType: "PlanningDependency",
        subjectId: updated.id,
        organizationId: dep.organizationId,
        payload: { status: updated.status, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new AppError(
          "STALE_VERSION",
          "This dependency was changed by someone else. Refresh and try again.",
        );
      }
      throw error;
    }
  }

  /**
   * Resolve iteration sequences for work-item ends of a dependency within a PI,
   * used by conflict-engine DEPENDENCY_TIMING checks.
   */
  async resolveWorkItemIterationSequences(
    piId: string,
    workItemIds: string[],
  ): Promise<Map<string, number>> {
    if (workItemIds.length === 0) return new Map();
    const revision = await this.db.planningRevision.findFirst({
      where: { piId, key: "CURRENT", isCurrent: true },
    });
    if (!revision) return new Map();
    const allocations = await this.db.workAllocation.findMany({
      where: {
        revisionId: revision.id,
        workItemId: { in: workItemIds },
      },
      include: { iteration: true },
    });
    const map = new Map<string, number>();
    for (const a of allocations) {
      map.set(a.workItemId, a.iteration.sequence);
    }
    return map;
  }

  private async assertSubjectsExist(
    organizationId: string,
    sourceType: DependencySubjectType,
    sourceId: string,
    targetType: DependencySubjectType,
    targetId: string,
  ) {
    if (sourceType === "WORK_ITEM") {
      const source = await this.db.projectWorkItem.findUnique({
        where: { id: sourceId },
        include: { project: true },
      });
      if (!source || source.project.organizationId !== organizationId) {
        throw new AppError("VALIDATION", "Source work item not found.");
      }
      const target = await this.db.projectWorkItem.findUnique({
        where: { id: targetId },
        include: { project: true },
      });
      if (!target || target.project.organizationId !== organizationId) {
        throw new AppError("VALIDATION", "Target work item not found.");
      }
    } else {
      const source = await this.db.project.findUnique({
        where: { id: sourceId },
      });
      if (!source || source.organizationId !== organizationId) {
        throw new AppError("VALIDATION", "Source project not found.");
      }
      const target = await this.db.project.findUnique({
        where: { id: targetId },
      });
      if (!target || target.organizationId !== organizationId) {
        throw new AppError("VALIDATION", "Target project not found.");
      }
    }
    void targetType;
  }
}
