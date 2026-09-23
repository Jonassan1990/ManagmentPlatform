import { PiStatus, Prisma, PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  buildBaselinePayload,
  compareChangesSinceBaseline,
  type BaselinePayload,
} from "./baseline-snapshot";
import type { PiService } from "./pi-service";
import { createBaselineInputSchema } from "./schemas";

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
 * Immutable PiBaseline rows. Never update payload — rebaseline = new versionNumber.
 *
 * First baseline: requires REVIEW → sets status BASELINED.
 * Rebaseline: from BASELINED or ACTIVE → version N+1, status unchanged.
 */
export class BaselineService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly piService: PiService,
  ) {}

  async listBaselines(principal: Principal, piId: string) {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    return this.db.piBaseline.findMany({
      where: { piId },
      orderBy: { versionNumber: "desc" },
    });
  }

  async getBaseline(principal: Principal, baselineId: string) {
    const baseline = await this.db.piBaseline.findUnique({
      where: { id: baselineId },
      include: { pi: true },
    });
    if (!baseline) throw new AppError("NOT_FOUND", "Baseline not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId: baseline.pi.organizationId,
    });
    return baseline;
  }

  async createBaseline(principal: Principal, raw: unknown) {
    const input = parse(createBaselineInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_BASELINE, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });

    const isFirst = pi.status === PiStatus.REVIEW;
    const isRebaseline =
      pi.status === PiStatus.BASELINED || pi.status === PiStatus.ACTIVE;
    if (!isFirst && !isRebaseline) {
      throw new AppError(
        "VALIDATION",
        "First baseline requires REVIEW status; rebaseline requires BASELINED or ACTIVE.",
      );
    }

    const revision = await this.piService.requireCurrentRevision(pi.id);
    const snapshotInput = await this.buildCurrentSnapshotInput(pi.id, revision);

    const created = await this.db.$transaction(async (tx) => {
      const latest = await tx.piBaseline.findFirst({
        where: { piId: pi.id },
        orderBy: { versionNumber: "desc" },
      });
      const versionNumber = (latest?.versionNumber ?? 0) + 1;
      const payload = buildBaselinePayload(snapshotInput);

      const baseline = await tx.piBaseline.create({
        data: {
          piId: pi.id,
          versionNumber,
          createdByPrincipalId: principal.id,
          label: input.label ?? null,
          payload: payload as unknown as Prisma.InputJsonValue,
          revisionIdCaptured: revision.id,
        },
      });

      if (isFirst) {
        await tx.programIncrement.update({
          where: { id: pi.id },
          data: {
            status: PiStatus.BASELINED,
            version: { increment: 1 },
          },
        });
      }

      return baseline;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: isFirst ? "pi.baseline.created" : "pi.baseline.rebaselined",
      subjectType: "PiBaseline",
      subjectId: created.id,
      organizationId: pi.organizationId,
      payload: {
        versionNumber: created.versionNumber,
        revisionId: revision.id,
      },
      result: "success",
    });
    return created;
  }

  async getChangesSince(
    principal: Principal,
    piId: string,
    baselineId?: string,
  ) {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });

    const baseline = baselineId
      ? await this.db.piBaseline.findFirst({
          where: { id: baselineId, piId },
        })
      : await this.db.piBaseline.findFirst({
          where: { piId },
          orderBy: { versionNumber: "desc" },
        });
    if (!baseline) {
      return { baseline: null, changes: [] as ReturnType<typeof compareChangesSinceBaseline> };
    }

    const revision = await this.piService.requireCurrentRevision(piId);
    const current = await this.buildCurrentSnapshotInput(piId, revision);
    const payload = baseline.payload as BaselinePayload;
    return {
      baseline,
      changes: compareChangesSinceBaseline(payload, current),
    };
  }

  async buildCurrentSnapshotInput(
    piId: string,
    revision: { id: string; key: string; version: number },
  ) {
    const pi = await this.db.programIncrement.findUniqueOrThrow({
      where: { id: piId },
      include: {
        iterations: { orderBy: { sequence: "asc" } },
        participatingDepartments: true,
        participatingTeams: true,
      },
    });
    const allocations = await this.db.workAllocation.findMany({
      where: { revisionId: revision.id },
      include: {
        workItem: true,
        iteration: true,
      },
    });
    const dependencies = await this.db.planningDependency.findMany({
      where: {
        organizationId: pi.organizationId,
        status: { not: "CANCELLED" },
      },
    });

    return {
      pi: {
        id: pi.id,
        referenceKey: pi.referenceKey,
        name: pi.name,
        status: pi.status,
        startDate: pi.startDate,
        endDate: pi.endDate,
        version: pi.version,
      },
      revision: {
        id: revision.id,
        key: revision.key,
        version: revision.version,
      },
      iterations: pi.iterations.map((it) => ({
        id: it.id,
        referenceKey: it.referenceKey,
        name: it.name,
        sequence: it.sequence,
        startDate: it.startDate,
        endDate: it.endDate,
      })),
      allocations: allocations.map((a) => ({
        id: a.id,
        workItemId: a.workItemId,
        workItemReferenceKey: a.workItem.referenceKey,
        iterationId: a.iterationId,
        iterationReferenceKey: a.iteration.referenceKey,
        teamId: a.teamId,
        resourceId: a.resourceId,
        plannedHours: a.plannedHours,
      })),
      participatingDepartmentIds: pi.participatingDepartments.map(
        (d) => d.departmentId,
      ),
      participatingTeamIds: pi.participatingTeams.map((t) => t.teamId),
      dependencies: dependencies.map((d) => ({
        id: d.id,
        type: d.type,
        status: d.status,
        criticality: d.criticality,
        sourceType: d.sourceType,
        sourceId: d.sourceId,
        targetType: d.targetType,
        targetId: d.targetId,
        neededByDate: d.neededByDate,
      })),
    };
  }
}
