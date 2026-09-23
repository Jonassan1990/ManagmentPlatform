import { Prisma, PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { toHoursNumber } from "./capacity-policy";
import type { PiService } from "./pi-service";
import {
  allocateWorkInputSchema,
  moveAllocationInputSchema,
  removeAllocationInputSchema,
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

export class AllocationService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly piService: PiService,
  ) {}

  /**
   * Upsert allocation by revision+workItem. Team must participate; work item
   * must belong to a project owned by or participating from a PI department.
   */
  async allocateWork(principal: Principal, raw: unknown) {
    const input = parse(allocateWorkInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_ALLOCATE, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    if (pi.status === "CLOSED") {
      throw new AppError("VALIDATION", "Cannot allocate on a closed PI.");
    }

    const revision = await this.piService.requireCurrentRevision(pi.id);
    const iteration = await this.db.piIteration.findUnique({
      where: { id: input.iterationId },
    });
    if (!iteration || iteration.piId !== pi.id) {
      throw new AppError("VALIDATION", "Iteration does not belong to this PI.");
    }

    const teamParticipation = await this.db.piParticipatingTeam.findUnique({
      where: {
        piId_teamId: { piId: pi.id, teamId: input.teamId },
      },
    });
    if (!teamParticipation) {
      throw new AppError(
        "VALIDATION",
        "Team must be a participating team on this PI.",
      );
    }

    const workItem = await this.db.projectWorkItem.findUnique({
      where: { id: input.workItemId },
      include: {
        project: {
          include: { participatingDepartments: true },
        },
      },
    });
    if (!workItem || workItem.project.organizationId !== pi.organizationId) {
      throw new AppError("NOT_FOUND", "Work item not found in this organization.");
    }

    const participatingDeptIds = new Set(
      (
        await this.db.piParticipatingDepartment.findMany({
          where: { piId: pi.id },
          select: { departmentId: true },
        })
      ).map((d) => d.departmentId),
    );
    const projectDeptIds = new Set([
      workItem.project.departmentId,
      ...workItem.project.participatingDepartments.map((p) => p.departmentId),
    ]);
    const overlaps = [...projectDeptIds].some((id) => participatingDeptIds.has(id));
    if (!overlaps) {
      throw new AppError(
        "VALIDATION",
        "Work item project is not in a participating department for this PI.",
      );
    }

    const plannedHours =
      toDecimal(input.plannedHours) ??
      workItem.estimateHours ??
      new Prisma.Decimal(0);

    const existing = await this.db.workAllocation.findUnique({
      where: {
        revisionId_workItemId: {
          revisionId: revision.id,
          workItemId: workItem.id,
        },
      },
    });

    if (existing) {
      if (
        input.expectedVersion != null &&
        existing.version !== input.expectedVersion
      ) {
        throw new AppError(
          "STALE_VERSION",
          "This allocation was changed by someone else. Refresh and try again.",
          { details: { currentVersion: existing.version } },
        );
      }
      try {
        const updated = await this.db.workAllocation.update({
          where: {
            id: existing.id,
            ...(input.expectedVersion != null
              ? { version: input.expectedVersion }
              : {}),
          },
          data: {
            iterationId: input.iterationId,
            teamId: input.teamId,
            resourceId: input.resourceId ?? null,
            plannedHours,
            notes: input.notes ?? null,
            version: { increment: 1 },
          },
        });
        await this.audit.record({
          actorPrincipalId: principal.id,
          actionType: "pi.allocation.updated",
          subjectType: "WorkAllocation",
          subjectId: updated.id,
          organizationId: pi.organizationId,
          payload: {
            workItemId: workItem.id,
            iterationId: updated.iterationId,
            teamId: updated.teamId,
            plannedHours: updated.plannedHours.toString(),
          },
          result: "success",
        });
        return updated;
      } catch (error) {
        this.rethrowStale(error, "allocation");
      }
    }

    const created = await this.db.workAllocation.create({
      data: {
        revisionId: revision.id,
        workItemId: workItem.id,
        iterationId: input.iterationId,
        teamId: input.teamId,
        resourceId: input.resourceId ?? null,
        plannedHours,
        notes: input.notes ?? null,
      },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pi.allocation.created",
      subjectType: "WorkAllocation",
      subjectId: created.id,
      organizationId: pi.organizationId,
      payload: {
        workItemId: workItem.id,
        iterationId: created.iterationId,
        teamId: created.teamId,
        plannedHours: created.plannedHours.toString(),
      },
      result: "success",
    });
    return created;
  }

  async moveAllocation(principal: Principal, raw: unknown) {
    const input = parse(moveAllocationInputSchema, raw);
    const allocation = await this.db.workAllocation.findUnique({
      where: { id: input.allocationId },
      include: {
        revision: { include: { pi: true } },
        iteration: true,
      },
    });
    if (!allocation) throw new AppError("NOT_FOUND", "Allocation not found.");
    const pi = allocation.revision.pi;
    await this.authz.assertCan(principal, PERMISSIONS.PI_ALLOCATE, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    this.assertVersion(allocation.version, input.expectedVersion, "allocation");

    const iteration = await this.db.piIteration.findUnique({
      where: { id: input.iterationId },
    });
    if (!iteration || iteration.piId !== pi.id) {
      throw new AppError("VALIDATION", "Iteration does not belong to this PI.");
    }
    const teamParticipation = await this.db.piParticipatingTeam.findUnique({
      where: { piId_teamId: { piId: pi.id, teamId: input.teamId } },
    });
    if (!teamParticipation) {
      throw new AppError(
        "VALIDATION",
        "Team must be a participating team on this PI.",
      );
    }

    try {
      const updated = await this.db.workAllocation.update({
        where: { id: allocation.id, version: input.expectedVersion },
        data: {
          iterationId: input.iterationId,
          teamId: input.teamId,
          resourceId:
            input.resourceId === undefined
              ? allocation.resourceId
              : input.resourceId,
          ...(input.plannedHours != null
            ? { plannedHours: toDecimal(input.plannedHours)! }
            : {}),
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.allocation.moved",
        subjectType: "WorkAllocation",
        subjectId: updated.id,
        organizationId: pi.organizationId,
        payload: {
          iterationId: updated.iterationId,
          teamId: updated.teamId,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "allocation");
    }
  }

  async removeAllocation(principal: Principal, raw: unknown) {
    const input = parse(removeAllocationInputSchema, raw);
    const allocation = await this.db.workAllocation.findUnique({
      where: { id: input.allocationId },
      include: { revision: { include: { pi: true } } },
    });
    if (!allocation) throw new AppError("NOT_FOUND", "Allocation not found.");
    const pi = allocation.revision.pi;
    await this.authz.assertCan(principal, PERMISSIONS.PI_ALLOCATE, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    this.assertVersion(allocation.version, input.expectedVersion, "allocation");

    try {
      await this.db.workAllocation.delete({
        where: { id: allocation.id, version: input.expectedVersion },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.allocation.removed",
        subjectType: "WorkAllocation",
        subjectId: allocation.id,
        organizationId: pi.organizationId,
        payload: { workItemId: allocation.workItemId },
        result: "success",
      });
      return { id: allocation.id };
    } catch (error) {
      this.rethrowStale(error, "allocation");
    }
  }

  /** Unallocated work items from projects overlapping participating departments. */
  async getBacklog(principal: Principal, piId: string) {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    const revision = await this.piService.requireCurrentRevision(piId);
    const deptIds = (
      await this.db.piParticipatingDepartment.findMany({
        where: { piId },
        select: { departmentId: true },
      })
    ).map((d) => d.departmentId);

    if (deptIds.length === 0) return [];

    const allocated = await this.db.workAllocation.findMany({
      where: { revisionId: revision.id },
      select: { workItemId: true },
    });
    const allocatedIds = allocated.map((a) => a.workItemId);

    return this.db.projectWorkItem.findMany({
      where: {
        ...(allocatedIds.length > 0 ? { id: { notIn: allocatedIds } } : {}),
        status: { notIn: ["CANCELLED", "DONE"] },
        project: {
          organizationId: pi.organizationId,
          status: { notIn: ["ARCHIVED", "CANCELLED"] },
          OR: [
            { departmentId: { in: deptIds } },
            {
              participatingDepartments: {
                some: { departmentId: { in: deptIds } },
              },
            },
          ],
        },
      },
      include: {
        project: { select: { id: true, referenceKey: true, name: true } },
      },
      orderBy: [{ projectId: "asc" }, { referenceKey: "asc" }],
    });
  }

  async listAllocationsForRevision(revisionId: string) {
    return this.db.workAllocation.findMany({
      where: { revisionId },
      include: {
        workItem: {
          include: {
            project: {
              select: {
                id: true,
                referenceKey: true,
                name: true,
                plannedStart: true,
                plannedEnd: true,
                departmentId: true,
              },
            },
          },
        },
        iteration: true,
        team: true,
        resource: true,
      },
    });
  }

  sumPlannedHours(
    allocations: { plannedHours: Prisma.Decimal | string | number }[],
  ): number {
    return allocations.reduce(
      (s, a) => s + toHoursNumber(a.plannedHours),
      0,
    );
  }

  private assertVersion(current: number, expected: number, entity: string) {
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
