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
import type { PlanApprovalService } from "./plan-approval-service";
import type { PlanBaselineFromApprovalResult } from "./plan-approval-types";
import { createBaselineInputSchema } from "./schemas";
import { piAuthScope } from "./pi-auth-scope";

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
 * M3D-C: baseline requires a VALID PiPlanApproval matching exact CURRENT fingerprint.
 * First baseline: requires REVIEW → sets status BASELINED.
 * Rebaseline: from BASELINED or ACTIVE → version N+1, status unchanged.
 */
export class BaselineService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly piService: PiService,
    private readonly planApprovals: PlanApprovalService,
  ) {}

  async listBaselines(principal: Principal, piId: string) {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, piAuthScope(pi.organizationId, pi.sectionId));
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
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, piAuthScope(baseline.pi.organizationId, baseline.pi.sectionId));
    return baseline;
  }

  async createBaseline(
    principal: Principal,
    raw: unknown,
  ): Promise<PlanBaselineFromApprovalResult & { piId: string; versionNumber: number; payload: unknown; id: string; createdAt: Date; label: string | null; revisionIdCaptured: string | null; planApprovalId: string | null }> {
    const input = parse(createBaselineInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_BASELINE, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });

    if (pi.version !== input.expectedPiVersion) {
      throw new AppError(
        "CONFLICT",
        "PI version is stale. Refresh and retry baseline creation.",
        { details: { expected: input.expectedPiVersion, actual: pi.version } },
      );
    }

    const isFirst = pi.status === PiStatus.REVIEW;
    const isRebaseline =
      pi.status === PiStatus.BASELINED || pi.status === PiStatus.ACTIVE;
    if (!isFirst && !isRebaseline) {
      throw new AppError(
        "VALIDATION",
        "First baseline requires REVIEW status; rebaseline requires BASELINED or ACTIVE.",
      );
    }

    // Idempotent replay: approval already consumed into a baseline for this state.
    const existingApproval = await this.db.piPlanApproval.findUnique({
      where: { id: input.expectedApprovalId },
      include: { baseline: true },
    });
    if (
      existingApproval &&
      existingApproval.piId === pi.id &&
      existingApproval.status === "CONSUMED" &&
      existingApproval.baseline
    ) {
      const match = await this.planApprovals.assertApprovalMatchesCurrent(
        pi.id,
        input.expectedApprovalId,
        input.expectedCurrentRevisionVersion,
      );
      if (
        match.approval.status === "CONSUMED" &&
        match.fingerprint === existingApproval.allocationFingerprint
      ) {
        const b = existingApproval.baseline;
        return {
          ...b,
          baselineId: b.id,
          approvalId: existingApproval.id,
          currentRevisionId: match.current.id,
          currentRevisionVersion: match.current.version,
          allocationFingerprint: match.fingerprint,
          createdAt: b.createdAt,
          idempotentReplay: true,
          firstBaseline: b.versionNumber === 1,
        } as never;
      }
    }

    const match = await this.planApprovals.assertApprovalMatchesCurrent(
      pi.id,
      input.expectedApprovalId,
      input.expectedCurrentRevisionVersion,
    );
    if (match.approval.status !== "VALID") {
      throw new AppError(
        "VALIDATION",
        "A valid (unused) approval is required to create a baseline.",
        { details: { status: match.approval.status } },
      );
    }

    const revision = await this.piService.requireCurrentRevision(pi.id);
    const snapshotInput = await this.buildCurrentSnapshotInput(pi.id, revision);

    try {
      const created = await this.db.$transaction(async (tx) => {
        const piLock = await tx.programIncrement.updateMany({
          where: { id: pi.id, version: input.expectedPiVersion },
          data: {
            ...(isFirst ? { status: PiStatus.BASELINED } : {}),
            version: { increment: 1 },
          },
        });
        if (piLock.count !== 1) {
          throw new AppError(
            "CONFLICT",
            "Concurrent PI update — baseline aborted.",
          );
        }

        const approvalLock = await tx.piPlanApproval.updateMany({
          where: {
            id: input.expectedApprovalId,
            piId: pi.id,
            status: "VALID",
            currentRevisionVersion: input.expectedCurrentRevisionVersion,
            allocationFingerprint: match.fingerprint,
          },
          data: { status: "CONSUMED" },
        });
        if (approvalLock.count !== 1) {
          throw new AppError(
            "CONFLICT",
            "Approval is no longer valid for baseline creation. Refresh and retry.",
          );
        }

        const lockedCurrent = await tx.planningRevision.findFirst({
          where: { piId: pi.id, isCurrent: true, key: "CURRENT" },
        });
        if (
          !lockedCurrent ||
          lockedCurrent.version !== input.expectedCurrentRevisionVersion
        ) {
          throw new AppError(
            "CONFLICT",
            "Current plan changed concurrently. Re-approve before baselining.",
          );
        }

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
            planApprovalId: input.expectedApprovalId,
          },
        });

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
          approvalId: input.expectedApprovalId,
          allocationFingerprint: match.fingerprint,
          currentRevisionVersion: revision.version,
        },
        result: "success",
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.plan.baselined",
        subjectType: "PiBaseline",
        subjectId: created.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          baselineId: created.id,
          approvalId: input.expectedApprovalId,
          versionNumber: created.versionNumber,
          currentRevisionId: revision.id,
          currentRevisionVersion: revision.version,
          allocationFingerprint: match.fingerprint,
          createdAt: created.createdAt.toISOString(),
        },
        result: "success",
      });

      return {
        ...created,
        baselineId: created.id,
        approvalId: input.expectedApprovalId,
        currentRevisionId: revision.id,
        currentRevisionVersion: revision.version,
        allocationFingerprint: match.fingerprint,
        createdAt: created.createdAt,
        idempotentReplay: false,
        firstBaseline: isFirst,
      } as never;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2025")
      ) {
        throw new AppError(
          "CONFLICT",
          "Baseline creation failed due to a concurrent update. Refresh and retry.",
        );
      }
      throw new AppError(
        "CONFLICT",
        "Baseline creation failed due to a concurrent update. Refresh and retry.",
        { cause: error },
      );
    }
  }

  async getChangesSince(
    principal: Principal,
    piId: string,
    baselineId?: string,
  ) {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, piAuthScope(pi.organizationId, pi.sectionId));

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
