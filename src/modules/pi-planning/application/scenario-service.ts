/**
 * M3B — PlanningRevision scenario create/clone/rename/archive.
 * Isolation: cloned WorkAllocation rows; never mutates CURRENT via scenario APIs.
 */

import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import type { PiService } from "./pi-service";
import { piAuthScope } from "./pi-auth-scope";
import {
  archiveScenarioInputSchema,
  cloneScenarioInputSchema,
  createScenarioFromCurrentInputSchema,
  markScenarioReadyInputSchema,
  renameScenarioInputSchema,
  reopenScenarioInputSchema,
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

function newScenarioKey(): string {
  return `SCN-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export class ScenarioService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly piService: PiService,
  ) {}

  async listScenarios(
    principal: Principal,
    piId: string,
    opts?: { includeArchived?: boolean },
  ) {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_VIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );

    const revisions = await this.db.planningRevision.findMany({
      where: {
        piId,
        ...(opts?.includeArchived
          ? {}
          : { status: { not: "ARCHIVED" }, archivedAt: null }),
      },
      orderBy: [{ isCurrent: "desc" }, { createdAt: "asc" }],
    });

    return revisions.map((r) => ({
      ...r,
      kind: r.isCurrent ? ("CURRENT" as const) : ("SCENARIO" as const),
    }));
  }

  async createScenarioFromCurrent(principal: Principal, raw: unknown) {
    const input = parse(createScenarioFromCurrentInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_ALLOCATE,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    if (pi.status === "CLOSED") {
      throw new AppError("VALIDATION", "Cannot create scenarios on a closed PI.");
    }

    const current = await this.piService.requireCurrentRevision(pi.id);
    const created = await this.cloneRevisionRows({
      piId: pi.id,
      source: current,
      label: input.label,
      actorId: principal.id,
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pi.scenario.created",
      subjectType: "PlanningRevision",
      subjectId: created.id,
      organizationId: pi.organizationId,
      payload: {
        piId: pi.id,
        key: created.key,
        label: created.label,
        clonedFromRevisionId: current.id,
        version: created.version,
      },
      result: "success",
    });
    return created;
  }

  async cloneScenario(principal: Principal, raw: unknown) {
    const input = parse(cloneScenarioInputSchema, raw);
    const source = await this.db.planningRevision.findUnique({
      where: { id: input.revisionId },
    });
    if (!source) throw new AppError("NOT_FOUND", "Scenario not found.");
    const pi = await this.piService.requirePi(source.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_ALLOCATE,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    if (pi.status === "CLOSED") {
      throw new AppError("VALIDATION", "Cannot clone scenarios on a closed PI.");
    }
    if (source.isCurrent || source.key === "CURRENT") {
      throw new AppError(
        "VALIDATION",
        "Use create-from-current-plan to branch the live plan.",
      );
    }
    if (source.status === "ARCHIVED" || source.archivedAt != null) {
      throw new AppError("VALIDATION", "Cannot clone an archived scenario.");
    }
    if (source.status !== "DRAFT") {
      throw new AppError(
        "VALIDATION",
        "Only DRAFT scenarios can be cloned in M3B.",
      );
    }
    if (
      input.expectedVersion != null &&
      source.version !== input.expectedVersion
    ) {
      throw new AppError(
        "STALE_VERSION",
        "This scenario was changed by someone else. Refresh and try again.",
        { details: { currentVersion: source.version } },
      );
    }

    const created = await this.cloneRevisionRows({
      piId: pi.id,
      source,
      label: input.label,
      actorId: principal.id,
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pi.scenario.cloned",
      subjectType: "PlanningRevision",
      subjectId: created.id,
      organizationId: pi.organizationId,
      payload: {
        piId: pi.id,
        key: created.key,
        label: created.label,
        clonedFromRevisionId: source.id,
        version: created.version,
      },
      result: "success",
    });
    return created;
  }

  async renameScenario(principal: Principal, raw: unknown) {
    const input = parse(renameScenarioInputSchema, raw);
    const revision = await this.requireNonCurrentScenario(input.revisionId);
    const pi = await this.piService.requirePi(revision.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_ALLOCATE,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    this.assertVersion(revision.version, input.expectedVersion);

    try {
      const updated = await this.db.planningRevision.update({
        where: { id: revision.id, version: input.expectedVersion },
        data: {
          label: input.label,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.scenario.updated",
        subjectType: "PlanningRevision",
        subjectId: updated.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          oldLabel: revision.label,
          newLabel: updated.label,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error);
    }
  }

  async archiveScenario(principal: Principal, raw: unknown) {
    const input = parse(archiveScenarioInputSchema, raw);
    const revision = await this.requireNonCurrentScenario(input.revisionId);
    const pi = await this.piService.requirePi(revision.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_ALLOCATE,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    this.assertVersion(revision.version, input.expectedVersion);
    if (revision.status === "ARCHIVED") {
      throw new AppError("VALIDATION", "Scenario is already archived.");
    }

    try {
      const updated = await this.db.$transaction(async (tx) => {
        if (pi.selectedRevisionId === revision.id) {
          await tx.programIncrement.update({
            where: { id: pi.id },
            data: {
              selectedRevisionId: null,
              version: { increment: 1 },
            },
          });
        }
        return tx.planningRevision.update({
          where: { id: revision.id, version: input.expectedVersion },
          data: {
            status: "ARCHIVED",
            archivedAt: new Date(),
            selectedAt: null,
            selectedByPrincipalId: null,
            statusBeforeSelection: null,
            version: { increment: 1 },
          },
        });
      });
      if (pi.selectedRevisionId === revision.id) {
        await this.audit.record({
          actorPrincipalId: principal.id,
          actionType: "pi.scenario.selection_cleared",
          subjectType: "ProgramIncrement",
          subjectId: pi.id,
          organizationId: pi.organizationId,
          payload: {
            piId: pi.id,
            oldRevisionId: revision.id,
            newRevisionId: null,
            reason: "scenario_archived",
          },
          result: "success",
        });
      }
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.scenario.archived",
        subjectType: "PlanningRevision",
        subjectId: updated.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          key: updated.key,
          label: updated.label,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error);
    }
  }

  async markScenarioReady(principal: Principal, raw: unknown) {
    const input = parse(markScenarioReadyInputSchema, raw);
    const revision = await this.requireNonCurrentScenario(input.revisionId);
    const pi = await this.piService.requirePi(revision.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_ALLOCATE,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    this.assertVersion(revision.version, input.expectedVersion);
    if (revision.status !== "DRAFT") {
      throw new AppError(
        "VALIDATION",
        "Only DRAFT scenarios can be marked ready for review.",
      );
    }

    try {
      const updated = await this.db.planningRevision.update({
        where: { id: revision.id, version: input.expectedVersion },
        data: {
          status: "READY_FOR_REVIEW",
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.scenario.updated",
        subjectType: "PlanningRevision",
        subjectId: updated.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          oldStatus: revision.status,
          newStatus: updated.status,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error);
    }
  }

  async reopenScenario(principal: Principal, raw: unknown) {
    const input = parse(reopenScenarioInputSchema, raw);
    const revision = await this.requireNonCurrentScenario(input.revisionId);
    const pi = await this.piService.requirePi(revision.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_ALLOCATE,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    this.assertVersion(revision.version, input.expectedVersion);
    if (revision.status !== "READY_FOR_REVIEW") {
      throw new AppError(
        "VALIDATION",
        "Only READY_FOR_REVIEW scenarios can be reopened to DRAFT.",
      );
    }

    try {
      const updated = await this.db.planningRevision.update({
        where: { id: revision.id, version: input.expectedVersion },
        data: {
          status: "DRAFT",
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.scenario.updated",
        subjectType: "PlanningRevision",
        subjectId: updated.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          oldStatus: revision.status,
          newStatus: updated.status,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error);
    }
  }

  private async requireNonCurrentScenario(revisionId: string) {
    const revision = await this.db.planningRevision.findUnique({
      where: { id: revisionId },
    });
    if (!revision) throw new AppError("NOT_FOUND", "Scenario not found.");
    if (revision.isCurrent || revision.key === "CURRENT") {
      throw new AppError(
        "VALIDATION",
        "CURRENT plan cannot be renamed, archived, or managed as a scenario.",
      );
    }
    return revision;
  }

  private async cloneRevisionRows(args: {
    piId: string;
    source: { id: string };
    label: string;
    actorId: string;
  }) {
    const key = newScenarioKey();
    return this.db.$transaction(async (tx) => {
      const revision = await tx.planningRevision.create({
        data: {
          piId: args.piId,
          key,
          label: args.label,
          isCurrent: false,
          status: "DRAFT",
          clonedFromRevisionId: args.source.id,
          createdByPrincipalId: args.actorId,
        },
      });

      const sourceAllocations = await tx.workAllocation.findMany({
        where: { revisionId: args.source.id },
      });

      if (sourceAllocations.length > 0) {
        await tx.workAllocation.createMany({
          data: sourceAllocations.map((a) => ({
            revisionId: revision.id,
            workItemId: a.workItemId,
            iterationId: a.iterationId,
            teamId: a.teamId,
            resourceId: a.resourceId,
            plannedHours: a.plannedHours,
            notes: a.notes,
            version: 1,
          })),
        });
      }

      return revision;
    });
  }

  private assertVersion(current: number, expected: number) {
    if (current !== expected) {
      throw new AppError(
        "STALE_VERSION",
        "This scenario was changed by someone else. Refresh and try again.",
        { details: { currentVersion: current } },
      );
    }
  }

  private rethrowStale(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new AppError(
        "STALE_VERSION",
        "This scenario was changed by someone else. Refresh and try again.",
      );
    }
    throw error;
  }
}
