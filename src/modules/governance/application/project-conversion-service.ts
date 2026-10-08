/**
 * Initiative → Project conversion orchestration (Phase 1B).
 * Preserves AS-IS transaction semantics and idempotency.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { resolveOptionalBusinessOwner } from "@/modules/organization/application/ownership-policy";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { convertToProjectInputSchema } from "./schemas";
import { parse, toDecimal } from "./governance-utils";

export class ProjectConversionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async convertToProject(principal: Principal, raw: unknown) {
    const input = parse(convertToProjectInputSchema, raw);
    const initiative = await this.db.initiative.findUnique({
      where: { id: input.initiativeId },
      include: {
        project: true,
        decisions: {
          include: { conditions: true, gate: true },
          orderBy: { decidedAt: "desc" },
        },
        governanceGates: {
          where: { gateType: "PILOT_GATE" },
          include: {
            submissions: {
              where: { status: "DECISION_RECORDED" },
              include: { decisionRecord: { include: { conditions: true } } },
              orderBy: { revision: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!initiative || initiative.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Initiative not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.PROJECT_CONVERT, {
      type: "ORGANIZATION",
      organizationId: initiative.organizationId,
    });

    if (initiative.project) {
      throw new AppError(
        "CONFLICT",
        "A Project already exists for this initiative.",
        { details: { projectId: initiative.project.id } },
      );
    }

    const latestPilotDecision =
      initiative.governanceGates[0]?.submissions[0]?.decisionRecord ??
      initiative.decisions.find(
        (d) =>
          d.gate?.gateType === "PILOT_GATE" &&
          (d.outcome === "SCALE" || d.outcome === "CONDITIONAL_SCALE"),
      );

    if (
      !latestPilotDecision ||
      (latestPilotDecision.outcome !== "SCALE" &&
        latestPilotDecision.outcome !== "CONDITIONAL_SCALE")
    ) {
      throw new AppError(
        "VALIDATION",
        "Project conversion requires a SCALE or CONDITIONAL_SCALE pilot gate decision.",
      );
    }

    const decisionWithConditions =
      initiative.decisions.find((d) => d.id === latestPilotDecision.id) ??
      (await this.db.decisionRecord.findUnique({
        where: { id: latestPilotDecision.id },
        include: { conditions: true },
      }));

    const openBlocking = (decisionWithConditions?.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    );
    if (openBlocking.length > 0) {
      throw new AppError(
        "VALIDATION",
        "Blocking scale conditions must be resolved before converting to Project.",
        { details: { openConditionIds: openBlocking.map((c) => c.id) } },
      );
    }

    if (initiative.currentStage !== "PILOT") {
      throw new AppError(
        "VALIDATION",
        "Project conversion advances from Pilot; initiative is not in Pilot stage.",
      );
    }

    const departmentId = input.departmentId ?? initiative.departmentId;

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: initiative.organizationId,
      roleLabel: "project owner",
    });
    // Do not invent Initiative→Project owner copy; only use explicit convert input.
    const ownerName = owner?.name ?? input.ownerName ?? null;

    try {
      const created = await this.db.$transaction(async (tx) => {
        const referenceKey = await this.allocateProjectReference(
          tx,
          initiative.organizationId,
        );

        const project = await tx.project.create({
          data: {
            initiativeId: initiative.id,
            organizationId: initiative.organizationId,
            referenceKey,
            name: input.name,
            description: input.description ?? null,
            ownerName,
            ownerResourceId: owner?.id ?? null,
            departmentId,
            status: "ACTIVE",
            priority: input.priority,
            plannedStart: input.plannedStart ?? null,
            plannedEnd: input.plannedEnd ?? null,
            estimatedCost: toDecimal(input.estimatedCost),
            approvedBudget: toDecimal(input.approvedBudget),
            currencyCode: (input.currencyCode ?? "EUR").toUpperCase(),
            objectives: input.objectives ?? null,
            participatingDepartments:
              input.participatingDepartmentIds.length > 0
                ? {
                    create: input.participatingDepartmentIds.map((id) => ({
                      departmentId: id,
                    })),
                  }
                : undefined,
          },
        });

        await tx.initiative.update({
          where: { id: initiative.id },
          data: {
            currentStage: "PROJECT",
            status: "ACTIVE",
            version: { increment: 1 },
          },
        });

        await tx.lifecycleTransition.create({
          data: {
            initiativeId: initiative.id,
            fromStage: "PILOT",
            toStage: "PROJECT",
            actorPrincipalId: principal.id,
            comment:
              "Converted to Project after SCALE/CONDITIONAL_SCALE governance decision",
          },
        });

        return project;
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "project.converted",
        subjectType: "Project",
        subjectId: created.id,
        organizationId: initiative.organizationId,
        payload: {
          initiativeId: initiative.id,
          referenceKey: created.referenceKey,
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
          "A Project already exists for this initiative.",
        );
      }
      throw error;
    }
  }

  private async allocateProjectReference(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<string> {
    await tx.projectReferenceCounter.upsert({
      where: { organizationId },
      create: { organizationId, nextValue: 1 },
      update: {},
    });
    const updated = await tx.projectReferenceCounter.update({
      where: { organizationId },
      data: { nextValue: { increment: 1 } },
    });
    const allocated = updated.nextValue - 1;
    return `PROJ-${String(allocated).padStart(4, "0")}`;
  }
}
